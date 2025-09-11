// src/app/api/patients/filtered/route.ts - 잠재매출 세부 분류 추가

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type');

    if (!filterType) {
      return NextResponse.json({ error: '필터 타입이 필요합니다.' }, { status: 400 });
    }

    console.log('🔍 API: 필터된 환자 목록 조회 시작 - 타입:', filterType);

    let query = {};
    let sort: { [key: string]: 1 | -1 } = { createdAt: -1 };

    // 날짜 범위 계산 - 년월 파라미터 지원
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    
    let startOfMonthString: string;
    let endOfMonthString: string;
    
    if (yearParam && monthParam) {
      // 특정 년월이 요청된 경우
      const targetYear = parseInt(yearParam);
      const targetMonth = parseInt(monthParam);
      
      startOfMonthString = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      endOfMonthString = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      console.log(`📅 요청된 날짜 범위: ${targetYear}년 ${targetMonth}월 (${startOfMonthString} ~ ${endOfMonthString})`);
    } else {
      // 기본값: 이번달
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      startOfMonthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      endOfMonthString = now.toISOString().split('T')[0]; // 오늘까지
      
      console.log(`📅 기본 날짜 범위: 이번달 (${startOfMonthString} ~ ${endOfMonthString})`);
    }

    switch (filterType) {
      case 'potential_revenue':
        // 잠재매출: 상담진행중 + 내원관리중 (치료시작 제외)
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          $or: [
            // 상담진행중 (치료시작 아닌 환자들)
            { 
              status: { $in: ['콜백필요', '잠재고객', '예약확정', '재예약확정'] },
              isCompleted: { $ne: true },
              $or: [
                { visitConfirmed: { $ne: true } }, // 아직 내원 안함
                { postVisitStatus: { $ne: '치료시작' } } // 내원했지만 치료시작 아님
              ]
            },
            // 내원관리중 (치료시작 제외)
            { 
              visitConfirmed: true,
              postVisitStatus: { $nin: ['치료시작', '종결'] },
              isCompleted: { $ne: true }
            }
          ]
        };
        break;

      // 🔥 새로 추가: 잠재매출 - 상담진행중만 (내원 안한 환자만)
      case 'potential_consultation_ongoing':
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          status: { $in: ['콜백필요', '잠재고객', '예약확정', '재예약확정'] },
          isCompleted: { $ne: true },
          visitConfirmed: { $ne: true } // 🔥 아직 내원 안한 환자만
        };
        break;

      // 🔥 새로 추가: 잠재매출 - 내원관리중만
      case 'potential_visit_management':
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          visitConfirmed: true,
          postVisitStatus: { $nin: ['치료시작', '종결'] },
          isCompleted: { $ne: true }
        };
        break;

      case 'lost_revenue':
        // 손실매출: 종결된 환자들
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          $or: [
            { status: { $in: ['종결', '부재중'] } },
            { isCompleted: true },
            { 
              visitConfirmed: true,
              postVisitStatus: '종결'
            }
          ]
        };
        break;

      // 🔥 새로 추가: 손실매출 - 상담단계만 (내원 안한 환자만)
      case 'lost_consultation':
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          $or: [
            { 
              status: { $in: ['종결', '부재중'] },
              visitConfirmed: { $ne: true } // 🔥 내원 안한 환자만
            },
            { 
              isCompleted: true,
              visitConfirmed: { $ne: true } // 🔥 내원 안한 완료 환자만
            }
          ]
        };
        break;

      // 🔥 새로 추가: 손실매출 - 내원후만
      case 'lost_visit':
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          visitConfirmed: true,
          postVisitStatus: '종결'
        };
        break;

      case 'treatment_rate':
        // 치료 시작한 환자들 (postVisitStatus = '치료시작')
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          postVisitStatus: '치료시작'
        };
        sort = { treatmentStartDate: -1, createdAt: -1 };
        break;

      case 'new_inquiry':
        // 신규 문의 환자들
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          }
        };
        sort = { callInDate: -1 };
        console.log('🔍 API: 신규 문의 날짜 범위:', { 
          start: startOfMonthString, 
          end: endOfMonthString,
          description: yearParam && monthParam ? `${yearParam}년 ${monthParam}월` : '이번달',
          query: JSON.stringify(query)
        });
        break;

      case 'reservation_rate':
        // 예약 확정된 환자들
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          status: '예약확정'
        };
        sort = { reservationDate: -1, createdAt: -1 };
        break;

      case 'visit_rate':
        // 실제 내원한 환자들 (visitConfirmed = true)
        query = {
          callInDate: {
            $gte: startOfMonthString,
            $lte: endOfMonthString
          },
          visitConfirmed: true
        };
        sort = { visitDate: -1, createdAt: -1 };
        break;

      default:
        return NextResponse.json({ error: '지원하지 않는 필터 타입입니다.' }, { status: 400 });
    }

    console.log('🔍 API: 쿼리 조건:', JSON.stringify(query, null, 2));

    const patients = await db
      .collection('patients')
      .find(query)
      .sort(sort)
      .toArray();

    console.log('🔍 API: 조회된 환자 수:', patients.length);
    
    // 실제 조회된 환자들의 문의일 확인
    patients.forEach((patient, index) => {
      if (index < 10) { // 최대 10명까지만 로그
        console.log(`환자 ${index + 1}: ${patient.name} - 문의일: ${patient.callInDate}`);
      }
    });

    // ID 필드 정규화
    const normalizedPatients = patients.map((patient) => {
      const stringId = typeof patient._id === 'string' ? patient._id : patient._id.toString();
      return {
        ...patient,
        _id: stringId,
        id: patient.id || stringId,
      };
    });

    return NextResponse.json({ 
      patients: normalizedPatients,
      filterType,
      totalItems: normalizedPatients.length,
      // 디버깅 정보 추가
      dateRange: {
        start: startOfMonthString,
        end: endOfMonthString,
        year: yearParam,
        month: monthParam
      }
    });
    
  } catch (error) {
    console.error('🚨 API: 필터된 환자 목록 조회 실패:', error);
    return NextResponse.json({ error: '필터된 환자 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}