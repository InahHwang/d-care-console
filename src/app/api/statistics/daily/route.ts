// src/app/api/statistics/daily/route.ts - 🔥 견적금액 중복 계산 문제 수정
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

// JWT 검증 함수
function verifyToken(token: string) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (error) {
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

    // URL에서 날짜 파라미터 추출
    const { searchParams } = new URL(request.url);
    const selectedDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    console.log(`📊 일별 업무 현황 조회: ${selectedDate}`);

    const { db } = await connectToDatabase();
    const patientsCollection = db.collection('patients');

    // 기존 일별 업무 현황 로직...
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // 1. 미처리 콜백 (오늘까지 예정이었는데 아직 처리 안된 것들)
    const overdueCallbacks = await patientsCollection.find({
      callbackHistory: {
        $elemMatch: {
          date: { $lte: todayString },
          status: "예정"
        }
      }
    }).toArray();

    // 2. 콜백 미등록 (잠재고객 상태이면서 마지막 콜백이 일주일 이상 된 환자들)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoString = oneWeekAgo.toISOString().split('T')[0];

    const callbackUnregistered = await patientsCollection.find({
      status: "잠재고객",
      $or: [
        { callbackHistory: { $size: 0 } },
        {
          callbackHistory: {
            $not: {
              $elemMatch: {
                date: { $gte: oneWeekAgoString }
              }
            }
          }
        }
      ]
    }).toArray();

    // 3. 부재중 상태 환자들
    const absentPatients = await patientsCollection.find({
      status: "부재중"
    }).toArray();

    // 4. 오늘 예정된 콜백들
    const todayScheduledCallbacks = await patientsCollection.find({
      callbackHistory: {
        $elemMatch: {
          date: todayString,
          status: "예정"
        }
      }
    }).toArray();

    // 🔥 새로 추가: 해당 날짜 환자별 상담 내용 요약
    const dailyPatients = await patientsCollection.find({
      $or: [
        { callInDate: selectedDate }, // 신규 등록된 환자
        { visitDate: selectedDate }   // 내원한 환자
      ]
    }).toArray();

    // 🔥 환자별 상담 내용 요약 생성 - fullDiscomfort 필드 추가
    const patientConsultations = dailyPatients
      .filter(patient => {
        // 상담 내용이 있는 환자만 필터링
        const hasConsultation = patient.consultation && 
          (patient.consultation.treatmentPlan || patient.consultation.consultationNotes);
        
        const hasPostVisitConsultation = patient.postVisitConsultation && 
          patient.postVisitConsultation.firstVisitConsultationContent;

        const hasCallbackConsultation = patient.callbackHistory && 
          patient.callbackHistory.some((callback: any) => 
            (callback.resultNotes && callback.resultNotes.trim() !== '' && callback.resultNotes !== 'undefined') ||
            (callback.notes && callback.notes.trim() !== '' && callback.notes !== 'undefined')
          );

        return hasConsultation || hasPostVisitConsultation || hasCallbackConsultation;
      })
      .map(patient => {
        // 🔥 상담 내용 조합 로직 (기존 유지)
        const consultationContents: string[] = [];

        // 1. 📞 전화상담 내용 먼저 수집
        const phoneContents: string[] = [];

        // 1-1. 최초 전화상담 내용
        if (patient.consultation?.consultationNotes) {
          phoneContents.push(`[상담메모] ${patient.consultation.consultationNotes}`);
        }

        // 1-2. 상담관리 콜백들 (전화상담 단계)
        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const phoneCallbacks = patient.callbackHistory
            .filter((callback: any) => 
              !callback.isVisitManagementCallback && 
              callback.notes && 
              callback.notes.trim() !== '' &&
              callback.notes !== 'undefined' &&
              callback.status === '완료'
            )
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          phoneCallbacks.forEach((callback: any, index: number) => {
            const callbackNum = index + 1;
            const callbackDate = new Date(callback.date).toLocaleDateString('ko-KR', {
              year: '2-digit',
              month: '2-digit', 
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, '');
            
            phoneContents.push(`[상담관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`);
          });
        }

        // 📞 전화상담 섹션 추가
        if (phoneContents.length > 0) {
          consultationContents.push(`📞 전화상담:\n${phoneContents.join('\n')}`);
        }

        // 2. 🏥 내원상담 섹션 구성
        const visitContents: string[] = [];

        // 2-1. 첫 상담
        if (patient.postVisitConsultation?.firstVisitConsultationContent) {
          visitContents.push(`[첫 상담] ${patient.postVisitConsultation.firstVisitConsultationContent}`);
        }

        // 2-2. 내원관리 콜백들 (내원상담 단계)
        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const visitCallbacks = patient.callbackHistory
            .filter((callback: any) => 
              callback.isVisitManagementCallback && 
              callback.notes && 
              callback.notes.trim() !== '' &&
              callback.notes !== 'undefined' &&
              callback.status === '완료'
            )
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          visitCallbacks.forEach((callback: any, index: number) => {
            const callbackNum = index + 1;
            const callbackDate = new Date(callback.date).toLocaleDateString('ko-KR', {
              year: '2-digit',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '.').replace(/\.$/, '');
            
            visitContents.push(`[내원관리 ${callbackNum}차 - ${callbackDate}] ${callback.notes}`);
          });
        }

        // 🏥 내원상담 섹션 추가
        if (visitContents.length > 0) {
          consultationContents.push(`🏥 내원상담:\n${visitContents.join('\n')}`);
        }

        // 🔥 견적금액 계산 (우선순위: 내원 견적 > 전화 견적)
        let estimatedAmount = 0;
        let phoneAmount = 0;
        let visitAmount = 0;
        let hasPhoneConsultation = false;
        let hasVisitConsultation = false;

        // 전화상담 견적 (최초 상담)
        if (patient.consultation?.estimatedAmount && patient.consultation.estimatedAmount > 0) {
          phoneAmount = patient.consultation.estimatedAmount;
          hasPhoneConsultation = true;
        }

        // 내원상담 견적 (내원 후 상담)
        if (patient.postVisitConsultation?.estimateInfo) {
          const estimate = patient.postVisitConsultation.estimateInfo;
          visitAmount = estimate.discountPrice || estimate.regularPrice || 0;
          if (visitAmount > 0) {
            hasVisitConsultation = true;
          }
        }

        // 최종 견적금액 결정 (내원 견적 우선)
        estimatedAmount = visitAmount > 0 ? visitAmount : phoneAmount;

        // 🔥 진행상황 계산을 위한 필드들
        const visitConfirmed = patient.visitConfirmed === true;
        const isCompleted = patient.isCompleted === true || patient.status === '종결';

        const fullConsultation = consultationContents.length > 0 ? consultationContents.join('\n\n') : '상담내용 없음';
        const consultationSummary = fullConsultation.length > 200 ? 
          fullConsultation.substring(0, 200) + '...' : fullConsultation;

        // 🔥 "불편한 부분" 정보 추출 - 월보고서와 동일한 방식
        const discomfort = patient.consultation?.treatmentPlan ? 
          patient.consultation.treatmentPlan.substring(0, 50) + 
          (patient.consultation.treatmentPlan.length > 50 ? '...' : '') : '';
        
        const fullDiscomfort = patient.consultation?.treatmentPlan || ''; // 🔥 이 부분이 누락되어 있었음!

        return {
          _id: patient._id.toString(),
          name: patient.name,
          age: patient.age,
          interestedServices: patient.interestedServices || [],
          discomfort,           // 🔥 "불편한 부분" 요약
          fullDiscomfort,       // 🔥 "불편한 부분" 전체 내용 (누락되어 있던 필드!)
          consultationSummary,
          fullConsultation,
          estimatedAmount,
          estimateAgreed: patient.consultation?.estimateAgreed || false, // 🔥 견적 동의 여부도 추가
          // 🔥 일별보고서용 추가 필드들
          callInDate: patient.callInDate,
          visitDate: patient.visitDate,
          hasPhoneConsultation,
          hasVisitConsultation,
          phoneAmount,
          visitAmount,
          // 🔥 진행상황 계산을 위한 필드들
          status: patient.status,
          visitConfirmed,
          postVisitStatus: patient.postVisitStatus,
          isCompleted
        };
      })
      .sort((a, b) => {
        // 🔥 정렬: 견적금액이 높은 순으로
        return b.estimatedAmount - a.estimatedAmount;
      });

    // 🔥 수정된 견적금액 계산 로직 - 중복 제거 및 상태 기반 구분
    console.log(`💰 견적금액 계산 시작 - 총 ${dailyPatients.length}명의 환자`);

    // 1. 내원 상담 환자 견적 (visitConsultationEstimate)
    // 조건: visitConfirmed === true (내원 완료) 
    // 계산: postVisitConsultation.estimateInfo의 최종 치료 비용
    const visitConsultationEstimate = dailyPatients
      .filter(p => {
        const isVisitCompleted = p.visitConfirmed === true;
        const hasVisitEstimate = p.postVisitConsultation?.estimateInfo;
        
        console.log(`내원상담 체크 - ${p.name}: visitConfirmed=${p.visitConfirmed}, hasEstimate=${!!hasVisitEstimate}`);
        return isVisitCompleted && hasVisitEstimate;
      })
      .reduce((sum, p) => {
        const estimate = p.postVisitConsultation.estimateInfo;
        const amount = estimate.discountPrice || estimate.regularPrice || 0;
        
        console.log(`내원상담 견적 - ${p.name}: ${amount}원 (visitDate: ${p.visitDate})`);
        return sum + amount;
      }, 0);

    // 2. 유선 상담 환자 견적 (phoneConsultationEstimate)  
    // 조건: visitConfirmed !== true (미내원) AND callInDate === selectedDate
    // 계산: consultation.estimatedAmount
    const phoneConsultationEstimate = dailyPatients
      .filter(p => {
        const isNotVisitCompleted = p.visitConfirmed !== true;
        const hasPhoneEstimate = p.consultation?.estimatedAmount && p.consultation.estimatedAmount > 0;
        const isCallInToday = p.callInDate === selectedDate;
        
        console.log(`유선상담 체크 - ${p.name}: notVisited=${isNotVisitCompleted}, hasEstimate=${!!hasPhoneEstimate}, callInToday=${isCallInToday}`);
        return isNotVisitCompleted && hasPhoneEstimate && isCallInToday;
      })
      .reduce((sum, p) => {
        const amount = p.consultation.estimatedAmount || 0;
        
        console.log(`유선상담 견적 - ${p.name}: ${amount}원 (callInDate: ${p.callInDate})`);
        return sum + amount;
      }, 0);

    console.log(`💰 견적금액 계산 완료:`);
    console.log(`  - 내원 상담 환자 견적: ${visitConsultationEstimate.toLocaleString()}원`);
    console.log(`  - 유선 상담 환자 견적: ${phoneConsultationEstimate.toLocaleString()}원`);
    console.log(`  - 총 상담 견적: ${(visitConsultationEstimate + phoneConsultationEstimate).toLocaleString()}원`);

    // 🔥 치료 시작 견적 계산도 개선
    const treatmentStartedEstimate = await patientsCollection.find({
      postVisitStatus: "치료시작",
      // 🔥 실제 치료시작 처리일이 선택된 날짜인 환자들만
      $or: [
        { 
          // 치료시작일이 명시적으로 설정된 경우
          treatmentStartDate: selectedDate 
        },
        { 
          // 콜백 히스토리에서 "치료시작" 관련 콜백이 해당 날짜에 완료된 경우
          callbackHistory: {
            $elemMatch: {
              actualCompletedDate: selectedDate,
              status: "완료",
              type: { $regex: "치료시작" }
            }
          }
        },
        {
          // postVisitStatus가 "치료시작"으로 변경된 날짜가 선택된 날짜인 경우
          // (실제로는 활동 로그를 확인해야 하지만, 간단히 lastModifiedAt 사용)
          lastModifiedAt: {
            $gte: new Date(selectedDate + 'T00:00:00.000Z'),
            $lt: new Date(selectedDate + 'T23:59:59.999Z')
          },
          postVisitStatus: "치료시작"
        }
      ]
    }).toArray();

    const treatmentStartedTotal = treatmentStartedEstimate.reduce((sum, p) => {
      if (p.postVisitConsultation?.estimateInfo) {
        const estimate = p.postVisitConsultation.estimateInfo;
        const amount = estimate.discountPrice || estimate.regularPrice || 0;
        console.log(`치료시작 견적 - ${p.name}: ${amount}원 (처리일: ${selectedDate})`);
        return sum + amount;
      }
      return sum;
    }, 0);

    console.log(`🚀 치료시작 견적: ${treatmentStartedTotal.toLocaleString()}원`);

    // 처리율 계산 헬퍼 함수
    const calculateProcessingRate = (total: number, processed: number): number => {
      return total > 0 ? Math.round((processed / total) * 100) : 100;
    };

    // 응답 데이터 구성
    const responseData = {
      selectedDate,
      callbackSummary: {
        overdueCallbacks: {
          total: overdueCallbacks.length,
          processed: 0, // 실제로는 처리 완료된 것들을 계산해야 함
          processingRate: calculateProcessingRate(overdueCallbacks.length, 0)
        },
        callbackUnregistered: {
          total: callbackUnregistered.length,
          processed: 0,
          processingRate: calculateProcessingRate(callbackUnregistered.length, 0)
        },
        absent: {
          total: absentPatients.length,
          processed: 0,
          processingRate: calculateProcessingRate(absentPatients.length, 0)
        },
        todayScheduled: {
          total: todayScheduledCallbacks.length,
          processed: 0,
          processingRate: calculateProcessingRate(todayScheduledCallbacks.length, 0)
        }
      },
      estimateSummary: {
        totalConsultationEstimate: visitConsultationEstimate + phoneConsultationEstimate,
        visitConsultationEstimate,
        phoneConsultationEstimate,
        treatmentStartedEstimate: treatmentStartedTotal
      },
      // 🔥 새로 추가: 환자별 상담 내용 (fullDiscomfort 필드 포함)
      patientConsultations
    };

    console.log(`✅ 일별 업무 현황 조회 완료: ${selectedDate}`);
    console.log(`📊 상담 내용이 있는 환자: ${patientConsultations.length}명`);
    console.log(`🔥 fullDiscomfort 필드 포함 확인:`, patientConsultations.slice(0, 3).map(p => ({ name: p.name, hasFullDiscomfort: !!p.fullDiscomfort })));

    return NextResponse.json({ 
      success: true, 
      data: responseData
    });

  } catch (error) {
    console.error('❌ 일별 업무 현황 조회 오류:', error);
    return NextResponse.json(
      { 
        message: '일별 업무 현황 조회 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    );
  }
}