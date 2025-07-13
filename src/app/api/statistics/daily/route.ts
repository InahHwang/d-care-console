// src/app/api/statistics/daily/route.ts - 일별 통계 전용 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT 토큰 검증
async function verifyToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 필요합니다.');
  }

  const token = authorization.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    throw new Error('유효하지 않은 토큰입니다.');
  }
}

// 일별 통계 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    await verifyToken(request);
    
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    console.log('📊 일별 통계 API 호출:', selectedDate);
    
    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');
    const activityLogsCollection = db.collection('activityLogs');
    
    // 환자 데이터 조회
    const patients = await patientsCollection.find({}).toArray();
    
    // 선택된 날짜의 활동 로그 조회 (콜백 생성 관련)
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const activityLogs = await activityLogsCollection.find({
      timestamp: {
        $gte: startOfDay.toISOString(),
        $lte: endOfDay.toISOString()
      },
      action: { $in: ['callback_create', 'callback_complete', 'callback_update'] }
    }).toArray();
    
    console.log('조회된 환자 수:', patients.length);
    console.log('조회된 활동 로그 수:', activityLogs.length);
    
    // 🔥 콜백 처리 현황 계산 - 대시보드 로직과 동일하게 수정
    
    // 1. 미처리 콜백 (overdueCallbacks)
    const overdueCallbackPatients = patients.filter((patient: any) => {
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) return false;
      
      const today = new Date(selectedDate);
      today.setHours(0, 0, 0, 0);
      
      return patient.callbackHistory.some((callback: any) => {
        if (callback.status !== '예정') return false;
        
        const callbackDate = new Date(callback.date);
        callbackDate.setHours(0, 0, 0, 0);
        
        return callbackDate < today;
      });
    });
    
    // 2. 콜백 미등록 (callbackUnregistered)
    const callbackUnregisteredPatients = patients.filter((patient: any) => {
      if (patient.status !== '잠재고객') return false;
      if (patient.isCompleted === true) return false;
      
      return !patient.callbackHistory || patient.callbackHistory.length === 0;
    });
    
    // 3. 부재중 (absent)
    const absentPatients = patients.filter((patient: any) => {
      return patient.status === '부재중' && patient.isCompleted !== true;
    });
    
    // 4. 오늘 예정된 콜백 (todayScheduled)
    const todayScheduledPatients = patients.filter((patient: any) => {
      const hasManagementCallback = (() => {
        if (patient.visitConfirmed === true && patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        return patient.callbackHistory?.some((callback: any) => 
          callback.status === '예정' && callback.date === selectedDate
        ) || patient.nextCallbackDate === selectedDate;
      })();

      const hasPostVisitCallback = (() => {
        if (patient.visitConfirmed !== true || patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        return patient.callbackHistory?.some((callback: any) => {
          return callback.status === '예정' && callback.date === selectedDate;
        });
      })();

      return hasManagementCallback || hasPostVisitCallback;
    });
    
    // 처리율 계산 함수
    const calculateProcessingRate = (patients: any[]) => {
      if (patients.length === 0) return { processed: 0, rate: 100 };
      
      const processedCount = patients.filter((patient: any) => {
        const hasCompletedCallback = patient.callbackHistory?.some((callback: any) => 
          callback.status === '완료' || callback.status === '예약확정'
        );
        
        const isResolved = ['예약확정', '종결'].includes(patient.status);
        
        return hasCompletedCallback || isResolved;
      }).length;
      
      return {
        processed: processedCount,
        rate: Math.round((processedCount / patients.length) * 100)
      };
    };
    
    // 각 카테고리별 처리 현황 계산
    const overdueResult = calculateProcessingRate(overdueCallbackPatients);
    const unregisteredResult = calculateProcessingRate(callbackUnregisteredPatients);
    const absentResult = calculateProcessingRate(absentPatients);
    const todayScheduledResult = calculateProcessingRate(todayScheduledPatients);
    
    const callbackSummary = {
      overdueCallbacks: {
        total: overdueCallbackPatients.length,
        processed: overdueResult.processed,
        processingRate: overdueResult.rate
      },
      callbackUnregistered: {
        total: callbackUnregisteredPatients.length,
        processed: unregisteredResult.processed,
        processingRate: unregisteredResult.rate
      },
      absent: {
        total: absentPatients.length,
        processed: absentResult.processed,
        processingRate: absentResult.rate
      },
      todayScheduled: {
        total: todayScheduledPatients.length,
        processed: todayScheduledResult.processed,
        processingRate: todayScheduledResult.rate
      }
    };
    
    // 🔥 견적금액 정보 계산 - 수정된 로직
    
    // 1. 유선 상담 환자들 (callInDate === selectedDate)
    const phoneConsultationPatients = patients.filter((patient: any) => 
      patient.callInDate === selectedDate
    );
    
    // 2. 내원 상담 환자들 (visitDate === selectedDate)
    const visitConsultationPatients = patients.filter((patient: any) => 
      patient.visitDate === selectedDate && patient.visitConfirmed
    );
    
    // 3. 치료 시작 처리된 환자들 (치료시작 처리 날짜 기준)
    const treatmentStartedPatients = patients.filter((patient: any) => {
      if (patient.postVisitStatus !== '치료시작') return false;
      
      // 치료시작 처리 날짜 기준
      const treatmentStartDate = patient.treatmentStartDate || patient.lastModifiedAt;
      if (treatmentStartDate) {
        const treatmentDate = new Date(treatmentStartDate).toISOString().split('T')[0];
        return treatmentDate === selectedDate;
      }
      
      return false;
    });
    
    let phoneConsultationEstimate = 0;
    let visitConsultationEstimate = 0;
    let treatmentStartedEstimate = 0;
    
    // 유선 상담 환자들의 견적
    phoneConsultationPatients.forEach((patient: any) => {
      let estimateAmount = 0;
      
      if (patient.consultation?.estimatedAmount) {
        estimateAmount = patient.consultation.estimatedAmount;
      }
      
      if (estimateAmount > 0) {
        phoneConsultationEstimate += estimateAmount;
      }
    });
    
    // 내원 상담 환자들의 견적
    visitConsultationPatients.forEach((patient: any) => {
      let estimateAmount = 0;
      
      if (patient.postVisitConsultation?.estimateInfo?.discountPrice) {
        estimateAmount = patient.postVisitConsultation.estimateInfo.discountPrice;
      } else if (patient.consultation?.estimatedAmount) {
        estimateAmount = patient.consultation.estimatedAmount;
      }
      
      if (estimateAmount > 0) {
        visitConsultationEstimate += estimateAmount;
      }
    });
    
    // 치료 시작 처리된 환자들의 견적
    treatmentStartedPatients.forEach((patient: any) => {
      let estimateAmount = 0;
      
      if (patient.postVisitConsultation?.estimateInfo?.discountPrice) {
        estimateAmount = patient.postVisitConsultation.estimateInfo.discountPrice;
      } else if (patient.consultation?.estimatedAmount) {
        estimateAmount = patient.consultation.estimatedAmount;
      }
      
      if (estimateAmount > 0) {
        treatmentStartedEstimate += estimateAmount;
      }
    });
    
    // 총 상담 견적 = 내원 상담 + 유선 상담
    const totalConsultationEstimate = visitConsultationEstimate + phoneConsultationEstimate;
    
    const estimateSummary = {
      totalConsultationEstimate,
      visitConsultationEstimate,
      phoneConsultationEstimate,
      treatmentStartedEstimate
    };
    
    // 응답 데이터
    const dailyStats = {
      selectedDate,
      callbackSummary,
      estimateSummary,
      rawData: {
        totalPatients: patients.length,
        phoneConsultationPatientsCount: phoneConsultationPatients.length,
        visitConsultationPatientsCount: visitConsultationPatients.length,
        treatmentStartedPatientsCount: treatmentStartedPatients.length,
        activityLogsCount: activityLogs.length
      }
    };
    
    console.log('일별 통계 계산 완료:', dailyStats);
    
    return NextResponse.json({
      success: true,
      data: dailyStats
    });

  } catch (error) {
    console.error('일별 통계 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '일별 통계 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('토큰') ? 401 : 500 }
    );
  }
}