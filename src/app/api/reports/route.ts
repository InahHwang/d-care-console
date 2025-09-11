// src/app/api/reports/route.ts - 🔥 filtered API 직접 호출 방식으로 완전 통합
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

    // 🔥 월별 통계 데이터 조회 - filtered API 호출 방식으로 변경
    const stats = await generateMonthlyStatsWithFilteredAPI(month, year, token);

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
      
      // 원장님 피드백 배열 초기화
      directorFeedbacks: [],
      
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

// 🔥 filtered API를 직접 호출하여 월별 통계 생성
async function generateMonthlyStatsWithFilteredAPI(month: number, year: number, token: string) {
  try {
    console.log(`🔍 월별 통계 생성 (filtered API 방식): ${year}년 ${month}월`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 해당 월과 이전 월 날짜 범위 계산
    const startDateStr = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDateStr = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`;
    
    const prevMonth = month - 1 === 0 ? 12 : month - 1;
    const prevYear = month - 1 === 0 ? year - 1 : year;
    const prevStartDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
    const prevEndDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${new Date(prevYear, prevMonth, 0).getDate().toString().padStart(2, '0')}`;

    console.log(`📅 현재월: ${startDateStr} ~ ${endDateStr}`);
    console.log(`📅 이전월: ${prevStartDateStr} ~ ${prevEndDateStr}`);

    // 현재 월 환자 데이터 직접 조회 (기본 통계용)
    const currentMonthPatients = await patientsCollection.find({
      callInDate: { $gte: startDateStr, $lte: endDateStr }
    }).toArray();

    const prevMonthPatients = await patientsCollection.find({
      callInDate: { $gte: prevStartDateStr, $lte: prevEndDateStr }
    }).toArray();

    console.log(`📊 현재월 환자: ${currentMonthPatients.length}명, 이전월: ${prevMonthPatients.length}명`);

    // 기본 통계는 기존 방식으로 계산 (단순 집계)
    const currentBasicStats = calculateBasicStats(currentMonthPatients);
    const prevBasicStats = calculateBasicStats(prevMonthPatients);

    // 매출 현황 분석은 filtered API 직접 호출
    const revenueAnalysis = await getRevenueAnalysisFromFilteredAPI(year, month);

    // 기존 손실 분석 계산 (호환성 유지)
    const lossAnalysis = calculateLossAnalysis(currentMonthPatients);

    // 환자별 상담 내용 요약 생성
    const patientConsultations = generatePatientConsultations(currentMonthPatients);

    // 지역별/유입경로 통계
    const regionStats = calculateRegionStats(currentMonthPatients);
    const channelStats = calculateChannelStats(currentMonthPatients);

    // 변화율 계산
    const changes = {
      totalInquiries: calculateChange(currentBasicStats.totalInquiries, prevBasicStats.totalInquiries),
      inboundCalls: calculateChange(currentBasicStats.inboundCalls, prevBasicStats.inboundCalls),
      outboundCalls: calculateChange(currentBasicStats.outboundCalls, prevBasicStats.outboundCalls),
      returningCalls: calculateChange(currentBasicStats.returningCalls, prevBasicStats.returningCalls),
      appointmentPatients: calculateChange(currentBasicStats.appointmentPatients, prevBasicStats.appointmentPatients),
      appointmentRate: calculateChange(currentBasicStats.appointmentRate, prevBasicStats.appointmentRate),
      visitedPatients: calculateChange(currentBasicStats.visitedPatients, prevBasicStats.visitedPatients),
      visitRate: calculateChange(currentBasicStats.visitRate, prevBasicStats.visitRate),
      paymentPatients: calculateChange(currentBasicStats.paymentPatients, prevBasicStats.paymentPatients),
      paymentRate: calculateChange(currentBasicStats.paymentRate, prevBasicStats.paymentRate),
      totalPayment: calculateChange(currentBasicStats.totalPayment, prevBasicStats.totalPayment)
    };

    const result = {
      ...currentBasicStats,
      changes,
      regionStats,
      channelStats,
      patientConsultations,
      lossAnalysis,
      revenueAnalysis // 🔥 filtered API에서 가져온 매출 현황 분석
    };

    console.log('✅ 월별 통계 생성 완료 (filtered API 연동):', result);

    return result;

  } catch (error) {
    console.error('❌ 월별 통계 생성 오류 (filtered API):', error);
    throw error;
  }
}

// 🔥 filtered API를 직접 호출하여 매출 현황 분석 데이터 가져오기
async function getRevenueAnalysisFromFilteredAPI(year: number, month: number) {
  try {
    console.log(`🔍 매출 현황 분석 - filtered API 호출: ${year}년 ${month}월`);
    
    // 내부 filtered API 로직을 직접 호출 (HTTP 요청 대신)
    const { db } = await connectToDatabase();
    
    // 날짜 범위 계산
    const startOfMonthString = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonthString = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    
    console.log(`📅 매출 분석 날짜 범위: ${startOfMonthString} ~ ${endOfMonthString}`);

    // 🔥 1. 달성매출 환자들 (치료시작) - filtered API와 완전 동일
    const achievedPatients = await db.collection('patients').find({
      callInDate: { $gte: startOfMonthString, $lte: endOfMonthString },
      postVisitStatus: '치료시작'
    }).toArray();

    // 🔥 2. 잠재매출 환자들 - filtered API와 완전 동일
    const potentialPatients = await db.collection('patients').find({
      callInDate: { $gte: startOfMonthString, $lte: endOfMonthString },
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
    }).toArray();

    // 🔥 3. 손실매출 환자들 - filtered API와 완전 동일
    const lostPatients = await db.collection('patients').find({
      callInDate: { $gte: startOfMonthString, $lte: endOfMonthString },
      $or: [
        { status: { $in: ['종결', '부재중'] } },
        { isCompleted: true },
        { 
          visitConfirmed: true,
          postVisitStatus: '종결'
        }
      ]
    }).toArray();

    console.log(`📊 filtered API 결과: 달성 ${achievedPatients.length}명, 잠재 ${potentialPatients.length}명, 손실 ${lostPatients.length}명`);

    // 견적금액 계산
    const achievedAmount = achievedPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);
    const potentialAmount = potentialPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);
    const lostAmount = lostPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);

    // 세부 분류 - filtered API와 완전히 동일하게 수정
    const consultationOngoingPatients = potentialPatients.filter(p => 
      ['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
      !p.isCompleted &&
      p.visitConfirmed !== true // 🔥 아직 내원 안한 환자만 (filtered API와 동일)
    );
    
    const visitManagementPatients = potentialPatients.filter(p => 
      p.visitConfirmed === true && 
      p.postVisitStatus !== '치료시작' && 
      p.postVisitStatus !== '종결' &&
      !p.isCompleted
    );

    const consultationLostPatients = lostPatients.filter(p => 
      (p.status === '종결' || p.status === '부재중') || 
      (p.isCompleted === true && !p.visitConfirmed)
    );
    
    const visitLostPatients = lostPatients.filter(p => 
      p.visitConfirmed === true && 
      p.postVisitStatus === '종결'
    );

    const consultationOngoingAmount = consultationOngoingPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);
    const visitManagementAmount = visitManagementPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);
    const consultationLostAmount = consultationLostPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);
    const visitLostAmount = visitLostPatients.reduce((sum, p) => sum + getPatientEstimatedAmount(p), 0);

    // 전체 통계 계산
    const totalInquiries = achievedPatients.length + potentialPatients.length + lostPatients.length;
    const totalPotentialAmountAll = achievedAmount + potentialAmount + lostAmount;
    
    const achievedPercentage = totalInquiries > 0 ? Math.round((achievedPatients.length / totalInquiries) * 100) : 0;
    const potentialPercentage = totalInquiries > 0 ? Math.round((potentialPatients.length / totalInquiries) * 100) : 0;
    const lostPercentage = totalInquiries > 0 ? Math.round((lostPatients.length / totalInquiries) * 100) : 0;
    
    const achievementRate = totalPotentialAmountAll > 0 ? Math.round((achievedAmount / totalPotentialAmountAll) * 100) : 0;
    const potentialGrowth = achievedAmount > 0 ? Math.round((potentialAmount / achievedAmount) * 100) : 0;

    console.log(`💰 매출 분석 결과: 달성 ${achievedAmount.toLocaleString()}원, 잠재 ${potentialAmount.toLocaleString()}원, 손실 ${lostAmount.toLocaleString()}원`);

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
    console.error('❌ 매출 현황 분석 오류 (filtered API):', error);
    // 오류 시 빈 데이터 반환
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

// 기본 통계 계산 함수 (매출 분석 제외)
function calculateBasicStats(patients: any[]) {
  const totalInquiries = patients.length;
  
  // 인바운드/아웃바운드/구신환 구분
  const inboundCalls = patients.filter(p => p.consultationType === 'inbound').length;
  const outboundCalls = patients.filter(p => p.consultationType === 'outbound').length;
  const returningCalls = patients.filter(p => p.consultationType === 'returning').length;
  
  // 예약 환자
  const appointmentPatients = patients.filter(p => p.status === '예약확정').length;
  const appointmentRate = totalInquiries > 0 ? (appointmentPatients / totalInquiries) * 100 : 0;
  
  // 내원 환자
  const visitedPatients = patients.filter(p => p.visitConfirmed === true).length;
  const visitRate = totalInquiries > 0 ? (visitedPatients / totalInquiries) * 100 : 0;
  
  // 치료시작 환자 및 치료금액
  const treatmentStartedPatients = patients.filter(p => 
    p.visitConfirmed === true && p.postVisitStatus === '치료시작'
  );
  
  const paymentPatients = treatmentStartedPatients.length;
  const totalPayment = treatmentStartedPatients.reduce((sum, p) => {
    let finalAmount = 0;
    if (p.postVisitConsultation?.estimateInfo) {
      const estimate = p.postVisitConsultation.estimateInfo;
      if (estimate.discountPrice && estimate.discountPrice > 0) {
        finalAmount = estimate.discountPrice;
      } else if (estimate.regularPrice && estimate.regularPrice > 0) {
        finalAmount = estimate.regularPrice;
      }
    }
    return sum + finalAmount;
  }, 0);
  
  const paymentRate = totalInquiries > 0 ? (paymentPatients / totalInquiries) * 100 : 0;
  
  // 평균 연령
  const patientsWithAge = patients.filter(p => p.age && p.age > 0);
  const averageAge = patientsWithAge.length > 0 
    ? patientsWithAge.reduce((sum, p) => sum + p.age, 0) / patientsWithAge.length 
    : 34.2;

  return {
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
    averageAge: Math.round(averageAge * 10) / 10
  };
}

// 지역별 통계 계산
function calculateRegionStats(patients: any[]) {
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
  
  return Object.entries(regionCounts)
    .map(([region, count]) => ({
      region,
      count,
      percentage: patients.length > 0 ? (count / patients.length) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// 유입경로 통계 계산
function calculateChannelStats(patients: any[]) {
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
  
  return Object.entries(channelCounts)
    .map(([channel, count]) => ({
      channel,
      count,
      percentage: patients.length > 0 ? (count / patients.length) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);
}

// 환자별 상담 내용 요약 생성
function generatePatientConsultations(patients: any[]) {
  return patients
    .filter(p => p.consultation && (p.consultation.treatmentPlan || p.consultation.consultationNotes))
    .map(p => {
      const consultation = p.consultation;
      
      // 견적금액 계산 로직
      let estimatedAmount = 0;
      let visitAmount = 0;
      let phoneAmount = consultation.estimatedAmount || 0;
      
      // 내원 후 상담 정보의 견적이 있는 경우 (우선순위 1)
      if (p.postVisitConsultation?.estimateInfo) {
        const estimate = p.postVisitConsultation.estimateInfo;
        
        if (estimate.discountPrice && estimate.discountPrice > 0) {
          visitAmount = estimate.discountPrice;
          estimatedAmount = estimate.discountPrice;
        } else if (estimate.regularPrice && estimate.regularPrice > 0) {
          visitAmount = estimate.regularPrice;
          estimatedAmount = estimate.regularPrice;
        }
      }
      // 기존 상담 정보의 견적이 있는 경우 (우선순위 2)
      else if (consultation.estimatedAmount) {
        estimatedAmount = consultation.estimatedAmount;
      }
      
      return {
        _id: p._id,
        name: p.name,
        age: p.age,
        estimatedAmount,
        estimateAgreed: consultation.estimateAgreed || false,
        discomfort: consultation.treatmentPlan ? 
          consultation.treatmentPlan.substring(0, 50) + (consultation.treatmentPlan.length > 50 ? '...' : '') : '',
        fullDiscomfort: consultation.treatmentPlan || '',
        consultationSummary: consultation.consultationNotes ? 
          consultation.consultationNotes.substring(0, 80) + (consultation.consultationNotes.length > 80 ? '...' : '') : '',
        fullConsultation: consultation.consultationNotes || '',
        
        // 필수 필드들
        consultationType: p.consultationType || 'inbound',
        callInDate: p.callInDate,
        status: p.status,
        visitConfirmed: p.visitConfirmed,
        postVisitStatus: p.postVisitStatus,
        isCompleted: p.isCompleted,
        interestedServices: p.interestedServices,
        
        // 추가 필드들
        hasPhoneConsultation: !!(consultation.consultationNotes),
        hasVisitConsultation: !!(p.postVisitConsultation),
        phoneAmount,
        visitAmount
      };
    });
}

// 기존 손실 분석 계산 함수 (호환성 유지)
function calculateLossAnalysis(patients: any[]) {
  // 상담 관리 손실군 (예약확정 외 환자들)
  const consultationLossPatients = patients.filter(p => 
    p.status !== '예약확정' && p.status !== 'VIP'
  );
  
  const consultationLoss = {
    terminated: consultationLossPatients.filter(p => p.status === '종결').length,
    missed: consultationLossPatients.filter(p => p.status === '부재중').length,
    potential: consultationLossPatients.filter(p => p.status === '잠재고객').length,
    callback: consultationLossPatients.filter(p => p.status === '콜백필요').length,
    totalCount: consultationLossPatients.length,
    // 견적금액 합계 - 데이터 없음 제외
    estimatedAmount: consultationLossPatients.reduce((sum, p) => {
      const amount = getPatientEstimatedAmount(p);
      return sum + amount;
    }, 0)
  };

  // 내원 관리 손실군 (내원했지만 치료시작 못한 환자들)
  const visitLossPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작'
  );
  
  const visitLoss = {
    terminated: visitLossPatients.filter(p => p.postVisitStatus === '종결').length,
    callbackNeeded: visitLossPatients.filter(p => p.postVisitStatus === '재콜백필요').length,
    agreedButNotStarted: visitLossPatients.filter(p => p.postVisitStatus === '치료동의').length,
    totalCount: visitLossPatients.length,
    // 견적금액 합계
    estimatedAmount: visitLossPatients.reduce((sum, p) => {
      const amount = getPatientEstimatedAmount(p);
      return sum + amount;
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

// 환자 견적 금액 계산
function getPatientEstimatedAmount(patient: any): number {
  let estimatedAmount = 0;
  
  if (patient.postVisitConsultation?.estimateInfo) {
    const estimate = patient.postVisitConsultation.estimateInfo;
    if (estimate.discountPrice && estimate.discountPrice > 0) {
      estimatedAmount = estimate.discountPrice;
    } else if (estimate.regularPrice && estimate.regularPrice > 0) {
      estimatedAmount = estimate.regularPrice;
    }
  } else if (patient.consultation?.estimatedAmount) {
    estimatedAmount = patient.consultation.estimatedAmount;
  } else if (patient.treatmentCost && patient.treatmentCost > 0) {
    estimatedAmount = patient.treatmentCost;
  }
  
  return estimatedAmount;
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