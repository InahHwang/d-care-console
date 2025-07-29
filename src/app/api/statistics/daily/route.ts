// src/app/api/statistics/daily/route.ts - 🔥 개선된 미처리 콜백 로직 적용

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

    // 모든 환자 데이터를 한 번만 가져오기
    const allPatients = await patientsCollection.find({
      $or: [
        { isCompleted: { $ne: true } },
        { isCompleted: { $exists: false } }
      ]
    }).toArray();

    console.log(`📊 전체 활성 환자 수: ${allPatients.length}명`);

    // 🔥 1. 미처리 콜백 - 개선된 로직 적용 (상담환자 + 내원환자)
    interface OverdueCallbackCount {
      consultation: number;
      visit: number;
    }

    /**
     * 미처리 콜백 환자 수 계산 (상담환자 / 내원환자)
     */
    const calculateOverdueCallbacks = (patients: any[]): OverdueCallbackCount => {
      const today = new Date(selectedDate);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let consultationCount = 0;
      let visitCount = 0;
      
      patients.forEach((patient) => {
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return;
        }
        
        // 상담환자 (내원 전)
        if (patient.visitConfirmed !== true) {
          if (['예약확정', '재예약확정'].includes(patient.status)) return;
          if (patient.status !== '콜백필요') return;
          
          const hasOverdueCallback = patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '예정') return false;
            if (callback.isVisitManagementCallback === true) return false;
            const callbackDate = new Date(callback.date);
            callbackDate.setHours(0, 0, 0, 0);
            return callbackDate < todayStart;
          });
          
          if (hasOverdueCallback) {
            consultationCount++;
          }
        }
        
        // 내원환자
        if (patient.visitConfirmed === true) {
          if (patient.postVisitStatus === '치료시작') return;
          
          const hasOverdueVisitCallback = patient.callbackHistory.some((callback: any) => {
            if (callback.status !== '예정') return false;
            if (callback.isVisitManagementCallback !== true) return false;
            const callbackDate = new Date(callback.date);
            callbackDate.setHours(0, 0, 0, 0);
            return callbackDate < todayStart;
          });
          
          if (hasOverdueVisitCallback) {
            visitCount++;
          }
        }
      });
      
      return {
        consultation: consultationCount,
        visit: visitCount
      };
    };

    // 미처리 콜백 계산
    const overdueCallbackCounts = calculateOverdueCallbacks(allPatients);
    const totalOverdueCallbacks = overdueCallbackCounts.consultation + overdueCallbackCounts.visit;
    
    // 미처리 콜백 환자 목록 (기존 필터링 유지 - 처리율 계산용)
    const overdueCallbackPatients = allPatients.filter((patient: any) => {
      if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
        return false;
      }
      
      const today = new Date(selectedDate);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      // 상담환자 (내원확정되지 않은 환자)
      if (patient.visitConfirmed !== true) {
        if (['예약확정', '재예약확정'].includes(patient.status)) return false;
        if (patient.status !== '콜백필요') return false;
        
        return patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '예정') return false;
          if (callback.isVisitManagementCallback === true) return false;
          
          const callbackDate = new Date(callback.date);
          callbackDate.setHours(0, 0, 0, 0);
          return callbackDate < todayStart;
        });
      }
      
      // 내원환자 (내원확정된 환자)
      if (patient.visitConfirmed === true) {
        if (patient.postVisitStatus === '치료시작') return false;
        
        return patient.callbackHistory.some((callback: any) => {
          if (callback.status !== '예정') return false;
          if (callback.isVisitManagementCallback !== true) return false;
          
          const callbackDate = new Date(callback.date);
          callbackDate.setHours(0, 0, 0, 0);
          return callbackDate < todayStart;
        });
      }
      
      return false;
    });

    // 🔥 2. 오늘 예정된 콜백 - status-filter/route.ts의 todayScheduled 로직과 동일
    const todayScheduledPatients = allPatients.filter((patient: any) => {
      // 상담관리 콜백
      const hasManagementCallback = (() => {
        if (patient.visitConfirmed === true && patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        // 예약확정/재예약확정 상태인 환자도 제외
        if (patient.status === '예약확정' || patient.status === '재예약확정') {
          return false;
        }
        
        return patient.callbackHistory?.some((callback: any) => 
          callback.status === '예정' && callback.date === selectedDate
        ) || patient.nextCallbackDate === selectedDate;
      })();

      // 내원관리 콜백
      const hasPostVisitCallback = (() => {
        if (patient.visitConfirmed !== true) {
          return false;
        }
        
        if (patient.postVisitStatus !== '재콜백필요') {
          return false;
        }
        
        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          return patient.callbackHistory.some((callback: any) => {
            return callback.status === '예정' && callback.date === selectedDate;
          });
        }
        
        return false;
      })();

      return hasManagementCallback || hasPostVisitCallback;
    });

    // 🔥 3. 콜백 미등록 - status-filter/route.ts의 callbackUnregistered 로직과 동일
    const callbackUnregisteredPatients = allPatients.filter((patient: any) => {
      // 예약 후 미내원 상태 동적 계산
      const calculatePostReservationStatus = (p: any): boolean => {
        if (p.status === '예약확정' && 
            !p.visitConfirmed && 
            p.reservationDate) {
          return p.reservationDate < selectedDate;
        }
        return false;
      };

      // 상담환자 콜백 미등록
      if (patient.visitConfirmed !== true) {
        // 예약확정/재예약확정 상태인 환자는 제외
        if (patient.status === '예약확정' || patient.status === '재예약확정') {
          return false;
        }
        
        const isPostReservationPatient = calculatePostReservationStatus(patient);
        
        // 잠재고객, 부재중, 예약 후 미내원 상태
        const isTargetStatus = patient.status === '부재중' || 
                            patient.status === '잠재고객' || 
                            isPostReservationPatient === true;
        
        if (!isTargetStatus) {
          return false;
        }
        
        // 콜백 기록이 없거나 예정된 콜백이 없는 경우
        if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
          return true;
        }
        
        const hasScheduledCallback = patient.callbackHistory.some((callback: any) => 
          callback.status === '예정'
        );
        
        return !hasScheduledCallback;
      }
      
      // 내원환자 콜백 미등록 (상태미설정)
      if (patient.visitConfirmed === true) {
        // postVisitStatus가 없거나 undefined인 경우
        if (!patient.postVisitStatus) {
          // 내원관리 콜백만 체크
          if (!patient.callbackHistory || patient.callbackHistory.length === 0) {
            return true;
          }
          
          const hasVisitManagementCallback = patient.callbackHistory.some((callback: any) => 
            callback.status === '예정' && 
            callback.isVisitManagementCallback === true
          );
          
          return !hasVisitManagementCallback;
        }
      }
      
      return false;
    });

    // 🔥 4. 리마인더 콜백 - status-filter/route.ts의 reminderCallbacks_registrationNeeded 로직과 동일
    const reminderCallbackPatients = allPatients.filter((patient: any) => {
      if (patient.visitConfirmed !== true) {
        return false;
      }
      
      if (patient.postVisitStatus !== '치료동의') {
        return false;
      }
      
      const treatmentStartDate = patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate;
      if (!treatmentStartDate) {
        return false;
      }
      
      // 치료 시작 예정일이 오늘보다 이전인지 확인
      return treatmentStartDate < selectedDate;
    });

    // 🔥 처리율 계산 로직 - 간단하게 수정
    const calculateProcessingRate = (patients: any[]): { processed: number; rate: number } => {
      if (patients.length === 0) return { processed: 0, rate: 0 };
      
      const processedCount = patients.filter(patient => {
        // 간단한 처리 기준: 예약확정, 종결, 치료시작 상태이거나 완료된 콜백이 있는 경우
        const isResolved = ['예약확정', '재예약확정', '종결'].includes(patient.status) ||
                          patient.postVisitStatus === '치료시작';
        
        const hasCompletedCallback = patient.callbackHistory?.some((callback: any) => 
          callback.status === '완료' || callback.status === '예약확정'
        );
        
        return isResolved || hasCompletedCallback;
      }).length;
      
      return {
        processed: processedCount,
        rate: Math.round((processedCount / patients.length) * 100)
      };
    };

    // 각 카테고리별 처리 현황 계산
    const overdueResult = calculateProcessingRate(overdueCallbackPatients);
    const todayScheduledResult = calculateProcessingRate(todayScheduledPatients);
    const callbackUnregisteredResult = calculateProcessingRate(callbackUnregisteredPatients);
    const reminderCallbacksResult = calculateProcessingRate(reminderCallbackPatients);

    console.log(`🔥 미처리 콜백 세부 현황:`, {
      상담환자: overdueCallbackCounts.consultation,
      내원환자: overdueCallbackCounts.visit,
      총계: totalOverdueCallbacks
    });
    console.log(`🔥 오늘 예정된 콜백 환자 수: ${todayScheduledPatients.length}명`);
    console.log(`🔥 콜백 미등록 환자 수: ${callbackUnregisteredPatients.length}명`);
    console.log(`🔥 리마인더 콜백 환자 수: ${reminderCallbackPatients.length}명`);

    // 🔥 기존 환자별 상담 내용 요약 로직 유지
    const dailyPatients = await patientsCollection.find({
      $or: [
        { callInDate: selectedDate }, // 신규 등록된 환자
        { visitDate: selectedDate }   // 내원한 환자
      ]
    }).toArray();

    console.log(`📊 ${selectedDate} 관련 환자 수: ${dailyPatients.length}명`);

    // 환자별 상담 내용 요약 생성
    const patientConsultations = dailyPatients
      .filter(patient => {
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
        // 상담 내용 조합 로직
        const consultationContents: string[] = [];

        // 1. 최초 상담 내용 (불편한 부분 + 상담메모)
        if (patient.consultation) {
          let initialContent = '';
          if (patient.consultation.treatmentPlan) {
            initialContent += `[불편한 부분] ${patient.consultation.treatmentPlan}`;
          }
          if (patient.consultation.consultationNotes) {
            if (initialContent) initialContent += '\n';
            initialContent += `[상담메모] ${patient.consultation.consultationNotes}`;
          }
          if (initialContent) {
            consultationContents.push(`[최초 상담]\n${initialContent}`);
          }
        }

        // 2. 내원 후 첫 상담 내용
        if (patient.postVisitConsultation?.firstVisitConsultationContent) {
          consultationContents.push(`[내원 후 상담] ${patient.postVisitConsultation.firstVisitConsultationContent}`);
        }

        // 3. 콜백 히스토리 상담 내용들
        if (patient.callbackHistory && patient.callbackHistory.length > 0) {
          const consultationCallbacks = patient.callbackHistory
            .filter((callback: any) => {
              const hasValidResultNotes = callback.resultNotes && 
                                        callback.resultNotes !== 'undefined' && 
                                        callback.resultNotes.trim() !== '';
              const hasValidNotes = callback.notes && 
                                  callback.notes !== 'undefined' && 
                                  callback.notes.trim() !== '';
              
              return hasValidResultNotes || hasValidNotes;
            })
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          consultationCallbacks.forEach((callback: any) => {
            let consultationText = '';
            
            if (callback.resultNotes && 
                callback.resultNotes !== 'undefined' && 
                callback.resultNotes.trim() !== '') {
              consultationText = callback.resultNotes;
            } else if (callback.notes && 
                      callback.notes !== 'undefined' && 
                      callback.notes.trim() !== '') {
              consultationText = callback.notes;
            }
            
            if (consultationText) {
              const callbackDate = new Date(callback.date).toLocaleDateString();
              const callbackType = callback.isVisitManagementCallback ? '내원관리' : '상담관리';
              consultationContents.push(`[${callbackType} ${callback.type} - ${callbackDate}]\n${consultationText}`);
            }
          });
        }

        // 견적금액 계산 (우선순위: 내원 견적 > 전화 견적)
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

        // 진행상황 계산을 위한 필드들
        const visitConfirmed = patient.visitConfirmed === true;
        const isCompleted = patient.isCompleted === true || patient.status === '종결';

        const fullConsultation = consultationContents.length > 0 ? consultationContents.join('\n\n') : '상담내용 없음';
        const consultationSummary = fullConsultation.length > 200 ? 
          fullConsultation.substring(0, 200) + '...' : fullConsultation;

        return {
          _id: patient._id.toString(),
          name: patient.name,
          age: patient.age,
          interestedServices: patient.interestedServices || [],
          consultationSummary,
          fullConsultation,
          estimatedAmount,
          // 일별보고서용 추가 필드들
          callInDate: patient.callInDate,
          visitDate: patient.visitDate,
          hasPhoneConsultation,
          hasVisitConsultation,
          phoneAmount,
          visitAmount,
          // 진행상황 계산을 위한 필드들
          status: patient.status,
          visitConfirmed,
          postVisitStatus: patient.postVisitStatus,
          isCompleted,
          consultationType: patient.consultationType || 'outbound',
          
          // 월보고서 호환을 위한 필드들
          discomfort: patient.consultation?.treatmentPlan ? 
            patient.consultation.treatmentPlan.substring(0, 50) + 
            (patient.consultation.treatmentPlan.length > 50 ? '...' : '') : '',
          fullDiscomfort: patient.consultation?.treatmentPlan || '',
          estimateAgreed: patient.consultation?.estimateAgreed || false
        };
      })
      .sort((a, b) => {
        // 견적금액이 높은 순으로 정렬
        return b.estimatedAmount - a.estimatedAmount;
      });

    console.log(`✅ 상담 내용이 있는 환자: ${patientConsultations.length}명`);

    // 견적금액 계산
    const visitConsultationEstimate = dailyPatients
      .filter(p => {
        const isVisitCompleted = p.visitConfirmed === true;
        const hasVisitEstimate = p.postVisitConsultation?.estimateInfo;
        return isVisitCompleted && hasVisitEstimate;
      })
      .reduce((sum, p) => {
        const estimate = p.postVisitConsultation.estimateInfo;
        const amount = estimate.discountPrice || estimate.regularPrice || 0;
        return sum + amount;
      }, 0);

    const phoneConsultationEstimate = dailyPatients
      .filter(p => {
        const isNotVisitCompleted = p.visitConfirmed !== true;
        const hasPhoneEstimate = p.consultation?.estimatedAmount && p.consultation.estimatedAmount > 0;
        const isCallInToday = p.callInDate === selectedDate;
        return isNotVisitCompleted && hasPhoneEstimate && isCallInToday;
      })
      .reduce((sum, p) => {
        const amount = p.consultation.estimatedAmount || 0;
        return sum + amount;
      }, 0);

    // 치료 시작 견적 계산 (처리일 기준)
    const treatmentStartedEstimate = await patientsCollection.find({
      postVisitStatus: "치료시작",
      $or: [
        { treatmentStartDate: selectedDate },
        { 
          callbackHistory: {
            $elemMatch: {
              actualCompletedDate: selectedDate,
              status: "완료",
              type: { $regex: "치료시작" }
            }
          }
        },
        {
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
        return sum + amount;
      }
      return sum;
    }, 0);

    // 응답 데이터 구성
    const responseData = {
      selectedDate,
      callbackSummary: {
        overdueCallbacks: {
          total: totalOverdueCallbacks, // 🔥 상담환자 + 내원환자 합계
          processed: overdueResult.processed,
          processingRate: overdueResult.rate
        },
        todayScheduled: {
          total: todayScheduledPatients.length,
          processed: todayScheduledResult.processed,
          processingRate: todayScheduledResult.rate
        },
        callbackUnregistered: {
          total: callbackUnregisteredPatients.length,
          processed: callbackUnregisteredResult.processed,
          processingRate: callbackUnregisteredResult.rate
        },
        reminderCallbacks: {
          total: reminderCallbackPatients.length,
          processed: reminderCallbacksResult.processed,
          processingRate: reminderCallbacksResult.rate
        }
      },
      estimateSummary: {
        totalConsultationEstimate: visitConsultationEstimate + phoneConsultationEstimate,
        visitConsultationEstimate,
        phoneConsultationEstimate,
        treatmentStartedEstimate: treatmentStartedTotal
      },
      patientConsultations
    };

    console.log(`✅ 일별 업무 현황 조회 완료 (status-filter와 동기화): ${selectedDate}`);
    console.log(`📊 콜백 처리 요약:`, {
      미처리콜백: `${overdueResult.processed}/${totalOverdueCallbacks}건 (${overdueResult.rate}%) [상담:${overdueCallbackCounts.consultation} + 내원:${overdueCallbackCounts.visit}]`,
      오늘예정: `${todayScheduledResult.processed}/${todayScheduledPatients.length}건 (${todayScheduledResult.rate}%)`,
      콜백미등록: `${callbackUnregisteredResult.processed}/${callbackUnregisteredPatients.length}건 (${callbackUnregisteredResult.rate}%)`,
      리마인더: `${reminderCallbacksResult.processed}/${reminderCallbackPatients.length}건 (${reminderCallbacksResult.rate}%)`
    });

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