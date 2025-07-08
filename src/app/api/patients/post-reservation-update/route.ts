// src/app/api/patients/post-reservation-update/route.ts - 예약 후 미내원 환자 자동 분류

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// 🔥 활동 로깅을 위한 함수 추가
async function logActivityToDatabase(activityData: any) {
  try {
    const { db } = await connectToDatabase();
    
    const logEntry = {
      ...activityData,
      timestamp: new Date().toISOString(),
      source: 'backend_api',
      level: 'audit'
    };
    
    await db.collection('activity_logs').insertOne(logEntry);
    console.log('✅ 예약 후 미내원 자동 분류 로그 기록 완료:', activityData.action);
  } catch (error) {
    console.warn('⚠️ 예약 후 미내원 자동 분류 로그 기록 실패:', error);
  }
}

// 요청 헤더에서 사용자 정보 추출 (임시)
function getCurrentUser(request: NextRequest) {
  return {
    id: 'system-auto-classifier',
    name: '자동 분류 시스템'
  };
}

// 한국 시간 기준 오늘 날짜 반환 함수
function getKoreanToday() {
  const now = new Date();
  // UTC+9 (한국 시간) 적용
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const currentUser = getCurrentUser(request);
    const today = getKoreanToday();

    console.log('🔥 예약 후 미내원 환자 자동 분류 시작:', today);

    // 예약확정 상태이면서 내원확정이 되지 않은 환자들 중 예약일이 지난 환자들 찾기
    const candidatePatients = await db.collection('patients').find({
      status: '예약확정',
      visitConfirmed: { $ne: true },
      reservationDate: { 
        $exists: true, 
        $nin: [null, ''], 
        $lt: today  // 예약일이 오늘보다 이전
      },
      isPostReservationPatient: { $ne: true },  // 아직 예약 후 미내원으로 분류되지 않은 환자
      isCompleted: { $ne: true }  // 종결되지 않은 환자
    }).toArray();

    console.log(`🔍 예약 후 미내원 분류 대상 환자: ${candidatePatients.length}명`);

    if (candidatePatients.length === 0) {
      return NextResponse.json({
        success: true,
        message: '분류할 예약 후 미내원 환자가 없습니다.',
        updatedCount: 0,
        updatedPatients: []
      });
    }

    const updatedPatients = [];

    // 각 환자를 예약 후 미내원 상태로 업데이트
    for (const patient of candidatePatients) {
      try {
        const updateData = {
          isPostReservationPatient: true,
          currentConsultationStage: 'post_reservation',
          updatedAt: new Date().toISOString(),
          // 기존 상태는 유지하되 예약 후 미내원 표시만 추가
        };

        const result = await db.collection('patients').findOneAndUpdate(
          { _id: patient._id },
          { $set: updateData },
          { returnDocument: 'after' }
        );

        if (result) {
          // ObjectId를 문자열로 변환
          if (result._id && typeof result._id !== 'string') {
            (result as any)._id = result._id.toString();
          }
          
          if (!result.id && result._id) {
            result.id = result._id;
          }

          updatedPatients.push(result);

          // 개별 환자 로그 기록
          await logActivityToDatabase({
            action: 'auto_classify_post_reservation_patient',
            targetId: result.id || result._id,
            targetName: result.name,
            userId: currentUser.id,
            userName: currentUser.name,
            details: {
              reservationDate: patient.reservationDate,
              reservationTime: patient.reservationTime || '',
              daysPastReservation: Math.floor((new Date(today).getTime() - new Date(patient.reservationDate).getTime()) / (1000 * 60 * 60 * 24)),
              previousStatus: patient.status,
              apiEndpoint: '/api/patients/post-reservation-update'
            }
          });

          console.log(`✅ 환자 ${result.name} 예약 후 미내원 분류 완료 (예약일: ${patient.reservationDate})`);
        }
      } catch (error) {
        console.error(`❌ 환자 ${patient.name} 분류 실패:`, error);
        
        // 개별 실패 로그
        await logActivityToDatabase({
          action: 'auto_classify_post_reservation_patient_error',
          targetId: patient._id.toString(),
          targetName: patient.name,
          userId: currentUser.id,
          userName: currentUser.name,
          details: {
            error: error instanceof Error ? error.message : '알 수 없는 오류',
            reservationDate: patient.reservationDate,
            apiEndpoint: '/api/patients/post-reservation-update'
          }
        });
      }
    }

    // 전체 작업 완료 로그
    await logActivityToDatabase({
      action: 'auto_classify_post_reservation_patients_complete',
      targetId: 'batch_operation',
      targetName: `${updatedPatients.length}명 환자`,
      userId: currentUser.id,
      userName: currentUser.name,
      details: {
        totalCandidates: candidatePatients.length,
        successfulUpdates: updatedPatients.length,
        failedUpdates: candidatePatients.length - updatedPatients.length,
        classificationDate: today,
        apiEndpoint: '/api/patients/post-reservation-update'
      }
    });

    console.log(`🎯 예약 후 미내원 환자 자동 분류 완료: ${updatedPatients.length}/${candidatePatients.length}명 성공`);

    return NextResponse.json({
      success: true,
      message: `${updatedPatients.length}명의 환자가 예약 후 미내원 상태로 분류되었습니다.`,
      updatedCount: updatedPatients.length,
      updatedPatients: updatedPatients,
      totalCandidates: candidatePatients.length
    });

  } catch (error) {
    console.error('🚨 예약 후 미내원 환자 자동 분류 실패:', error);

    // 전체 실패 로그
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'auto_classify_post_reservation_patients_exception',
        targetId: 'batch_operation',
        targetName: '자동 분류 시스템',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          apiEndpoint: '/api/patients/post-reservation-update'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }

    return NextResponse.json({
      success: false,
      error: '예약 후 미내원 환자 자동 분류에 실패했습니다.',
      message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

// GET 메서드로 현재 분류 대상 환자 수 조회
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const today = getKoreanToday();

    // 분류 대상 환자 수 조회
    const candidateCount = await db.collection('patients').countDocuments({
      status: '예약확정',
      visitConfirmed: { $ne: true },
      reservationDate: { 
        $exists: true, 
        $nin: [null, ''], 
        $lt: today 
      },
      isPostReservationPatient: { $ne: true },
      isCompleted: { $ne: true }
    });

    // 이미 분류된 환자 수 조회
    const classifiedCount = await db.collection('patients').countDocuments({
      isPostReservationPatient: true
    });

    return NextResponse.json({
      success: true,
      today: today,
      candidateCount: candidateCount,
      classifiedCount: classifiedCount,
      message: candidateCount > 0 
        ? `${candidateCount}명의 환자가 예약 후 미내원 분류 대상입니다.`
        : '분류 대상 환자가 없습니다.'
    });

  } catch (error) {
    console.error('🚨 예약 후 미내원 환자 조회 실패:', error);
    
    return NextResponse.json({
      success: false,
      error: '예약 후 미내원 환자 조회에 실패했습니다.'
    }, { status: 500 });
  }
}