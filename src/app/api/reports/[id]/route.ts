// src/app/api/reports/[id]/route.ts - 🔥 매출 현황 분석 호환성 추가
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

// JWT 토큰 추출 헬퍼 함수
function extractToken(request: NextRequest): string | null {
  // Authorization 헤더에서 추출
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }

  // 쿠키에서 추출
  const tokenCookie = request.cookies.get('token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  // Cookie 헤더에서 직접 추출 (fallback)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
  }

  return null;
}

// JWT 토큰 검증 헬퍼 함수
function verifyToken(token: string): any {
  try {
    // JWT_SECRET이 있다면 검증, 없다면 디코드만
    if (process.env.JWT_SECRET) {
      return jwt.verify(token, process.env.JWT_SECRET);
    } else {
      const decoded = jwt.decode(token);
      if (!decoded) {
        throw new Error('Invalid token format');
      }
      return decoded;
    }
  } catch (error) {
    console.error('JWT 검증 오류:', error);
    throw new Error('Invalid token');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Reports GET 요청 시작 - ID:', params.id);

    // 1. 토큰 추출 및 검증
    const token = extractToken(request);
    if (!token) {
      console.log('❌ 토큰이 없음');
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('✅ 토큰 검증 성공 - 사용자:', decoded.username || decoded.id);
    } catch (error) {
      console.log('❌ 토큰 검증 실패:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 2. ID 유효성 검사
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      console.log('❌ 유효하지 않은 ObjectId:', id);
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    // 3. 데이터베이스 연결
    let db;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      console.log('✅ 데이터베이스 연결 성공');
    } catch (error) {
      console.error('❌ 데이터베이스 연결 실패:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ message: '데이터베이스 연결에 실패했습니다.' }, { status: 500 });
    }

    // 4. 보고서 조회
    const reportsCollection = db.collection('reports');
    
    let report;
    try {
      report = await reportsCollection.findOne({ _id: new ObjectId(id) });
      console.log('✅ 보고서 조회 완료 - 존재 여부:', !!report);
    } catch (error) {
      console.error('❌ 보고서 조회 중 오류:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ message: '보고서 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    if (!report) {
      console.log('❌ 보고서를 찾을 수 없음 - ID:', id);
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 🔥 매출 현황 분석 데이터가 없는 기존 보고서의 경우 자동 생성
    if (!report.revenueAnalysis && report.patientConsultations) {
      console.log('🔥 매출 현황 분석 데이터가 없음 - 자동 생성 시도');
      
      try {
        // 해당 월의 환자 데이터 다시 조회하여 매출 분석 생성
        const patientsCollection = db.collection('patients');
        const startDateStr = `${report.year}-${report.month.toString().padStart(2, '0')}-01`;
        const endDateStr = `${report.year}-${report.month.toString().padStart(2, '0')}-${new Date(report.year, report.month, 0).getDate().toString().padStart(2, '0')}`;
        
        const patients = await patientsCollection.find({
          callInDate: {
            $gte: startDateStr,
            $lte: endDateStr
          }
        }).toArray();
        
        if (patients.length > 0) {
          const revenueAnalysis = generateRevenueAnalysis(patients);
          
          // 보고서에 매출 분석 데이터 추가
          await reportsCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
              $set: { 
                revenueAnalysis,
                updatedAt: new Date().toISOString()
              }
            }
          );
          
          report.revenueAnalysis = revenueAnalysis;
          console.log('✅ 매출 현황 분석 데이터 자동 생성 완료');
        }
      } catch (error) {
        console.error('⚠️ 매출 현황 분석 자동 생성 실패:', error instanceof Error ? error.message : String(error));
        // 실패해도 기존 보고서는 반환
      }
    }

    console.log('✅ 보고서 반환 성공');
    return NextResponse.json({ 
      success: true, 
      report: {
        ...report,
        _id: report._id.toString()
      }
    });

  } catch (error) {
    console.error('💥 Reports GET 전체 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        message: '보고서 조회 중 예상치 못한 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 Reports PATCH 요청 시작 - ID:', params.id);

    // 1. 토큰 추출 및 검증
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 2. ID 유효성 검사
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    // 3. 요청 데이터 파싱
    let updateData;
    try {
      updateData = await request.json();
    } catch (error) {
      return NextResponse.json({ message: '잘못된 요청 데이터입니다.' }, { status: 400 });
    }

    // 4. 데이터베이스 연결
    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    // 5. 기존 보고서 조회
    const existingReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
    if (!existingReport) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 🔥 새로 추가: 피드백 관련 처리
    if (updateData.feedbackAction) {
      console.log('🔥 피드백 처리 요청:', updateData.feedbackAction);
      
      // 원장님 권한 확인 (master 또는 director 역할)
      if (decoded.role !== 'master' && decoded.role !== 'director') {
        return NextResponse.json({ message: '피드백을 작성할 권한이 없습니다.' }, { status: 403 });
      }

      const currentFeedbacks = existingReport.directorFeedbacks || [];
      let updatedFeedbacks = [...currentFeedbacks];

      switch (updateData.feedbackAction) {
        case 'add':
          // 새 피드백 추가
          const newFeedback = {
            feedbackId: new ObjectId().toString(),
            content: updateData.feedbackData.content,
            targetSection: updateData.feedbackData.targetSection,
            createdAt: new Date().toISOString(),
            createdBy: decoded._id || decoded.id,
            createdByName: decoded.name || decoded.username || '원장님'
          };
          updatedFeedbacks.push(newFeedback);
          console.log('✅ 새 피드백 추가:', newFeedback.feedbackId);
          break;

        case 'update':
          // 기존 피드백 수정
          const feedbackIndex = updatedFeedbacks.findIndex(f => f.feedbackId === updateData.feedbackId);
          if (feedbackIndex === -1) {
            return NextResponse.json({ message: '수정할 피드백을 찾을 수 없습니다.' }, { status: 404 });
          }
          
          // 피드백 작성자 확인
          if (updatedFeedbacks[feedbackIndex].createdBy !== (decoded._id || decoded.id) && decoded.role !== 'master') {
            return NextResponse.json({ message: '다른 사람의 피드백을 수정할 권한이 없습니다.' }, { status: 403 });
          }
          
          updatedFeedbacks[feedbackIndex] = {
            ...updatedFeedbacks[feedbackIndex],
            content: updateData.feedbackData.content,
            updatedAt: new Date().toISOString()
          };
          console.log('✅ 피드백 수정:', updateData.feedbackId);
          break;

        case 'delete':
          // 피드백 삭제
          const deleteIndex = updatedFeedbacks.findIndex(f => f.feedbackId === updateData.feedbackId);
          if (deleteIndex === -1) {
            return NextResponse.json({ message: '삭제할 피드백을 찾을 수 없습니다.' }, { status: 404 });
          }
          
          // 피드백 작성자 확인
          if (updatedFeedbacks[deleteIndex].createdBy !== (decoded._id || decoded.id) && decoded.role !== 'master') {
            return NextResponse.json({ message: '다른 사람의 피드백을 삭제할 권한이 없습니다.' }, { status: 403 });
          }
          
          updatedFeedbacks.splice(deleteIndex, 1);
          console.log('✅ 피드백 삭제:', updateData.feedbackId);
          break;
      }

      // 피드백 업데이트
      const feedbackResult = await reportsCollection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            directorFeedbacks: updatedFeedbacks,
            updatedAt: new Date().toISOString()
          }
        }
      );

      if (feedbackResult.matchedCount > 0) {
        const updatedReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
        return NextResponse.json({ 
          success: true, 
          report: {
            ...updatedReport,
            _id: updatedReport!._id.toString()
          },
          message: updateData.feedbackAction === 'add' ? '피드백이 추가되었습니다.' :
                   updateData.feedbackAction === 'update' ? '피드백이 수정되었습니다.' :
                   '피드백이 삭제되었습니다.'
        });
      }
    }

    // 6. 권한 확인
    const userId = decoded._id || decoded.id;
    if (existingReport.createdBy !== userId && decoded.role !== 'master') {
      return NextResponse.json({ message: '보고서를 수정할 권한이 없습니다.' }, { status: 403 });
    }

    // 7. 제출된 보고서 수정 제한
    if (existingReport.status === 'submitted' && decoded.role !== 'master') {
      return NextResponse.json({ message: '제출된 보고서는 수정할 수 없습니다.' }, { status: 400 });
    }

    // 8. 통계 새로고침 요청 처리
    if (updateData.refreshStats === true) {
      console.log(`🔄 보고서 통계 새로고침 요청: ${existingReport.year}년 ${existingReport.month}월`);
      
      try {
        // 🔥 내부에서 직접 통계 재계산 처리 (순환 참조 방지)
        const refreshedStats = await refreshReportStats(existingReport.month, existingReport.year, token);
        
        console.log('✅ 새로운 통계 데이터 획득');
        
        const refreshedData = {
          ...refreshedStats,
          // 매니저 입력 데이터 보존
          managerComment: existingReport.managerComment,
          improvementSuggestions: existingReport.improvementSuggestions,
          managerAnswers: existingReport.managerAnswers,
          directorFeedbacks: existingReport.directorFeedbacks || [], // 🔥 피드백 보존
          // 메타데이터 보존
          createdBy: existingReport.createdBy,
          createdByName: existingReport.createdByName,
          createdAt: existingReport.createdAt,
          generatedDate: existingReport.generatedDate,
          month: existingReport.month,
          year: existingReport.year,
          status: existingReport.status,
          updatedAt: new Date().toISOString()
        };

        const refreshResult = await reportsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: refreshedData }
        );

        if (refreshResult.matchedCount > 0) {
          const refreshedReport = await reportsCollection.findOne({ _id: new ObjectId(id) });
          
          return NextResponse.json({ 
            success: true, 
            report: {
              ...refreshedReport,
              _id: refreshedReport!._id.toString()
            },
            message: '보고서 데이터가 최신 정보로 새로고침되었습니다.'
          });
        }
      } catch (refreshError) {
        console.error('❌ 통계 새로고침 중 오류:', refreshError instanceof Error ? refreshError.message : String(refreshError));
        return NextResponse.json({ 
          message: '통계 새로고침 중 오류가 발생했습니다.' 
        }, { status: 500 });
      }
    }

    // 9. 일반적인 보고서 수정
    const allowedFields = [
      'managerComment',
      'improvementSuggestions', 
      'managerAnswers',
      'status'
    ];

    const updateFields: any = {
      updatedAt: new Date().toISOString()
    };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    }

    const result = await reportsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updatedReport = await reportsCollection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({ 
      success: true, 
      report: {
        ...updatedReport,
        _id: updatedReport!._id.toString()
      },
      message: updateData.status === 'submitted' ? '보고서가 제출되었습니다.' : '보고서가 저장되었습니다.'
    });

  } catch (error) {
    console.error('💥 Reports PATCH 전체 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        message: '보고서 수정 중 예상치 못한 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 인증 확인
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 마스터만 삭제 가능
    if (decoded.role !== 'master') {
      return NextResponse.json({ message: '보고서를 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: '유효하지 않은 보고서 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const reportsCollection = db.collection('reports');

    const result = await reportsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: '보고서를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '보고서가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('💥 Reports DELETE 전체 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { 
        message: '보고서 삭제 중 예상치 못한 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}

// 🔥 보고서 통계 새로고침 함수 - 내부 처리로 순환 참조 방지
async function refreshReportStats(month: number, year: number, token: string) {
  const { db } = await connectToDatabase();
  const patientsCollection = db.collection('patients');

  // 해당 월의 시작일과 종료일 계산
  const startDateStr = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDateStr = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`;
  
  // 이전 월 계산
  const prevMonth = month - 1 === 0 ? 12 : month - 1;
  const prevYear = month - 1 === 0 ? year - 1 : year;
  const prevStartDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
  const prevEndDateStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${new Date(prevYear, prevMonth, 0).getDate().toString().padStart(2, '0')}`;

  // 현재 월 및 이전 월 데이터 조회
  const [currentMonthPatients, prevMonthPatients] = await Promise.all([
    patientsCollection.find({
      callInDate: { $gte: startDateStr, $lte: endDateStr }
    }).toArray(),
    patientsCollection.find({
      callInDate: { $gte: prevStartDateStr, $lte: prevEndDateStr }
    }).toArray()
  ]);

  // 통계 계산
  const currentStats = calculateStatsWithRevenue(currentMonthPatients);
  const prevStats = calculateStatsWithRevenue(prevMonthPatients);

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

  return {
    ...currentStats,
    changes
  };
}

// 🔥 매출 현황 분석 포함 통계 계산 함수
function calculateStatsWithRevenue(patients: any[]) {
  // 기본 통계 계산
  const totalInquiries = patients.length;
  const inboundCalls = patients.filter(p => p.consultationType === 'inbound').length;
  const outboundCalls = patients.filter(p => p.consultationType === 'outbound').length;
  const returningCalls = patients.filter(p => p.consultationType === 'returning').length;
  
  const appointmentPatients = patients.filter(p => p.status === '예약확정').length;
  const appointmentRate = totalInquiries > 0 ? (appointmentPatients / totalInquiries) * 100 : 0;
  
  const visitedPatients = patients.filter(p => p.visitConfirmed === true).length;
  const visitRate = totalInquiries > 0 ? (visitedPatients / totalInquiries) * 100 : 0;
  
  const treatmentStartedPatients = patients.filter(p => 
    p.visitConfirmed === true && p.postVisitStatus === '치료시작'
  );
  const paymentPatients = treatmentStartedPatients.length;
  
  const totalPayment = treatmentStartedPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const paymentRate = totalInquiries > 0 ? (paymentPatients / totalInquiries) * 100 : 0;
  
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

  // 환자별 상담 내용 요약 생성
  const patientConsultations = patients
    .filter(p => p.consultation && (p.consultation.treatmentPlan || p.consultation.consultationNotes))
    .map(p => {
      const consultation = p.consultation;
      
      let estimatedAmount = 0;
      let visitAmount = 0;
      let phoneAmount = consultation.estimatedAmount || 0;
      
      if (p.postVisitConsultation?.estimateInfo) {
        const estimate = p.postVisitConsultation.estimateInfo;
        
        if (estimate.discountPrice && estimate.discountPrice > 0) {
          visitAmount = estimate.discountPrice;
          estimatedAmount = estimate.discountPrice;
        } else if (estimate.regularPrice && estimate.regularPrice > 0) {
          visitAmount = estimate.regularPrice;
          estimatedAmount = estimate.regularPrice;
        }
      } else if (consultation.estimatedAmount) {
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
        consultationType: p.consultationType || 'inbound',
        callInDate: p.callInDate,
        status: p.status,
        visitConfirmed: p.visitConfirmed,
        postVisitStatus: p.postVisitStatus,
        isCompleted: p.isCompleted,
        interestedServices: p.interestedServices,
        hasPhoneConsultation: !!(consultation.consultationNotes),
        hasVisitConsultation: !!(p.postVisitConsultation),
        phoneAmount,
        visitAmount
      };
    });

  // 🔥 기존 손실 분석 (호환성 유지)
  const lossAnalysis = generateLossAnalysis(patients);
  
  // 🔥 새로운 매출 현황 분석
  const revenueAnalysis = generateRevenueAnalysis(patients);

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
    averageAge: Math.round(averageAge * 10) / 10,
    regionStats,
    channelStats,
    patientConsultations,
    lossAnalysis, // 기존 손실 분석
    revenueAnalysis // 새로운 매출 현황 분석
  };
}

// 🔥 매출 현황 분석 생성 함수
function generateRevenueAnalysis(patients: any[]) {
  // 1. 달성매출군 - 치료시작한 환자들
  const achievedPatients = patients.filter(p => 
    p.visitConfirmed === true && p.postVisitStatus === '치료시작'
  );
  
  const achievedAmount = achievedPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  // 2. 잠재매출군 - 아직 진행 중인 환자들
  const consultationOngoingPatients = patients.filter(p => 
    ['콜백필요', '잠재고객', '예약확정', '재예약확정'].includes(p.status) && 
    !p.isCompleted
  );
  
  const consultationOngoingAmount = consultationOngoingPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const visitManagementPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작' && 
    p.postVisitStatus !== '종결' &&
    !p.isCompleted
  );
  
  const visitManagementAmount = visitManagementPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const totalPotentialPatients = consultationOngoingPatients.length + visitManagementPatients.length;
  const totalPotentialAmount = consultationOngoingAmount + visitManagementAmount;
  
  // 3. 손실매출군 - 확실히 놓친 환자들
  const consultationLostPatients = patients.filter(p => 
    (p.status === '종결' || p.status === '부재중') || 
    (p.isCompleted === true && !p.visitConfirmed)
  );
  
  const consultationLostAmount = consultationLostPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const visitLostPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    (p.postVisitStatus === '종결' || (p.isCompleted === true && p.visitConfirmed))
  );
  
  const visitLostAmount = visitLostPatients.reduce((sum, p) => {
    return sum + getPatientEstimatedAmount(p);
  }, 0);
  
  const totalLostPatients = consultationLostPatients.length + visitLostPatients.length;
  const totalLostAmount = consultationLostAmount + visitLostAmount;
  
  // 4. 전체 요약 계산
  const totalInquiries = patients.length;
  const totalPotentialAmountAll = achievedAmount + totalPotentialAmount + totalLostAmount;
  
  const achievedPercentage = totalInquiries > 0 ? Math.round((achievedPatients.length / totalInquiries) * 100) : 0;
  const potentialPercentage = totalInquiries > 0 ? Math.round((totalPotentialPatients / totalInquiries) * 100) : 0;
  const lostPercentage = totalInquiries > 0 ? Math.round((totalLostPatients / totalInquiries) * 100) : 0;
  
  const achievementRate = totalPotentialAmountAll > 0 ? Math.round((achievedAmount / totalPotentialAmountAll) * 100) : 0;
  const potentialGrowth = achievedAmount > 0 ? Math.round((totalPotentialAmount / achievedAmount) * 100) : 0;
  
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

// 🔥 기존 손실 분석 생성 함수 (호환성 유지)
function generateLossAnalysis(patients: any[]) {
  const consultationLossPatients = patients.filter(p => 
    p.status !== '예약확정' && p.status !== 'VIP'
  );
  
  const consultationLoss = {
    terminated: consultationLossPatients.filter(p => p.status === '종결').length,
    missed: consultationLossPatients.filter(p => p.status === '부재중').length,
    potential: consultationLossPatients.filter(p => p.status === '잠재고객').length,
    callback: consultationLossPatients.filter(p => p.status === '콜백필요').length,
    totalCount: consultationLossPatients.length,
    estimatedAmount: consultationLossPatients.reduce((sum, p) => {
      return sum + getPatientEstimatedAmount(p);
    }, 0)
  };

  const visitLossPatients = patients.filter(p => 
    p.visitConfirmed === true && 
    p.postVisitStatus !== '치료시작'
  );
  
  const visitLoss = {
    terminated: visitLossPatients.filter(p => p.postVisitStatus === '종결').length,
    callbackNeeded: visitLossPatients.filter(p => p.postVisitStatus === '재콜백필요').length,
    agreedButNotStarted: visitLossPatients.filter(p => p.postVisitStatus === '치료동의').length,
    totalCount: visitLossPatients.length,
    estimatedAmount: visitLossPatients.reduce((sum, p) => {
      return sum + getPatientEstimatedAmount(p);
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

// 🔥 환자의 예상 견적 금액 계산 헬퍼 함수
function getPatientEstimatedAmount(patient: any): number {
  let estimatedAmount = 0;
  
  // 1. 내원 후 상담 정보의 견적이 있는 경우 (우선순위 1)
  if (patient.postVisitConsultation?.estimateInfo) {
    const estimate = patient.postVisitConsultation.estimateInfo;
    
    if (estimate.discountPrice && estimate.discountPrice > 0) {
      estimatedAmount = estimate.discountPrice;
    } else if (estimate.regularPrice && estimate.regularPrice > 0) {
      estimatedAmount = estimate.regularPrice;
    }
  }
  // 2. 기존 상담 정보의 견적이 있는 경우 (우선순위 2)
  else if (patient.consultation?.estimatedAmount) {
    estimatedAmount = patient.consultation.estimatedAmount;
  }
  // 3. 직접 입력된 치료금액이 있는 경우 (우선순위 3)
  else if (patient.treatmentCost && patient.treatmentCost > 0) {
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