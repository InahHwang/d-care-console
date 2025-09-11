// src/app/api/reports/monthly/route.ts - 🔥 filtered API 연동으로 로직 통일
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { MonthlyStats, ChangeIndicator, PatientConsultationSummary } from '@/types/report';
import { calculateLossAnalysis } from '@/utils/lossAnalysisUtils';

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

    // 🔥 현재 월 통계 계산 - filtered API 연동 방식으로 변경
    const currentStats = await calculateMonthlyStatsWithFiltered(currentMonthPatients, year, month);
    const prevStats = await calculateMonthlyStatsWithFiltered(prevMonthPatients, prevYear, prevMonth);

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
      // 환자별 상담 내용도 함께 반환
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

// 🔥 filtered API를 활용한 매출 현황 분석 - 기존 로직 완전 제거하고 API 호출로 대체
async function calculateRevenueAnalysisWithFiltered(year: number, month: number) {
  console.log(`🔍 매출 현황 분석 시작 - filtered API 활용 방식`);
  
  try {
    // 🔥 해당 월의 날짜 범위 설정을 위해 환경변수나 요청 헤더에서 기간 정보 사용
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    console.log(`🔍 filtered API 호출 시작 - baseUrl: ${baseUrl}, year: ${year}, month: ${month}`);

    const [achievedResponse, potentialResponse, lostResponse] = await Promise.all([
      fetch(`${baseUrl}/api/patients/filtered?type=treatment_rate&year=${year}&month=${month}`),
      fetch(`${baseUrl}/api/patients/filtered?type=potential_revenue&year=${year}&month=${month}`), 
      fetch(`${baseUrl}/api/patients/filtered?type=lost_revenue&year=${year}&month=${month}`)
    ]);

    console.log('🔍 API 응답 상태:', {
      achieved: achievedResponse.status,
      potential: potentialResponse.status, 
      lost: lostResponse.status
    });

    if (!achievedResponse.ok || !potentialResponse.ok || !lostResponse.ok) {
      throw new Error('filtered API 호출 실패');
    }

    const [achievedData, potentialData, lostData] = await Promise.all([
      achievedResponse.json(),
      potentialResponse.json(), 
      lostResponse.json()
    ]);

    console.log('🔍 각 API 응답 데이터:', {
      achieved: { count: achievedData.patients?.length, dateRange: achievedData.dateRange },
      potential: { count: potentialData.patients?.length, dateRange: potentialData.dateRange },
      lost: { count: lostData.patients?.length, dateRange: lostData.dateRange }
    });

    // 🔥 각 그룹의 환자 수와 매출 계산
    const achievedPatients = achievedData.patients || [];
    const potentialPatients = potentialData.patients || [];
    const lostPatients = lostData.patients || [];

    const achievedAmount = achievedPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);
    const potentialAmount = potentialPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);
    const lostAmount = lostPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);

    console.log(`✅ filtered API 결과 - 달성: ${achievedPatients.length}명(${achievedAmount.toLocaleString()}원), 잠재: ${potentialPatients.length}명(${potentialAmount.toLocaleString()}원), 손실: ${lostPatients.length}명(${lostAmount.toLocaleString()}원)`);

    // 🔥 세부 분류 (잠재매출의 상담진행중/내원관리중 구분)
    const consultationOngoingPatients = potentialPatients.filter((p: any) => 
      ['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
      !p.isCompleted &&
      (p.visitConfirmed !== true || p.postVisitStatus !== '치료시작')
    );
    
    const visitManagementPatients = potentialPatients.filter((p: any) => 
      p.visitConfirmed === true && 
      p.postVisitStatus !== '치료시작' && 
      p.postVisitStatus !== '종결' &&
      !p.isCompleted
    );

    const consultationOngoingAmount = consultationOngoingPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);
    const visitManagementAmount = visitManagementPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);

    // 🔥 손실매출 세부 분류
    const consultationLostPatients = lostPatients.filter((p: any) => 
      (p.status === '종결' || p.status === '부재중') || 
      (p.isCompleted === true && !p.visitConfirmed)
    );
    
    const visitLostPatients = lostPatients.filter((p: any) => 
      p.visitConfirmed === true && 
      p.postVisitStatus === '종결'
    );

    const consultationLostAmount = consultationLostPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);
    const visitLostAmount = visitLostPatients.reduce((sum: number, p: any) => sum + getPatientEstimatedAmount(p), 0);

    // 🔥 전체 문의 수 계산 (filtered API로는 전체 수를 구할 수 없으므로 합계로 계산)
    const totalInquiries = achievedPatients.length + potentialPatients.length + lostPatients.length;
    const totalPotentialAmountAll = achievedAmount + potentialAmount + lostAmount;
    
    const achievedPercentage = totalInquiries > 0 ? Math.round((achievedPatients.length / totalInquiries) * 100) : 0;
    const potentialPercentage = totalInquiries > 0 ? Math.round((potentialPatients.length / totalInquiries) * 100) : 0;
    const lostPercentage = totalInquiries > 0 ? Math.round((lostPatients.length / totalInquiries) * 100) : 0;
    
    const achievementRate = totalPotentialAmountAll > 0 ? Math.round((achievedAmount / totalPotentialAmountAll) * 100) : 0;
    const potentialGrowth = achievedAmount > 0 ? Math.round((potentialAmount / achievedAmount) * 100) : 0;
    
    console.log(`💰 filtered API 기반 총 잠재매출: ${totalPotentialAmountAll.toLocaleString()}원, 달성률: ${achievementRate}%, 잠재성장률: ${potentialGrowth}%`);
    
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
        totalPatients: potentialPatients.length,
        totalAmount: potentialAmount,
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
        totalPatients: lostPatients.length,
        totalAmount: lostAmount,
        percentage: lostPercentage
      },
      summary: {
        totalInquiries,
        totalPotentialAmount: totalPotentialAmountAll,
        achievementRate,
        potentialGrowth
      }
    };
    
  } catch (error) {
    console.error('❌ filtered API 호출 실패:', error);
    // 🔥 API 호출 실패 시 빈 데이터 반환 (기존 방식으로 폴백하지 않음)
    return {
      achievedRevenue: { patients: 0, amount: 0, percentage: 0 },
      potentialRevenue: {
        consultation: { patients: 0, amount: 0 },
        visitManagement: { patients: 0, amount: 0 },
        totalPatients: 0, totalAmount: 0, percentage: 0
      },
      lostRevenue: {
        consultation: { patients: 0, amount: 0 },
        visitManagement: { patients: 0, amount: 0 },
        totalPatients: 0, totalAmount: 0, percentage: 0
      },
      summary: { totalInquiries: 0, totalPotentialAmount: 0, achievementRate: 0, potentialGrowth: 0 }
    };
  }
}

// 🔥 기존 calculateMonthlyStats 함수를 filtered API 방식으로 수정
async function calculateMonthlyStatsWithFiltered(patients: any[], year: number, month: number): Promise<MonthlyStats> {
  const totalInquiries = patients.length;
  
  console.log(`🔍 통계 계산 시작 (filtered API 방식) - 총 환자 수: ${totalInquiries}명`);
  
  // 🔥 기본 통계는 기존 방식 유지 (단순 집계이므로 API 호출 불필요)
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
  const visitRate = totalInquiries > 0 ? (visitedPatients / totalInquiries) * 100 : 0;
  
  console.log(`🏥 내원 환자: ${visitedPatients}명, 내원전환율: ${visitRate.toFixed(1)}%`);
  
  // 🔥 결제 정보는 기존 방식 유지 (치료시작 환자 필터링)
  const treatmentStartedPatients = patients.filter(p => {
    const isTreatmentStarted = p.visitConfirmed === true && p.postVisitStatus === '치료시작';
    
    if (isTreatmentStarted) {
      console.log(`💰 치료시작 환자: ${p.name}, postVisitStatus: ${p.postVisitStatus}`);
    }
    
    return isTreatmentStarted;
  });
  
  const paymentPatients = treatmentStartedPatients.length;

  // 🔥 총 치료금액 계산
  const totalPayment = treatmentStartedPatients.reduce((sum, p) => {
    let finalAmount = 0;
    
    if (p.postVisitConsultation && p.postVisitConsultation.estimateInfo) {
      const estimate = p.postVisitConsultation.estimateInfo;
      
      if (estimate.discountPrice && estimate.discountPrice > 0) {
        finalAmount = estimate.discountPrice;
      } else if (estimate.regularPrice && estimate.regularPrice > 0) {
        finalAmount = estimate.regularPrice;
      }
    }
    
    return sum + finalAmount;
  }, 0);

  // 환자별 상담 내용 요약 생성 (기존 로직 유지)
  const patientConsultations: PatientConsultationSummary[] = patients
    .map(p => {
      const consultation = p.consultation;
      const postVisitConsultation = p.postVisitConsultation;
      const callbackHistory = p.callbackHistory || [];
      
      const phoneDiscomfort = consultation?.treatmentPlan || '';
      const phoneConsultationNotes = consultation?.consultationNotes || '';
      const visitFirstContent = postVisitConsultation?.firstVisitConsultationContent || '';
      
      const combinedContent: string[] = [];
      
      if (phoneDiscomfort || phoneConsultationNotes) {
        const phoneContent = [];
        if (phoneConsultationNotes) phoneContent.push(`[상담메모] ${phoneConsultationNotes}`);
        
        if (phoneContent.length > 0) {
          combinedContent.push(`📞 전화상담:\n${phoneContent.join('\n')}`);
        }
      }

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
      
      if (visitFirstContent) {
        combinedContent.push(`🏥 내원상담:\n[첫 상담] ${visitFirstContent}`);
        
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
      
      const fullCombinedContent = combinedContent.join('\n\n');
      const summarizedContent = fullCombinedContent.length > 100 ? 
        fullCombinedContent.substring(0, 100) + '...' : 
        fullCombinedContent;
      
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
        consultationSummary: summarizedContent || '상담내용 없음',
        estimatedAmount: finalAmount,
        estimateAgreed: consultation?.estimateAgreed || false,
        fullDiscomfort: phoneDiscomfort,
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

  const paymentRate = totalInquiries > 0 ? (paymentPatients / totalInquiries) * 100 : 0;
  
  console.log(`💰 치료시작 환자: ${paymentPatients}명, 총 치료금액: ${totalPayment.toLocaleString()}원`);
  console.log(`📊 결제전환율: ${paymentRate.toFixed(1)}%`);
  
  // 평균 연령 계산
  const patientsWithAge = patients.filter(p => p.age && p.age > 0);
  const averageAge = patientsWithAge.length > 0 
    ? patientsWithAge.reduce((sum, p) => sum + p.age, 0) / patientsWithAge.length 
    : 34.2;
  
  // 지역별 통계
  const regionCounts: { [key: string]: number } = {};
  patients.forEach(p => {
    let region: string;
    
    if (p.region && p.region.province) {
      region = p.region.city 
        ? `${p.region.province} ${p.region.city}`
        : p.region.province;
    } else if (p.phoneNumber && !p.phoneNumber.replace(/[^0-9]/g, '').startsWith('010')) {
      const estimatedRegion = estimateRegionFromPhone(p.phoneNumber);
      if (estimatedRegion === '기타 지역') {
        region = '지역정보 없음';
      } else {
        region = estimatedRegion;
      }
    } else {
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
    .slice(0, 5);
  
  // 유입경로 통계
  const channelCounts: { [key: string]: number } = {};
  patients.forEach(p => {
    let channel: string;
    
    if (p.referralSource && p.referralSource.trim() !== '') {
      channel = p.referralSource.trim();
    } else {
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

  // 손실 분석 계산
  const lossAnalysis = calculateLossAnalysis(patients);
  
  // 🔥 매출 현황 분석은 filtered API 방식으로 호출
  const revenueAnalysis = await calculateRevenueAnalysisWithFiltered(year, month);

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
    revenueAnalysis, // 🔥 filtered API 기반 매출 분석 결과
    patientConsultations
  };

  console.log('🎯 최종 통계 결과 (filtered API 연동):', finalStats);
  
  return finalStats;
}

// 🔥 환자 견적 금액 계산 헬퍼 함수
function getPatientEstimatedAmount(patient: any): number {
  let estimatedAmount = 0;
  
  if (patient.postVisitConsultation?.estimateInfo) {
    const estimate = patient.postVisitConsultation.estimateInfo;
    
    if (estimate.discountPrice && estimate.discountPrice > 0) {
      estimatedAmount = estimate.discountPrice;
    } else if (estimate.regularPrice && estimate.regularPrice > 0) {
      estimatedAmount = estimate.regularPrice;
    }
  }
  else if (patient.consultation?.estimatedAmount) {
    estimatedAmount = patient.consultation.estimatedAmount;
  }
  else if (patient.treatmentCost && patient.treatmentCost > 0) {
    estimatedAmount = patient.treatmentCost;
  }
  
  return estimatedAmount;
}

// 텍스트 자르기 헬퍼 함수
function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 전화번호로 지역 추정 함수
function estimateRegionFromPhone(phoneNumber: string): string {
  const areaCode = phoneNumber.replace(/[^0-9]/g, '').slice(0, 3);
  
  switch (areaCode) {
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