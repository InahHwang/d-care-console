// src/app/api/patients/status-filter/route.ts - 내원관리 콜백 통합 버전

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
    
    // 🔥 오늘 날짜 문자열 (YYYY-MM-DD 형식)
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
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
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // 상담 관리의 콜백 필요 OR 내원 관리의 재콜백 필요
          return patient.status === '콜백필요' || 
                patient.postVisitStatus === '재콜백필요';
        });
        
        // 최신 업데이트순으로 정렬
        patients.sort((a: any, b: any) => {
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        console.log(`[API] 콜백 필요 환자 ${patients.length}명 조회 완료 (상담관리 + 내원관리)`);
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
        // 🔥 🔥 🔥 오늘 예정된 콜백이 있는 환자들 - 상담관리 + 내원관리 통합
        const allPatients = await db.collection('patients')
          .find({
            $or: [
              { isCompleted: { $ne: true } },
              { isCompleted: { $exists: false } }
            ]
          })
          .toArray();
        
        patients = allPatients.filter((patient: any) => {
          // 1. 기존 조건: 상담관리 콜백 (callbackHistory 또는 nextCallbackDate)
          const hasManagementCallback = (() => {
            // 🔥 내원확정된 환자 중에서 재콜백필요가 아닌 경우만 상담관리에서 제외
            if (patient.visitConfirmed === true && patient.postVisitStatus !== '재콜백필요') {
              return false;
            }
            
            return patient.callbackHistory?.some((callback: any) => 
              callback.status === '예정' && callback.date === todayStr
            ) || patient.nextCallbackDate === todayStr;
          })();

          // 2. 🔥 새로운 조건: 내원관리 콜백 (visitConfirmed=true이고 postVisitStatus가 '재콜백필요')
          const hasPostVisitCallback = (() => {
            // 기본 조건: 내원 확정되어야 함
            if (patient.visitConfirmed !== true) {
              return false;
            }
            
            // 🔥 명확한 조건: 정확히 '재콜백필요' 상태만 포함
            if (patient.postVisitStatus !== '재콜백필요') {
              return false;
            }
            
            // 내원관리 환자도 callbackHistory에서 오늘 예정된 콜백이 있어야 함
            if (patient.callbackHistory && patient.callbackHistory.length > 0) {
              return patient.callbackHistory.some((callback: any) => {
                return callback.status === '예정' && callback.date === todayStr;
              });
            }
            
            return false;
          })();

          return hasManagementCallback || hasPostVisitCallback;
        });

        // 🔥 디버깅 로그 추가
        console.log(`[API] 오늘 예정된 콜백 조회 (${todayStr}):`, {
          전체환자수: allPatients.length,
          상담관리콜백: allPatients.filter((patient: any) => {
            const hasManagementCallback = patient.callbackHistory?.some((callback: any) => 
              callback.status === '예정' && callback.date === todayStr
            ) || patient.nextCallbackDate === todayStr;
            
            return hasManagementCallback && !(patient.visitConfirmed === true && patient.postVisitStatus === '재콜백필요');
          }).length,
          내원관리콜백: allPatients.filter((patient: any) => {
            return patient.visitConfirmed === true && 
                   patient.postVisitStatus === '재콜백필요' &&
                   patient.callbackHistory?.some((callback: any) => 
                     callback.status === '예정' && callback.date === todayStr
                   );
          }).length,
          통합결과: patients.length
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