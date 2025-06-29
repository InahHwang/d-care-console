// src/app/api/patients/status-filter/route.ts - "콜백 미등록" 케이스 추가

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterType = searchParams.get('type');

    if (!filterType) {
      return NextResponse.json(
        { error: '필터 타입이 필요합니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    // 현재 날짜 계산
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    // 이번 달 시작일 계산
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let filter = {};
    let patients = [];
    
    switch (filterType) {
      // 🔥 새로 추가: 콜백 미등록 환자들
      case 'callbackUnregistered': {
        // 상태가 "잠재고객"이면서 콜백이 등록되지 않은 환자들
        const allPatients = await db.collection('patients')
          .find({
            status: '잠재고객', // 잠재고객 상태만
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // callbackHistory가 없거나 빈 배열인 환자들
          return !patient.callbackHistory || patient.callbackHistory.length === 0;
        });
        
        console.log(`[API] 콜백 미등록 환자 ${patients.length}명 조회 완료`);
        break;
      }

      case 'overdueCallbacks': {
        // 🔥 기존: 미처리 콜백 환자들
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // callbackHistory가 없으면 제외
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return false;
          }
          
          // 예정된 콜백 중에서 날짜가 지난 것이 있는지 확인
          const hasOverdueCallback = patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '예정') return false;
            
            const callbackDate = new Date(callback.date);
            callbackDate.setHours(0, 0, 0, 0);
            
            return callbackDate < todayStart; // 오늘보다 이전 날짜
          });
          
          return hasOverdueCallback;
        });
        
        console.log(`[API] 미처리 콜백 환자 ${patients.length}명 조회 완료`);
        break;
      }
      
      case 'callbackNeeded':
        // 콜백이 필요한 환자: 상태가 '콜백필요'인 환자
        filter = { status: '콜백필요' };
        patients = await db.collection('patients')
          .find({
            ...filter,
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .sort({ updatedAt: -1 })
          .toArray();
        break;
        
      case 'absent':
        // 부재중 환자: 상태가 '부재중'인 환자
        filter = { status: '부재중' };
        patients = await db.collection('patients')
          .find({
            ...filter,
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .sort({ updatedAt: -1 })
          .toArray();
        break;
        
      case 'todayScheduled': {
        // 오늘 예정된 콜백이 있는 환자들
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return false;
          }
          
          // 오늘 예정된 콜백이 있는지 확인
          const hasTodayCallback = patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '예정') return false;
            
            const callbackDate = new Date(callback.date);
            return callbackDate >= todayStart && callbackDate < todayEnd;
          });
          
          return hasTodayCallback;
        });
        break;
      }
        
      default:
        return NextResponse.json(
          { error: '유효하지 않은 필터 타입입니다.' },
          { status: 400 }
        );
    }

    // MongoDB ObjectId를 문자열로 변환
    const processedPatients = patients.map((patient: { _id: { toString: () => any; }; }) => ({
      ...patient,
      _id: patient._id.toString(),
      id: patient._id.toString() // 호환성을 위해 id 필드도 추가
    }));

    console.log(`[API] ${filterType} 필터로 ${processedPatients.length}명의 환자를 조회했습니다.`);

    return NextResponse.json(processedPatients);

  } catch (error) {
    console.error('[API] 환자 상태별 필터링 오류:', error);
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      },
      { status: 500 }
    );
  }
}