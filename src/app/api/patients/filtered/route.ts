// 실제로 생성해야 할 파일: src/app/api/patients/filtered/route.ts

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
    let sort: { [key: string]: 1 | -1 } = { createdAt: -1 }; // MongoDB 정렬 타입 수정

    // 🔥 이번달 날짜 범위 계산 - UTC 시간대 고려
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // 🔥 한국 시간 기준으로 이번달 1일 00:00:00 
    const startOfMonthString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`; // 2025-06-01
    
    // 🔥 한국 시간 기준으로 오늘 23:59:59
    const todayString = now.toISOString().split('T')[0]; // 2025-06-23

    switch (filterType) {
      case 'new_inquiry':
        // 🔥 이번달 신규 문의 환자들 - 6월 1일 ~ 오늘까지
        query = {
          callInDate: {
            $gte: startOfMonthString,  // 2025-06-01
            $lte: todayString          // 2025-06-23 (오늘)
          }
        };
        sort = { callInDate: -1 }; // 문의일 최신순
        console.log('🔍 API: 신규 문의 날짜 범위:', { 
          start: startOfMonthString, 
          end: todayString,
          description: '이번달 1일부터 오늘까지',
          query: JSON.stringify(query)
        });
        break;

      case 'reservation_rate':
        // 🔥 이번달 문의 중 예약 확정된 환자들
        query = {
          callInDate: {
            $gte: startOfMonthString,  // 이번달 1일
            $lte: todayString          // 오늘
          },
          status: '예약확정'
        };
        sort = { reservationDate: -1, createdAt: -1 }; // 예약일 최신순, 없으면 생성일순
        break;

      case 'visit_rate':
        // 🔥 이번달 문의 중 실제 내원한 환자들 (visitConfirmed = true)
        query = {
          callInDate: {
            $gte: startOfMonthString,  // 이번달 1일
            $lte: todayString          // 오늘
          },
          visitConfirmed: true
        };
        sort = { visitDate: -1, createdAt: -1 }; // 내원일 최신순, 없으면 생성일순
        break;

      case 'treatment_rate':
        // 🔥 이번달 문의 중 치료 시작한 환자들 (postVisitStatus = '치료시작')
        query = {
          callInDate: {
            $gte: startOfMonthString,  // 이번달 1일
            $lte: todayString          // 오늘
          },
          postVisitStatus: '치료시작'
        };
        sort = { treatmentStartDate: -1, createdAt: -1 }; // 치료시작일 최신순, 없으면 생성일순
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
    
    // 🔥 실제 조회된 환자들의 문의일 확인
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
      totalItems: normalizedPatients.length 
    });
    
  } catch (error) {
    console.error('🚨 API: 필터된 환자 목록 조회 실패:', error);
    return NextResponse.json({ error: '필터된 환자 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}