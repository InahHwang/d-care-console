// src/app/api/patients/[id]/visit-confirmation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 🔥 활동 로깅을 위한 함수 - 에러 처리 개선
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
    console.log('✅ 내원확정 활동 로그 기록 완료:', activityData.action);
  } catch (error) {
    console.warn('⚠️ 내원확정 활동 로그 기록 실패:', error);
    // 로그 실패는 무시하고 계속 진행
  }
}

// 요청 헤더에서 사용자 정보 추출 (임시)
function getCurrentUser(request: NextRequest) {
  return {
    id: 'temp-user-001',
    name: '임시 관리자'
  };
}

// 한국 시간 기준 오늘 날짜 반환
function getKoreanToday() {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🚀 내원확정 API 호출 시작:', params.id);
  
  try {
    // 🔥 MongoDB 연결 테스트
    console.log('📡 MongoDB 연결 시도...');
    const { db } = await connectToDatabase();
    console.log('✅ MongoDB 연결 성공');
    
    const patientId = params.id;
    
    // 🔥 요청 데이터 파싱 테스트 - 빈 body 처리 추가
    console.log('📥 요청 데이터 파싱 시도...');
    let data = {};
    try {
      const requestText = await request.text();
      console.log('🔍 요청 본문:', requestText);
      
      if (requestText && requestText.trim() !== '') {
        data = JSON.parse(requestText);
      } else {
        console.log('⚠️ 빈 요청 본문 - 기본값 사용');
        data = {};
      }
    } catch (parseError) {
      console.warn('⚠️ JSON 파싱 실패 - 기본값 사용:', parseError);
      data = {};
    }
    
    const { 
      reservationDate, 
      reservationTime, 
      isDirectVisitConfirmation = false 
    } = data as any;
    
    console.log('✅ 요청 데이터 파싱 성공:', { 
      reservationDate, 
      reservationTime, 
      isDirectVisitConfirmation 
    });
    
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
      
      // 로그 기록 시도 (실패해도 계속 진행)
      try {
        await logActivityToDatabase({
          action: 'patient_visit_confirmation_error',
          targetId: patientId,
          targetName: '알 수 없음',
          userId: currentUser.id,
          userName: currentUser.name,
          details: {
            error: '환자를 찾을 수 없음',
            reservationDate,
            reservationTime,
            apiEndpoint: '/api/patients/[id]/visit-confirmation'
          }
        });
      } catch (logError) {
        console.warn('⚠️ 에러 로그 기록 실패:', logError);
      }
      
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    console.log('👤 환자 정보:', {
      name: patient.name,
      visitConfirmed: patient.visitConfirmed,
      status: patient.status,
      reservationDate: patient.reservationDate
    });

    // 🔥 이미 내원확정된 상태인지 확인 (경고만 출력, 에러는 아님)
    if (patient.visitConfirmed) {
      console.warn('⚠️ 이미 내원확정된 상태 - 업데이트 계속 진행');
    }

    const todayKorean = getKoreanToday();
    console.log('📅 오늘 날짜:', todayKorean);
    
    // 🔥 내원확정 처리 - 기본값 추가
    const updateData: any = {
      visitConfirmed: true,
      visitDate: reservationDate || patient.reservationDate || todayKorean,
      reservationDate: reservationDate || patient.reservationDate,
      reservationTime: reservationTime || patient.reservationTime,
      visitConfirmedAt: todayKorean,
      updatedAt: new Date().toISOString()
    };

    console.log('📝 업데이트 데이터:', updateData);

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
      
      // 로그 기록 시도
      try {
        await logActivityToDatabase({
          action: 'patient_visit_confirmation_error',
          targetId: patientId,
          targetName: patient.name,
          userId: currentUser.id,
          userName: currentUser.name,
          details: {
            error: '환자 정보 업데이트 실패 - result가 null',
            reservationDate,
            reservationTime,
            apiEndpoint: '/api/patients/[id]/visit-confirmation'
          }
        });
      } catch (logError) {
        console.warn('⚠️ 에러 로그 기록 실패:', logError);
      }
      
      return NextResponse.json({ error: "환자 정보 업데이트에 실패했습니다." }, { status: 500 });
    }

    const updatedPatient = result;
    
    // ID를 문자열로 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    console.log('👤 업데이트된 환자 상태:', {
      name: updatedPatient.name,
      visitConfirmed: updatedPatient.visitConfirmed,
      visitDate: updatedPatient.visitDate,
      visitConfirmedAt: updatedPatient.visitConfirmedAt
    });

    // 🔥 백엔드 로그 - 내원확정 성공 (에러가 발생해도 응답은 성공)
    try {
      await logActivityToDatabase({
        action: 'patient_visit_confirmation_success',
        targetId: patient.id || patient._id,
        targetName: patient.name,
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          visitDate: updateData.visitDate,
          reservationDate: updateData.reservationDate,
          reservationTime: updateData.reservationTime,
          confirmedAt: todayKorean,
          isDirect: isDirectVisitConfirmation,
          previousStatus: patient.status,
          apiEndpoint: '/api/patients/[id]/visit-confirmation',
          userAgent: request.headers.get('user-agent')?.substring(0, 100)
        }
      });
    } catch (logError) {
      console.warn('⚠️ 성공 로그 기록 실패했지만 계속 진행:', logError);
    }

    console.log(`🎉 환자 내원확정 처리 완료 - 환자: ${patient.name} (${patientId})`);

    return NextResponse.json({
      success: true,
      message: '내원확정 처리가 완료되었습니다.',
      updatedPatient,
      visitInfo: {
        visitDate: updateData.visitDate,
        reservationDate: updateData.reservationDate,
        reservationTime: updateData.reservationTime,
        confirmedAt: todayKorean
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error('💥 내원확정 API 전체 오류:', error);
    console.error('💥 오류 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    // 에러 로그 기록 시도
    try {
      const currentUser = getCurrentUser(request);
      await logActivityToDatabase({
        action: 'patient_visit_confirmation_exception',
        targetId: params.id,
        targetName: '알 수 없음',
        userId: currentUser.id,
        userName: currentUser.name,
        details: {
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          apiEndpoint: '/api/patients/[id]/visit-confirmation'
        }
      });
    } catch (logError) {
      console.warn('예외 로그 기록 실패:', logError);
    }
    
    return NextResponse.json({ 
      error: "내원확정 처리 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : '알 수 없는 오류',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}