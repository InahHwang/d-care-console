// src/app/api/reports/monthly/route.ts - 🔥 JWT 검증 및 에러 핸들링 개선, 손실 분석 추가
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { MonthlyStats, ChangeIndicator, PatientConsultationSummary } from '@/types/report';
import { calculateLossAnalysis } from '@/utils/lossAnalysisUtils'; // 🔥 새로 추가


// JWT 검증 함수
function verifyToken(token: string) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (error) {
    // JWT_SECRET이 없는 경우 decode로 폴백 (개발환경용)
    console.warn('JWT 검증 실패, decode로 폴백:', error);
    return jwt.decode(token) as any;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value ||
                  request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];

    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { month, year } = await request.json();

    if (!month || !year) {
      return NextResponse.json({ message: '월과 년도를 입력해주세요.' }, { status: 400 });
    }

    console.log(`🔍 월별 통계 요청: ${year}년 ${month}월`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 해당 월의 시작일과 종료일 계산 (callInDate 기준)
    const startDateStr = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDateStr = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`;
    
    console.log(`📅 조회 기간 (callInDate 기준): ${startDateStr} ~ ${endDateStr}`);
    
    // 이전 월의 시작일과 종료일 (비교용)
    const prevMonth = month - 1 === 0 ? 12 : month - 1;
    const prevYear = month - 1 === 0 ? year - 1 : year;
    const prevStartDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
    const prevEndDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${new Date(prevYear, prevMonth, 0).getDate().toString().padStart(2, '0')}`;

    console.log(`📅 이전월 기간 (callInDate 기준): ${prevStartDateStr} ~ ${prevEndDateStr}`);

    // 현재 월 데이터 조회 - callInDate 기준으로 변경
    const currentMonthPatients = await patientsCollection.find({
      callInDate: {
        $gte: startDateStr,
        $lte: endDateStr
      }
    }).toArray();

    console.log(`📊 현재월 환자 수: ${currentMonthPatients.length}명`);

    // 이전 월 데이터 조회 (비교용) - callInDate 기준으로 변경
    const prevMonthPatients = await patientsCollection.find({
      callInDate: {
        $gte: prevStartDateStr,
        $lte: prevEndDateStr
      }
    }).toArray();

    console.log(`📊 이전월 환자 수: ${prevMonthPatients.length}명`);

    // 현재 월 통계 계산
    const currentStats = calculateMonthlyStats(currentMonthPatients);
    const prevStats = calculateMonthlyStats(prevMonthPatients);

    console.log('📈 현재월 통계:', currentStats);
    console.log('📈 이전월 통계:', prevStats);

    // 변화율 계산
    const changes = {
      totalInquiries: calculateChange(currentStats.totalInquiries, prevStats.totalInquiries),
      inboundCalls: calculateChange(currentStats.inboundCalls, prevStats.inboundCalls),
      outboundCalls: calculateChange(currentStats.outboundCalls, prevStats.outboundCalls),
      returningCalls: calculateChange(currentStats.returningCalls, prevStats.returningCalls),
      appointmentPatients: calculateChange(currentStats.appointmentPatients, prevStats.appointmentPatients),
      appointmentRate: calculateChange(currentStats.appointmentRate, prevStats.appointmentRate),
      visitedPatients: calculateChange(currentStats.visitedPatients, prevStats.visitedPatients),
      visitRate: calculateChange(currentStats.visitRate, prevStats.visitRate),
      paymentPatients: calculateChange(currentStats.paymentPatients, prevStats.paymentPatients),
      paymentRate: calculateChange(currentStats.paymentRate, prevStats.paymentRate),
      totalPayment: calculateChange(currentStats.totalPayment, prevStats.totalPayment)
    };

    const result = {
      ...currentStats,
      changes,
      // 🔥 환자별 상담 내용도 함께 반환
      patientConsultations: currentStats.patientConsultations
    };

    console.log('✅ 최종 결과:', result);

    return NextResponse.json({ 
      success: true, 
      stats: result 
    });

  } catch (error) {
    console.error('❌ 월별 통계 조회 오류:', error);
    return NextResponse.json(
      { 
        message: '월별 통계 조회 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

// 🔥 calculateMonthlyStats 함수 내부 또는 외부에 추가
// 🔥 calculateRevenueAnalysis 함수를 완전히 교체
function calculateRevenueAnalysis(patients: any[]) {
  console.log(`🔍 매출 현황 분석 시작 - 총 환자 수: ${patients.length}명`);
  
  // 🔥 1. 달성매출군 - 치료시작한 환자들
  const achievedPatients = patients.filter(p => 
    p.visitConfirmed === true && p.postVisitStatus === '치료시작'
  );
  
  const achievedAmount = achievedPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  console.log(`✅ 달성매출: ${achievedPatients.length}명, ${achievedAmount.toLocaleString()}원`);
  
  // 🔥 2. 잠재매출군 - 아직 진행 중인 환자들 (치료시작 제외)
  // 2-1. 상담진행중: 콜백필요, 잠재고객, 예약확정 (치료시작 제외)
  const consultationOngoingPatients = patients.filter(p => 
    ['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
    !p.isCompleted &&
    p.postVisitStatus !== '치료시작' // 🔥 치료시작 제외 추가
  );

  const consultationOngoingAmount = consultationOngoingPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);

  // 2-2. 내원관리중: 치료동의, 재콜백필요, 상태미설정 (내원확정된 환자 중 치료시작 제외)
  const visitManagementPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작' && // 이미 있음
    p.postVisitStatus !== '종결' &&
    !p.isCompleted
  );
  
  const visitManagementAmount = visitManagementPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const totalPotentialPatients = consultationOngoingPatients.length + visitManagementPatients.length;
  const totalPotentialAmount = consultationOngoingAmount + visitManagementAmount;
  
  console.log(`⏳ 잠재매출: ${totalPotentialPatients}명 (상담진행중 ${consultationOngoingPatients.length}명 + 내원관리중 ${visitManagementPatients.length}명), ${totalPotentialAmount.toLocaleString()}원`);
  
  // 🔥 3. 손실매출군 - 확실히 놓친 환자들 (치료시작 제외)
  // 3-1. 상담단계 손실: 종결, 부재중 (치료시작 제외)
  const consultationLostPatients = patients.filter(p => 
    (p.status === '종결' || p.status === '부재중') || 
    (p.isCompleted === true && !p.visitConfirmed)
  );
  
  const consultationLostAmount = consultationLostPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  // 3-2. 내원후 손실: 내원후 종결 (치료시작 제외)
  const visitLostPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus === '종결'
  );
  
  const visitLostAmount = visitLostPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const totalLostPatients = consultationLostPatients.length + visitLostPatients.length;
  const totalLostAmount = consultationLostAmount + visitLostAmount;
  
  console.log(`❌ 손실매출: ${totalLostPatients}명 (상담손실 ${consultationLostPatients.length}명 + 내원후손실 ${visitLostPatients.length}명), ${totalLostAmount.toLocaleString()}원`);
  
  // 🔥 4. 전체 요약 계산
  const totalInquiries = patients.length;
  const totalPotentialAmountAll = achievedAmount + totalPotentialAmount + totalLostAmount;
  
  const achievedPercentage = totalInquiries > 0 ? Math.round((achievedPatients.length / totalInquiries) * 100) : 0;
  const potentialPercentage = totalInquiries > 0 ? Math.round((totalPotentialPatients / totalInquiries) * 100) : 0;
  const lostPercentage = totalInquiries > 0 ? Math.round((totalLostPatients / totalInquiries) * 100) : 0;
  
  const achievementRate = totalPotentialAmountAll > 0 ? Math.round((achievedAmount / totalPotentialAmountAll) * 100) : 0;
  const potentialGrowth = achievedAmount > 0 ? Math.round((totalPotentialAmount / achievedAmount) * 100) : 0;
  
  console.log(`💰 총 잠재매출: ${totalPotentialAmountAll.toLocaleString()}원, 달성률: ${achievementRate}%, 잠재성장률: ${potentialGrowth}%`);
  
  return {
    achievedRevenue: {
      patients: achievedPatients.length,
      amount: achievedAmount,
      percentage: achievedPercentage
    },
    potentialRevenue: {
      consultation: {
        patients: consultationOngoingPatients.length,
        amount: consultationOngoingAmount
      },
      visitManagement: {
        patients: visitManagementPatients.length,
        amount: visitManagementAmount
      },
      totalPatients: totalPotentialPatients,
      totalAmount: totalPotentialAmount,
      percentage: potentialPercentage
    },
    lostRevenue: {
      consultation: {
        patients: consultationLostPatients.length,
        amount: consultationLostAmount
      },
      visitManagement: {
        patients: visitLostPatients.length,
        amount: visitLostAmount
      },
      totalPatients: totalLostPatients,
      totalAmount: totalLostAmount,
      percentage: lostPercentage
    },
    summary: {
      totalInquiries,
      totalPotentialAmount: totalPotentialAmountAll,
      achievementRate,
      potentialGrowth
    }
  };
}

// 🔥 환자 견적 금액 계산 헬퍼 함수 추가
function getPatientEstimatedAmount(patient: any): number {
  let estimatedAmount = 0;
  
  // 1. 내원 후 상담 정보의 견적이 있는 경우 (우선순위 1)
  if (patient.postVisitConsultation?.estimateInfo) {
    const estimate = patient.postVisitConsultation.estimateInfo;
    
    // 할인가 > 정가 순서로 적용
    if (estimate.discountPrice && estimate.discountPrice > 0) {
      estimatedAmount = estimate.discountPrice;
    } else if (estimate.regularPrice && estimate.regularPrice > 0) {
      estimatedAmount = estimate.regularPrice;
    }
  }
  
  // 2. 기존 상담 정보의 견적이 있는 경우 (우선순위 2, 호환성 유지)
  else if (patient.consultation?.estimatedAmount) {
    estimatedAmount = patient.consultation.estimatedAmount;
  }
  
  // 3. 직접 입력된 치료금액이 있는 경우 (우선순위 3, 호환성 유지)
  else if (patient.treatmentCost && patient.treatmentCost > 0) {
    estimatedAmount = patient.treatmentCost;
  }
  
  return estimatedAmount;
}

// 🔥 월별 통계 계산 함수 - 프론트엔드와 동일한 결제금액 계산 로직 적용 + 손실 분석 추가
function calculateMonthlyStats(patients: any[]): MonthlyStats {
  const totalInquiries = patients.length;
  
  console.log(`🔍 통계 계산 시작 - 총 환자 수: ${totalInquiries}명`);
  
  // 인바운드/아웃바운드 구분
  const inboundCalls = patients.filter(p => p.consultationType === 'inbound').length;
  const outboundCalls = patients.filter(p => p.consultationType === 'outbound').length;
  const returningCalls = patients.filter(p => p.consultationType === 'returning').length;
  
  console.log(`📞 인바운드: ${inboundCalls}건, 아웃바운드: ${outboundCalls}건`);
  
  // 예약 환자 (예약확정 상태)
  const appointmentPatients = patients.filter(p => p.status === '예약확정').length;
  const appointmentRate = totalInquiries > 0 ? (appointmentPatients / totalInquiries) * 100 : 0;
  
  console.log(`📋 예약확정 환자: ${appointmentPatients}명, 예약전환율: ${appointmentRate.toFixed(1)}%`);
  
  // 내원 환자 (visitConfirmed가 true인 환자)
  const visitedPatients = patients.filter(p => p.visitConfirmed === true).length;
  
  // 내원 전환율 계산 (신규문의 기준)
  const visitRate = totalInquiries > 0 ? (visitedPatients / totalInquiries) * 100 : 0;
  
  console.log(`🏥 내원 환자: ${visitedPatients}명, 내원전환율: ${visitRate.toFixed(1)}%`);
  
  // 🔥 결제 정보 계산 - 프론트엔드와 동일한 로직 적용
  const treatmentStartedPatients = patients.filter(p => {
    const isTreatmentStarted = p.visitConfirmed === true && p.postVisitStatus === '치료시작';
    
    if (isTreatmentStarted) {
      console.log(`💰 치료시작 환자: ${p.name}, postVisitStatus: ${p.postVisitStatus}`);
    }
    
    return isTreatmentStarted;
  });
  
  const paymentPatients = treatmentStartedPatients.length;

  // 🔥 🔥 🔥 여기에 디버깅 코드 추가! 🔥 🔥 🔥
  console.log('🚨🚨🚨 월별 보고서 API 호출됨!!! 🚨🚨🚨');
  console.log('\n=== 🔍 치료금액 계산 상세 분석 ===');
  console.log(`치료시작 환자 수: ${treatmentStartedPatients.length}명`);

  let calculationDetails: { name: any; amount: number; source: string; }[] = [];
  let totalDebugAmount = 0;

  treatmentStartedPatients.forEach((p, index) => {
    const estimateInfo = p.postVisitConsultation?.estimateInfo;
    const discountPrice = estimateInfo?.discountPrice;
    const regularPrice = estimateInfo?.regularPrice;
    
    console.log(`\n${index + 1}. 환자: ${p.name}`);
    console.log(`  - postVisitConsultation 존재: ${!!p.postVisitConsultation}`);
    console.log(`  - estimateInfo 존재: ${!!estimateInfo}`);
    console.log(`  - discountPrice: ${discountPrice} (타입: ${typeof discountPrice})`);
    console.log(`  - regularPrice: ${regularPrice} (타입: ${typeof regularPrice})`);
    
    let finalAmount = 0;
    let source = '';
    
    if (estimateInfo) {
      if (discountPrice && discountPrice > 0) {
        finalAmount = Number(discountPrice);
        source = 'discountPrice';
      } else if (regularPrice && regularPrice > 0) {
        finalAmount = Number(regularPrice);
        source = 'regularPrice';
      }
    }
    
    console.log(`  - 최종 계산 금액: ${finalAmount.toLocaleString()}원 (출처: ${source})`);
    
    calculationDetails.push({
      name: p.name,
      amount: finalAmount,
      source
    });
    
    totalDebugAmount += finalAmount;
  });

  console.log('\n=== 💰 최종 합계 ===');
  console.log(`총 치료금액: ${totalDebugAmount.toLocaleString()}원`);
  console.log(`환자별 상세:`);
  calculationDetails.forEach((detail, index) => {
    console.log(`  ${index + 1}. ${detail.name}: ${detail.amount.toLocaleString()}원 (${detail.source})`);
  });
  console.log('========================\n');
  // 🔥 🔥 🔥 디버깅 코드 끝 🔥 🔥 🔥

  
  // 🔥 🔥 🔥 총 치료금액 계산 - 프론트엔드와 완전히 동일한 로직
  const totalPayment = treatmentStartedPatients.reduce((sum, p) => {
    let finalAmount = 0;
    
    if (p.postVisitConsultation && p.postVisitConsultation.estimateInfo) {
      const estimate = p.postVisitConsultation.estimateInfo;
      
      // 🔥 할인가 > 정가 > 0 순서로 우선순위 적용 (프론트엔드와 동일)
      if (estimate.discountPrice && estimate.discountPrice > 0) {
        // 할인가가 있으면 할인가 사용
        finalAmount = estimate.discountPrice;
        console.log(`💰 ${p.name} - 할인가 적용: ${finalAmount.toLocaleString()}원`);
      } else if (estimate.regularPrice && estimate.regularPrice > 0) {
        // 할인가가 없고 정가가 있으면 정가 사용
        finalAmount = estimate.regularPrice;
        console.log(`💰 ${p.name} - 정가 적용: ${finalAmount.toLocaleString()}원`);
      } else {
        console.log(`⚠️ ${p.name} - 치료금액 정보 없음`);
      }
    } else {
      console.log(`⚠️ ${p.name} - 견적 정보 없음`);
    }
    
    return sum + finalAmount;
  }, 0);

  // 🔥 환자별 상담 내용 요약 생성 - 기존 타입 호환성 유지하면서 새 기능 추가
  const patientConsultations: PatientConsultationSummary[] = patients
    .map(p => {
      const consultation = p.consultation;
      const postVisitConsultation = p.postVisitConsultation;
      const callbackHistory = p.callbackHistory || [];
      
      // 🔥 전화상담 내용 추출 - 더 관대한 조건
      const phoneDiscomfort = consultation?.treatmentPlan || '';
      const phoneConsultationNotes = consultation?.consultationNotes || '';
      const visitFirstContent = postVisitConsultation?.firstVisitConsultationContent || '';
      
      // 🔥 통합된 상담내용 생성
      const combinedContent: string[] = [];
      
      // 🔥 전화상담 내용 추가 - 기존 로직
      if (phoneDiscomfort || phoneConsultationNotes) {
        const phoneContent = [];
        if (phoneConsultationNotes) phoneContent.push(`[상담메모] ${phoneConsultationNotes}`);
        
        if (phoneContent.length > 0) {
          combinedContent.push(`📞 전화상담:\n${phoneContent.join('\n')}`);
        }
      }

    // 🔥 콜백 기록 추가 (전화상담 단계의 콜백들)
    const phoneCallbacks = callbackHistory.filter((cb: any) => 
      !cb.isVisitManagementCallback && 
      cb.notes && 
      cb.notes.trim() !== '' &&
      cb.status === '완료'
    ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    phoneCallbacks.forEach((callback: any, index: number) => {
      const callbackNum = index + 1;
      const callbackDate = new Date(callback.date).toLocaleDateString('ko-KR', {
        year: '2-digit',
        month: '2-digit', 
        day: '2-digit'
      }).replace(/\. /g, '.').replace(/\.$/, '');
      
      if (!combinedContent.length) {
        combinedContent.push(`📞 전화상담:\n[상담관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`);
      } else {
        const lastIndex = combinedContent.length - 1;
        combinedContent[lastIndex] += `\n[상담관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`;
      }
    });      
    
    // 🔥 내원상담 내용 추가 - 기존 로직
    if (visitFirstContent) {
      combinedContent.push(`🏥 내원상담:\n[첫 상담] ${visitFirstContent}`);
      
      // 내원 후 콜백 기록 추가
      const visitCallbacks = callbackHistory.filter((cb: any) => 
        cb.isVisitManagementCallback && 
        cb.notes && 
        cb.notes.trim() !== '' &&
        cb.status === '완료'
      ).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      visitCallbacks.forEach((callback: any, index: number) => {
        const callbackNum = index + 1;
        const callbackDate = new Date(callback.date).toLocaleDateString('ko-KR', {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
        
        const lastIndex = combinedContent.length - 1;
        combinedContent[lastIndex] += `\n[내원관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`;
      });
    }
    
    // 🔥 핵심 수정: 상담내용이 없어도 환자 정보는 표시
    const fullCombinedContent = combinedContent.join('\n\n');
    const summarizedContent = fullCombinedContent.length > 100 ? 
      fullCombinedContent.substring(0, 100) + '...' : 
      fullCombinedContent;
    
    // 🔥 견적금액 우선순위: 내원상담 > 전화상담
    const visitAmount = postVisitConsultation?.estimateInfo?.discountPrice || 
                      postVisitConsultation?.estimateInfo?.regularPrice || 0;
    const phoneAmount = consultation?.estimatedAmount || 0;
    const finalAmount = visitAmount || phoneAmount;
    
    const result: PatientConsultationSummary = {
      _id: p._id,
      name: p.name,
      age: p.age,
      interestedServices: p.interestedServices || [],
      discomfort: truncateText(phoneDiscomfort, 50),
      // 🔥 핵심: 빈 내용이어도 "상담내용 없음"으로 표시하여 환자 포함
      consultationSummary: summarizedContent || '상담내용 없음',
      estimatedAmount: finalAmount,
      estimateAgreed: consultation?.estimateAgreed || false,
      fullDiscomfort: phoneDiscomfort,
      // 🔥 핵심: 빈 내용이어도 "상담내용 없음"으로 표시
      fullConsultation: fullCombinedContent || '상담내용 없음',
      callInDate: p.callInDate,
      hasPhoneConsultation: !!(phoneDiscomfort || phoneConsultationNotes),
      hasVisitConsultation: !!visitFirstContent,
      visitAmount: visitAmount,
      phoneAmount: phoneAmount,
      postVisitStatus: p.postVisitStatus,
      visitConfirmed: p.visitConfirmed,
      status: p.status,
      isCompleted: p.isCompleted,
      consultationType: p.consultationType,
      consultationStages: {
        phone: {
          hasContent: !!(phoneDiscomfort || phoneConsultationNotes),
          discomfort: phoneDiscomfort,
          notes: phoneConsultationNotes,
          amount: phoneAmount,
          agreed: consultation?.estimateAgreed || false
        },
        visit: {
          hasContent: !!visitFirstContent,
          firstVisitContent: visitFirstContent,
          amount: visitAmount,
          status: p.postVisitStatus
        }
      },
      visitConsultation: undefined,
      phoneConsultation: undefined
    };
    
    return result;
  })
   .sort((a, b) => new Date(b.callInDate || '').getTime() - new Date(a.callInDate || '').getTime());

  
  // 결제 전환율 계산 (신규문의 기준)
  const paymentRate = totalInquiries > 0 ? (paymentPatients / totalInquiries) * 100 : 0;
  
  console.log(`💰 치료시작 환자: ${paymentPatients}명, 총 치료금액: ${totalPayment.toLocaleString()}원`);
  console.log(`📊 결제전환율: ${paymentRate.toFixed(1)}%`);
  
  // 평균 연령 계산 (age 필드 활용)
  const patientsWithAge = patients.filter(p => p.age && p.age > 0);
  const averageAge = patientsWithAge.length > 0 
    ? patientsWithAge.reduce((sum, p) => sum + p.age, 0) / patientsWithAge.length 
    : 34.2; // 기본값
  
  // 🔥 지역별 통계 수정 - 휴대폰 번호는 지역 추정에서 제외
  const regionCounts: { [key: string]: number } = {};
  patients.forEach(p => {
    let region: string;
    
    if (p.region && p.region.province) {
      // region 필드가 있는 경우 (완벽한 케이스)
      region = p.region.city 
        ? `${p.region.province} ${p.region.city}`
        : p.region.province;
    } else if (p.phoneNumber && !p.phoneNumber.replace(/[^0-9]/g, '').startsWith('010')) {
      // 🔥 휴대폰 번호(010)가 아닌 경우만 지역 추정
      const estimatedRegion = estimateRegionFromPhone(p.phoneNumber);
      if (estimatedRegion === '기타 지역') {
        region = '지역정보 없음';
      } else {
        region = estimatedRegion;
      }
    } else {
      // 휴대폰 번호이거나 전화번호가 없는 경우
      region = '지역정보 없음';
    }
    
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });
  
  const regionStats = Object.entries(regionCounts)
    .map(([region, count]) => ({
      region,
      count,
      percentage: totalInquiries > 0 ? (count / totalInquiries) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // 상위 5개
  
  // 🔥 유입경로 통계 수정 - 실제 데이터 기반으로 처리
  const channelCounts: { [key: string]: number } = {};
  patients.forEach(p => {
    let channel: string;
    
    if (p.referralSource && p.referralSource.trim() !== '') {
      // referralSource가 있는 경우 (완벽한 케이스)
      channel = p.referralSource.trim();
    } else {
      // referralSource가 없는 경우 "유입경로 정보 없음"으로 처리
      channel = '유입경로 정보 없음';
    }
    
    channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  });
  
  const channelStats = Object.entries(channelCounts)
    .map(([channel, count]) => ({
      channel,
      count,
      percentage: totalInquiries > 0 ? (count / totalInquiries) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);

  // 🔥 새로 추가: 손실 분석 계산
  const lossAnalysis = calculateLossAnalysis(patients);
  
  console.log('🔥 손실 분석 결과:', lossAnalysis);

  const finalStats = {
    totalInquiries,
    inboundCalls,
    outboundCalls,
    returningCalls,
    appointmentPatients,
    appointmentRate: Math.round(appointmentRate * 10) / 10,
    visitedPatients,
    visitRate: Math.round(visitRate * 10) / 10,
    totalPayment,
    paymentPatients,
    paymentRate: Math.round(paymentRate * 10) / 10,
    averageAge: Math.round(averageAge * 10) / 10,
    regionStats,
    channelStats,
    lossAnalysis,
    revenueAnalysis: calculateRevenueAnalysis(patients), // 매출 현황 분석 추가
    patientConsultations
  };

  console.log('🎯 최종 통계 결과 (손실 분석 포함):', finalStats);
  
  return finalStats;
}

// 텍스트 자르기 헬퍼 함수
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 🔥 전화번호로 지역 추정 함수 수정 - 휴대폰 번호(010) 케이스 제거
function estimateRegionFromPhone(phoneNumber: string): string {
  const areaCode = phoneNumber.replace(/[^0-9]/g, '').slice(0, 3);
  
  switch (areaCode) {
    // 010 케이스 삭제 - 휴대폰은 지역과 무관
    case '02': return '서울특별시';
    case '031': return '경기도';
    case '032': return '인천광역시';
    case '033': return '강원도';
    case '041': return '충청남도';
    case '042': return '대전광역시';
    case '043': return '충청북도';
    case '044': return '세종특별자치시';
    case '051': return '부산광역시';
    case '052': return '울산광역시';
    case '053': return '대구광역시';
    case '054': return '경상북도';
    case '055': return '경상남도';
    case '061': return '전라남도';
    case '062': return '광주광역시';
    case '063': return '전라북도';
    case '064': return '제주특별자치도';
    default: return '기타 지역';
  }
}

// 변화율 계산 함수
function calculateChange(current: number, previous: number): ChangeIndicator {
  if (previous === 0) {
    return { value: current, type: current >= 0 ? 'increase' : 'decrease' };
  }
  
  const change = current - previous;
  return {
    value: Math.round(Math.abs(change) * 10) / 10,
    type: change >= 0 ? 'increase' : 'decrease'
  };
}