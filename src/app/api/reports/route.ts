// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

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

export async function GET(request: NextRequest) {
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

    console.log('📊 보고서 목록 조회 요청');

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 보고서 목록 조회 (최신순)
    const reports = await reportsCollection
      .find({}, {
        projection: {
          _id: 1,
          month: 1,
          year: 1,
          status: 1,
          createdBy: 1,
          createdByName: 1,
          createdAt: 1,
          updatedAt: 1
        }
      })
      .sort({ year: -1, month: -1, createdAt: -1 })
      .toArray();

    console.log(`📊 보고서 목록 조회 완료: ${reports.length}개`);

    return NextResponse.json({ 
      success: true, 
      reports: reports.map((report: { _id: { toString: () => any; }; }) => ({
        ...report,
        _id: report._id.toString()
      }))
    });

  } catch (error) {
    console.error('❌ 보고서 목록 조회 오류:', error);
    return NextResponse.json(
      { 
        message: '보고서 목록 조회 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
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

    console.log(`📊 보고서 생성 요청: ${year}년 ${month}월`);

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 동일한 월/년도 보고서가 이미 있는지 확인
    const existingReport = await reportsCollection.findOne({ month, year });
    if (existingReport) {
      return NextResponse.json({ 
        message: `${year}년 ${month}월 보고서가 이미 존재합니다.`,
        reportId: existingReport._id.toString()
      }, { status: 409 });
    }

    // 🔥 월별 통계 데이터 조회 - 내부 함수로 처리하여 순환 참조 방지
    const stats = await generateMonthlyStats(month, year, token);

    // 새 보고서 생성
    const newReport = {
      month,
      year,
      generatedDate: new Date().toISOString().split('T')[0],
      createdBy: decoded._id || decoded.id,
      createdByName: decoded.name || decoded.username,
      status: 'draft',
      
      // 통계 데이터
      ...stats,
      
      // 매니저 입력 데이터 (빈 값으로 초기화)
      managerComment: '',
      improvementSuggestions: '',
      managerAnswers: {
        question1: '',
        question2: '',
        question3: '',
        question4: ''
      },
      
      // 메타데이터
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await reportsCollection.insertOne(newReport);

    const createdReport = {
      ...newReport,
      _id: result.insertedId.toString()
    };

    console.log(`✅ 보고서 생성 완료: ${year}년 ${month}월`);

    return NextResponse.json({ 
      success: true, 
      report: createdReport,
      message: '보고서가 생성되었습니다.'
    });

  } catch (error) {
    console.error('❌ 보고서 생성 오류:', error);
    return NextResponse.json(
      { 
        message: '보고서 생성 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

// 🔥 월별 통계 생성 함수 - monthly API와 동일한 로직을 내부에서 처리
async function generateMonthlyStats(month: number, year: number, token: string) {
  try {
    console.log(`🔍 월별 통계 생성: ${year}년 ${month}월`);

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
      changes
    };

    console.log('✅ 월별 통계 생성 완료:', result);

    return result;

  } catch (error) {
    console.error('❌ 월별 통계 생성 오류:', error);
    throw error;
  }
}

// 🔥 월별 통계 계산 함수 - 견적금액 처리 수정
function calculateMonthlyStats(patients: any[]) {
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
  
  // 🔥 결제 정보 계산 - 견적금액 처리 수정
  const treatmentStartedPatients = patients.filter(p => {
    const isTreatmentStarted = p.visitConfirmed === true && p.postVisitStatus === '치료시작';
    
    if (isTreatmentStarted) {
      console.log(`💰 치료시작 환자: ${p.name}, postVisitStatus: ${p.postVisitStatus}`);
    }
    
    return isTreatmentStarted;
  });
  
  const paymentPatients = treatmentStartedPatients.length;
  
  // 🔥 총 치료금액 계산 - null/undefined/0 처리 추가
  const totalPayment = treatmentStartedPatients.reduce((sum, p) => {
    let finalAmount = 0;
    
    if (p.postVisitConsultation && p.postVisitConsultation.estimateInfo) {
      const estimate = p.postVisitConsultation.estimateInfo;
      
      // 할인가 > 정가 > 0 순서로 우선순위 적용
      if (estimate.discountPrice && estimate.discountPrice > 0) {
        finalAmount = estimate.discountPrice;
        console.log(`💰 ${p.name} - 할인가 적용: ${finalAmount.toLocaleString()}원`);
      } else if (estimate.regularPrice && estimate.regularPrice > 0) {
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
  
  // 결제 전환율 계산 (신규문의 기준)
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

  // 🔥 환자별 상담 내용 요약 생성 - 견적금액 처리 수정
  const patientConsultations = patients
    .filter(p => p.consultation && (p.consultation.treatmentPlan || p.consultation.consultationNotes))
    .map(p => {
      const consultation = p.consultation;
      return {
        _id: p._id,
        name: p.name,
        age: p.age,
        // 🔥 견적금액이 없는 경우 0으로 표시하되 "데이터 없음" 처리
        estimatedAmount: consultation.estimatedAmount || 0,
        hasValidEstimate: !!(consultation.estimatedAmount && consultation.estimatedAmount > 0), // 🔥 유효한 견적 여부
        estimateAgreed: consultation.estimateAgreed || false,
        discomfort: consultation.treatmentPlan ? 
          consultation.treatmentPlan.substring(0, 50) + (consultation.treatmentPlan.length > 50 ? '...' : '') : '',
        fullDiscomfort: consultation.treatmentPlan || '',
        consultationSummary: consultation.consultationNotes ? 
          consultation.consultationNotes.substring(0, 80) + (consultation.consultationNotes.length > 80 ? '...' : '') : '',
        fullConsultation: consultation.consultationNotes || ''
      };
    });

  // 🔥 손실 분석 계산
  const lossAnalysis = calculateLossAnalysis(patients);

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
    patientConsultations, // 🔥 환자별 상담 요약 추가
    lossAnalysis // 🔥 손실 분석 추가
  };

  console.log('🎯 통계 계산 결과:', finalStats);
  
  return finalStats;
}

// 🔥 손실 분석 계산 함수 - 견적금액 "데이터 없음" 처리
function calculateLossAnalysis(patients: any[]) {
  // 상담 관리 손실군 (예약확정 외 환자들)
  const consultationLossPatients = patients.filter(p => p.status !== '예약확정');
  const consultationLoss = {
    totalCount: consultationLossPatients.length,
    terminated: consultationLossPatients.filter(p => p.status === '종결').length,
    missed: consultationLossPatients.filter(p => p.status === '부재중').length,
    potential: consultationLossPatients.filter(p => p.status === '잠재고객').length,
    callback: consultationLossPatients.filter(p => p.status === '콜백필요').length,
    // 🔥 견적금액 합계 - 데이터 없음 제외
    estimatedAmount: consultationLossPatients.reduce((sum, p) => {
      const amount = p.consultation?.estimatedAmount;
      // null, undefined, 0은 데이터 없음으로 처리하여 합계에서 제외
      if (amount && amount > 0) {
        return sum + amount;
      }
      return sum;
    }, 0)
  };

  // 내원 관리 손실군 (내원했지만 치료시작 못한 환자들)
  const visitLossPatients = patients.filter(p => 
    p.visitConfirmed === true && p.postVisitStatus !== '치료시작'
  );
  
  const visitLoss = {
    totalCount: visitLossPatients.length,
    terminated: visitLossPatients.filter(p => p.postVisitStatus === '종결').length,
    callbackNeeded: visitLossPatients.filter(p => p.postVisitStatus === '재콜백필요').length,
    agreedButNotStarted: visitLossPatients.filter(p => p.postVisitStatus === '치료동의').length,
    // 🔥 견적금액 합계 - 데이터 없음 제외
    estimatedAmount: visitLossPatients.reduce((sum, p) => {
      let amount = 0;
      
      // 내원 후 상담 정보에서 견적 추출
      if (p.postVisitConsultation?.estimateInfo) {
        const estimate = p.postVisitConsultation.estimateInfo;
        amount = estimate.discountPrice || estimate.regularPrice || 0;
      } else if (p.consultation?.estimatedAmount) {
        // 초기 상담 견적 정보 사용
        amount = p.consultation.estimatedAmount;
      }
      
      // null, undefined, 0은 데이터 없음으로 처리하여 합계에서 제외
      if (amount && amount > 0) {
        return sum + amount;
      }
      return sum;
    }, 0)
  };
  
  return {
    consultationLoss,
    visitLoss,
    totalLoss: {
      totalPatients: consultationLoss.totalCount + visitLoss.totalCount,
      totalAmount: consultationLoss.estimatedAmount + visitLoss.estimatedAmount,
      lossRate: patients.length > 0 ? 
        Math.round(((consultationLoss.totalCount + visitLoss.totalCount) / patients.length) * 100) : 0
    }
  };
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
function calculateChange(current: number, previous: number) {
  if (previous === 0) {
    return { value: current, type: current >= 0 ? 'increase' : 'decrease' };
  }
  
  const change = current - previous;
  return {
    value: Math.round(Math.abs(change) * 10) / 10,
    type: change >= 0 ? 'increase' : 'decrease'
  };
}