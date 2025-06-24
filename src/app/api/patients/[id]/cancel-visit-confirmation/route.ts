// src/app/api/patients/[id]/cancel-visit-confirmation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 활동 로깅 함수 - 에러 처리 개선
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
    console.log('✅ 내원확정 취소 활동 로그 기록 완료');
  } catch (error) {
    console.warn('⚠️ 내원확정 취소 활동 로그 기록 실패:', error);
    // 로그 실패는 무시하고 계속 진행
  }
}

function getCurrentUser(request: NextRequest) {
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

function getKoreanToday() {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🚀 내원확정 취소 API 호출 시작:', params.id);
  
  try {
    // 🔥 MongoDB 연결 테스트
    console.log('📡 MongoDB 연결 시도...');
    const { db } = await connectToDatabase();
    console.log('✅ MongoDB 연결 성공');
    
    const patientId = params.id;
    
    // 🔥 요청 데이터 파싱 테스트
    console.log('📥 요청 데이터 파싱 시도...');
    const data = await request.json();
    const { reason = '관리자 취소' } = data;
    console.log('✅ 요청 데이터 파싱 성공:', { reason });
    
    const currentUser = getCurrentUser(request);

    console.log(`🔍 환자 검색 시작 - ID: ${patientId}`);

    // 환자 검색 - 더 상세한 로그
    let patient;
    
    if (ObjectId.isValid(patientId)) {
      console.log('🔍 ObjectId로 환자 검색 중...');
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
      if (patient) {
        console.log('✅ ObjectId로 환자 찾음:', patient.name);
      }
    }
    
    if (!patient) {
      console.log('🔍 id 필드로 환자 검색 중...');
      patient = await db.collection('patients').findOne({ id: patientId });
      if (patient) {
        console.log('✅ id 필드로 환자 찾음:', patient.name);
      }
    }
    
    if (!patient) {
      console.log('🔍 patientId 필드로 환자 검색 중...');
      patient = await db.collection('patients').findOne({ patientId: patientId });
      if (patient) {
        console.log('✅ patientId 필드로 환자 찾음:', patient.name);
      }
    }
    
    if (!patient) {
      console.error('❌ 환자를 찾을 수 없음:', patientId);
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    console.log('👤 환자 정보:', {
      name: patient.name,
      visitConfirmed: patient.visitConfirmed,
      status: patient.status,
      reservationDate: patient.reservationDate
    });

    // 🔥 내원확정 상태 확인
    if (!patient.visitConfirmed) {
      console.warn('⚠️ 이미 내원확정이 취소된 상태');
      return NextResponse.json({ 
        error: "이미 내원확정이 취소된 상태입니다." 
      }, { status: 400 });
    }

    const todayKorean = getKoreanToday();
    console.log('📅 오늘 날짜:', todayKorean);
    
    // 🔥 콜백 히스토리에 취소 기록 추가
    const callbackHistory = Array.isArray(patient.callbackHistory) ? patient.callbackHistory : [];
    console.log('📋 기존 콜백 히스토리 수:', callbackHistory.length);
    
    const cancelRecord = {
      id: `cancel-${Date.now()}`,
      date: todayKorean,
      status: '취소',
      notes: `[내원확정 취소]\n취소 사유: ${reason}\n취소일: ${todayKorean}\n담당자: ${currentUser.name}`,
      type: '내원확정취소',
      time: new Date().toTimeString().substring(0, 5),
      isCancellationRecord: true,
      isVisitCancellationRecord: true,
      handledBy: currentUser.id,
      handledByName: currentUser.name,
      createdAt: new Date().toISOString()
    };

    // 🔥 내원확정 취소 처리 - 타입 안전하게 처리
    const updateData: any = {
      visitConfirmed: false,
      visitDate: null,              // 내원일 제거
      visitConfirmedAt: null,       // 내원확정일 제거
      visitCancelledAt: todayKorean, // 취소일 기록
      visitCancelReason: reason,     // 취소 사유
      updatedAt: new Date().toISOString(),
      callbackHistory: [...callbackHistory, cancelRecord], // 콜백 히스토리 업데이트
      
      // 🔥 예약 정보는 유지하되 상태 복원
      ...(patient.reservationDate ? { status: '예약확정' } : { 
        // 예약 정보가 없으면 콜백필요로 변경
        status: '콜백필요' 
      })
    };

    console.log('📝 업데이트 데이터:', updateData);
    console.log('📋 새 콜백 히스토리 수:', updateData.callbackHistory.length);

    // MongoDB에 저장
    console.log('💾 MongoDB 업데이트 시작...');
    let result;
    
    try {
      if (ObjectId.isValid(patientId)) {
        console.log('💾 ObjectId로 업데이트 중...');
        result = await db.collection('patients').findOneAndUpdate(
          { _id: new ObjectId(patientId) },
          { $set: updateData },
          { returnDocument: 'after' }
        );
      } else if (patient.id) {
        console.log('💾 id 필드로 업데이트 중...');
        result = await db.collection('patients').findOneAndUpdate(
          { id: patient.id },
          { $set: updateData },
          { returnDocument: 'after' }
        );
      } else {
        console.log('💾 patientId 필드로 업데이트 중...');
        result = await db.collection('patients').findOneAndUpdate(
          { patientId: patient.patientId },
          { $set: updateData },
          { returnDocument: 'after' }
        );
      }
      
      console.log('✅ MongoDB 업데이트 성공');
    } catch (updateError) {
      console.error('❌ MongoDB 업데이트 실패:', updateError);
      throw updateError;
    }

    if (!result) {
      console.error('❌ 업데이트 결과가 null');
      return NextResponse.json({ 
        error: "내원확정 취소 처리에 실패했습니다." 
      }, { status: 500 });
    }

    const updatedPatient = result;
    
    // ID 문자열 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      updatedPatient._id = updatedPatient._id.toString();
    }
    
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    console.log('👤 업데이트된 환자 상태:', {
      name: updatedPatient.name,
      visitConfirmed: updatedPatient.visitConfirmed,
      status: updatedPatient.status,
      visitCancelledAt: updatedPatient.visitCancelledAt
    });

    // 🔥 활동 로그 기록 (에러가 발생해도 응답은 성공)
    try {
      await logActivityToDatabase({
        action: 'patient_visit_confirmation_cancelled',
        targetId: patient.id || patient._id,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          cancelReason: reason,
          cancelledAt: todayKorean,
          previousVisitDate: patient.visitDate,
          previousVisitConfirmedAt: patient.visitConfirmedAt,
          newStatus: updatedPatient.status,
          apiEndpoint: '/api/patients/[id]/cancel-visit-confirmation'
        }
      });
    } catch (logError) {
      console.warn('⚠️ 로그 기록 실패했지만 계속 진행:', logError);
    }

    console.log(`🎉 환자 내원확정 취소 완료 - 환자: ${patient.name} (${patientId})`);

    return NextResponse.json({
      success: true,
      message: '내원확정이 성공적으로 취소되었습니다.',
      updatedPatient,
      cancelInfo: {
        cancelledAt: todayKorean,
        reason: reason,
        previousVisitDate: patient.visitDate,
        previousStatus: patient.status,
        newStatus: updatedPatient.status
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('💥 내원확정 취소 API 전체 오류:', error);
    console.error('💥 오류 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({ 
      error: "내원확정 취소 처리 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}