// /src/app/api/smart-reports/route.ts - convertToPatient 함수 수정
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { Patient } from '@/types/patient';
import {
  analyzePatientSegments,
  analyzeRegionPerformance,
  analyzeAgeGroups,
  analyzeConsultationPatterns,
  generateAdvancedInsights,
  generateActionPlans,
  calculateTargets
} from '@/utils/smartReportAnalytics';

// 🔥 MongoDB Document를 Patient 타입으로 안전하게 변환하는 헬퍼 함수
function convertToPatient(doc: any): Patient {
  return {
    // 필수 필드들
    _id: doc._id?.toString() || '',
    id: doc.id || doc._id?.toString() || '',
    isTodayReservationPatient: doc.isTodayReservationPatient || false,
    patientId: doc.patientId || '',
    name: doc.name || '',
    phoneNumber: doc.phoneNumber || '',
    interestedServices: Array.isArray(doc.interestedServices) ? doc.interestedServices : [],
    lastConsultation: doc.lastConsultation || '',
    status: doc.status || '콜백필요',
    reminderStatus: doc.reminderStatus || '초기',
    callInDate: doc.callInDate || '',
    firstConsultDate: doc.firstConsultDate || '',
    createdAt: doc.createdAt || '',
    updatedAt: doc.updatedAt || '',
    consultationType: doc.consultationType || 'outbound',
    
    // 선택적 필드들 - 안전한 기본값 설정
    notes: doc.notes || undefined,
    callbackHistory: Array.isArray(doc.callbackHistory) ? doc.callbackHistory : [],
    age: typeof doc.age === 'number' ? doc.age : undefined,
    region: doc.region || undefined,
    isCompleted: Boolean(doc.isCompleted),
    visitConfirmed: Boolean(doc.visitConfirmed),
    completedAt: doc.completedAt || undefined,
    completedReason: doc.completedReason || undefined,
    eventTargetInfo: doc.eventTargetInfo || undefined,
    inboundPhoneNumber: doc.inboundPhoneNumber || undefined,
    referralSource: doc.referralSource || '',
    
    // 담당자 정보
    createdBy: doc.createdBy || undefined,
    createdByName: doc.createdByName || undefined,
    lastModifiedBy: doc.lastModifiedBy || undefined,
    lastModifiedByName: doc.lastModifiedByName || undefined,
    lastModifiedAt: doc.lastModifiedAt || undefined,
    
    // 계산된 필드
    paymentRate: typeof doc.paymentRate === 'number' ? doc.paymentRate : undefined,
    
    // 내원 관리 필드들
    postVisitStatus: doc.postVisitStatus || '',
    visitDate: doc.visitDate || undefined,
    reservationDate: doc.reservationDate || undefined,
    reservationTime: doc.reservationTime || undefined,
    postVisitConsultation: doc.postVisitConsultation || undefined,
    postVisitNotes: doc.postVisitNotes || undefined,
    treatmentStartDate: doc.treatmentStartDate || undefined,
    nextVisitDate: doc.nextVisitDate || undefined,
    nextCallbackDate: doc.nextCallbackDate || '',
    
    // 기타 필드들
    memo: doc.memo || '',
    consultation: doc.consultation || undefined,
    paymentAmount: typeof doc.paymentAmount === 'number' ? doc.paymentAmount : 0,
    treatmentCost: typeof doc.treatmentCost === 'number' ? doc.treatmentCost : 0
  };
}

// 🔥 월별 메트릭 계산 함수
function calculateMonthlyMetrics(patients: Patient[]) {
  const totalPatients = patients.length;
  
  // 전환 성공 케이스 판단 로직 강화
  const conversions = patients.filter(p => 
    p.status === "예약확정" || 
    p.visitConfirmed === true ||
    p.postVisitStatus === "치료시작"
  ).length;
  
  // 견적 금액 계산 - postVisitConsultation에서 추출
  const estimates = patients
    .map(p => {
      const estimate = p.postVisitConsultation?.estimateInfo?.regularPrice ||
                      p.postVisitConsultation?.estimateInfo?.discountPrice;
      return typeof estimate === 'number' ? estimate : null;
    })
    .filter(Boolean) as number[];
  
  const avgEstimate = estimates.length > 0 
    ? estimates.reduce((sum, est) => sum + est, 0) / estimates.length 
    : 0;

  // 평균 콜백 횟수 계산
  const totalCallbacks = patients.reduce((sum, p) => sum + (p.callbackHistory?.length || 0), 0);
  const avgCallbacks = patients.length > 0 ? totalCallbacks / patients.length : 0;

  // 이벤트 타겟 수 계산
  const eventTargets = patients.filter(p => 
    p.eventTargetInfo?.isEventTarget === true ||
    p.status === "부재중" // 부재중도 이벤트 타겟으로 간주
  ).length;

  return {
    totalPatients,
    conversions,
    conversionRate: totalPatients > 0 ? (conversions / totalPatients) * 100 : 0,
    avgEstimate,
    avgCallbacks,
    eventTargets
  };
}

export async function GET(request: Request) {
  try {
    console.log('🤖 Smart Reports API 시작');
    
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7); // YYYY-MM
    
    console.log(`📅 분석 기간: ${month}`);

    // 🔥 현재 월 데이터 조회
    const startOfMonth = new Date(month + '-01');
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    
    console.log(`🔍 현재 월 조회: ${startOfMonth.toISOString()} ~ ${endOfMonth.toISOString()}`);

    const currentMonthDocs = await db.collection('patients').find({
      createdAt: {
        $gte: startOfMonth.toISOString(),
        $lt: endOfMonth.toISOString()
      }
    }).toArray();

    console.log(`📊 현재 월 환자 수: ${currentMonthDocs.length}명`);

    const currentMonthPatients: Patient[] = currentMonthDocs.map(convertToPatient);

    // 🔥 이전 월 데이터 조회
    const prevMonth = new Date(startOfMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthEnd = new Date(startOfMonth);
    
    console.log(`🔍 이전 월 조회: ${prevMonth.toISOString()} ~ ${prevMonthEnd.toISOString()}`);

    const previousMonthDocs = await db.collection('patients').find({
      createdAt: {
        $gte: prevMonth.toISOString(),
        $lt: prevMonthEnd.toISOString()
      }
    }).toArray();

    console.log(`📊 이전 월 환자 수: ${previousMonthDocs.length}명`);

    const previousMonthPatients: Patient[] = previousMonthDocs.map(convertToPatient);

    // 🔥 최근 3개월 트렌드 데이터
    const trendData = [];
    for (let i = 2; i >= 0; i--) {
      const trendStart = new Date(startOfMonth);
      trendStart.setMonth(trendStart.getMonth() - i);
      const trendEnd = new Date(trendStart);
      trendEnd.setMonth(trendEnd.getMonth() + 1);
      
      const trendDocs = await db.collection('patients').find({
        createdAt: {
          $gte: trendStart.toISOString(),
          $lt: trendEnd.toISOString()
        }
      }).toArray();

      const trendPatients: Patient[] = trendDocs.map(convertToPatient);
      const metrics = calculateMonthlyMetrics(trendPatients);
      
      trendData.push({
        month: trendStart.toLocaleDateString('ko-KR', { month: 'long' }),
        patients: metrics.totalPatients,
        conversions: metrics.conversions,
        rate: metrics.conversionRate,
        revenue: metrics.conversions * (metrics.avgEstimate / 10000) // 만원 단위
      });
    }

    console.log('📈 트렌드 데이터 생성 완료');

    // 🔥 현재/이전 월 메트릭 계산
    const currentMonth = calculateMonthlyMetrics(currentMonthPatients);
    const previousMonth = calculateMonthlyMetrics(previousMonthPatients);

    console.log('📊 메트릭 계산 완료:', {
      current: currentMonth,
      previous: previousMonth
    });

    // 🔥 분석 수행
    console.log('🔬 데이터 분석 시작');
    
    const patientSegments = analyzePatientSegments(currentMonthPatients);
    const regionData = analyzeRegionPerformance(currentMonthPatients);
    const ageGroups = analyzeAgeGroups(currentMonthPatients);
    const consultationPatterns = analyzeConsultationPatterns(currentMonthPatients);

    console.log('📊 분석 결과:', {
      segments: patientSegments.length,
      regions: regionData.length,
      ageGroups: ageGroups.length,
      patterns: consultationPatterns
    });

    // 🔥 AI 인사이트 생성
    const aiInsights = generateAdvancedInsights(currentMonthPatients, currentMonth, previousMonth);
    console.log(`🤖 AI 인사이트 ${aiInsights.length}개 생성 완료`);

    // 🔥 실행 계획 생성
    const actionPlans = generateActionPlans(aiInsights, currentMonth);
    const targets = calculateTargets(currentMonth, previousMonth, aiInsights);

    console.log('🎯 실행 계획 및 목표 설정 완료');

    // 🔥 최종 응답 구성
    const response = {
      period: {
        current: month,
        previous: prevMonth.toISOString().slice(0, 7)
      },
      metrics: {
        current: currentMonth,
        previous: previousMonth,
        trend: trendData
      },
      analysis: {
        patientSegments,
        regionData,
        ageGroups,
        aiInsights,
        consultationPatterns
      },
      recommendations: {
        actionPlans,
        targets
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataSource: "MongoDB Real-time",
        totalRecords: currentMonthPatients.length,
        aiVersion: "v1.0",
        confidence: 85
      }
    };

    console.log('✅ Smart Reports API 완료');

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Smart Reports API Error:', error);
    
    // 상세한 에러 정보 로깅
    if (error instanceof Error) {
      console.error('에러 메시지:', error.message);
      console.error('스택 트레이스:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate smart report',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}