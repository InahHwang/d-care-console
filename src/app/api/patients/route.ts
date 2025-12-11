// /src/app/api/patients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// Patient 인터페이스 정의 또는 import
interface PatientFromDB {
  _id: ObjectId;
  id?: string;
  patientId: string;
  name: string;
  phoneNumber: string;
  consultationType?: 'inbound' | 'outbound'; // 🔥 추가
  inboundPhoneNumber?: string; // 🔥 추가
  referralSource?: string; // 🔥 유입경로 추가
  // 기타 필요한 필드들...
  [key: string]: any; // 다른 모든 필드를 허용
}

/**
 * 🔥 예약 후 미내원 환자 판별 헬퍼 함수
 */
function calculatePostReservationStatus(patient: any): boolean {
  // 예약확정 상태이고, 내원확정이 안 되었으며, 예약일이 지난 경우
  if (patient.status === '예약확정' && 
      !patient.visitConfirmed && 
      patient.reservationDate) {
    
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const reservationDate = patient.reservationDate;
    
    return reservationDate < todayString;
  }
  
  return false;
}

function normalizePatientResponse(patient: any) {
  if (!patient) return patient;
  
  const stringId = typeof patient._id === 'string' ? patient._id : patient._id.toString();
  const isCurrentlyPostReservation = calculatePostReservationStatus(patient);

  // 🔥 여기에 오늘 예약 계산 로직 추가
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD 형태
  
  const isTodayReservationPatient = patient.status === '예약확정' && 
                                   !patient.visitConfirmed && 
                                   patient.reservationDate === todayString;
  
  // 🔥 한번이라도 예약 후 미내원이었다면 영구 표시
  const hasBeenPostReservation = patient.hasBeenPostReservationPatient || isCurrentlyPostReservation;
  
  return {
    ...patient,
    _id: stringId,
    id: patient.id || stringId,
    consultationType: patient.consultationType || 'outbound',
    referralSource: patient.referralSource || '',
    isPostReservationPatient: isCurrentlyPostReservation,
    hasBeenPostReservationPatient: hasBeenPostReservation, // 🔥 영구 기록
    isTodayReservationPatient: isTodayReservationPatient // 🔥 새로 추가
  };
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    console.log('🔍 API: 환자 목록 조회 시작');

    // 🔥 성능 최적화: 필요한 필드만 조회 (Projection)
    const projection = {
      _id: 1,
      id: 1,
      patientId: 1,
      name: 1,
      phoneNumber: 1,
      age: 1,
      gender: 1,
      status: 1,
      consultationType: 1,
      inboundPhoneNumber: 1,
      referralSource: 1,
      interestedServices: 1,
      region: 1,
      callInDate: 1,
      reservationDate: 1,
      visitConfirmed: 1,
      postVisitStatus: 1,
      isCompleted: 1,
      isPostReservationPatient: 1,
      hasBeenPostReservationPatient: 1,
      callbackHistory: 1,
      memo: 1,
      notes: 1,
      createdAt: 1,
      updatedAt: 1,
      createdBy: 1,
      createdByName: 1,
      lastModifiedBy: 1,
      lastModifiedByName: 1,
      lastModifiedAt: 1,
      eventTargetInfo: 1,
      postVisitConsultation: 1,
    };

    // 🔥 최신 등록순으로 정렬 (createdAt 내림차순) + Projection 적용
    const patients = await db
      .collection('patients')
      .find({}, { projection })
      .sort({ createdAt: -1 })
      .toArray();
    
    console.log('🔍 API: 조회된 환자 수:', patients.length);
    
    // 🔥 ID 필드 정규화 및 예약 후 미내원 계산 - 모든 환자 객체에 id와 _id 모두 보장
    const normalizedPatients = patients.map((patient, index) => {
      const normalized = normalizePatientResponse(patient);
      
      // 처음 몇 개만 디버깅 로그
      if (index < 3) {
        console.log(`🔍 API: 환자 ${index + 1} ID 정규화 및 상태 계산:`, {
          original_id: patient._id,
          original_idType: typeof patient._id,
          normalized_id: normalized.id,
          normalized_objectId: normalized._id,
          patientName: normalized.name,
          status: normalized.status,
          visitConfirmed: normalized.visitConfirmed,
          reservationDate: normalized.reservationDate,
          isPostReservationPatient: normalized.isPostReservationPatient // 🔥 예약 후 미내원 로그
        });
      }
      
      return normalized;
    });
    
    // 🔥 예약 후 미내원 환자 수 로그
    const postReservationCount = normalizedPatients.filter(p => p.isPostReservationPatient).length;
    console.log('🔍 API: 예약 후 미내원 환자 수:', postReservationCount);
    
    console.log('🔍 API: ID 정규화 및 상태 계산 완료');
    
    // 🔥 성능 최적화를 위한 헤더 추가
    const response = NextResponse.json({ 
      patients: normalizedPatients,
      totalItems: normalizedPatients.length 
    });
    
    // 🔥 캐시 제어 헤더 설정 (속도개선 2 버전)
    response.headers.set('Cache-Control', 'max-age=10, stale-while-revalidate=30');
    
    return response;
    
  } catch (error) {
    console.error('🚨 API: 환자 목록 조회 실패:', error);
    return NextResponse.json({ error: '환자 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let data: any = null;
  
  try {
    const { db } = await connectToDatabase();
    data = await request.json();

    console.log('🔍 API: 환자 등록 시작');

    // 🔥 Base64로 인코딩된 사용자 정보 디코딩
    const userInfoHeader = request.headers.get('X-User-Info');
    let currentUser = null;
    if (userInfoHeader) {
      try {
        // Base64 디코딩 후 JSON 파싱
        const decodedUserInfo = decodeURIComponent(atob(userInfoHeader));
        currentUser = JSON.parse(decodedUserInfo);
        console.log('🔥 API: 디코딩된 사용자 정보:', currentUser);
      } catch (e) {
        console.warn('사용자 정보 디코딩 실패:', e);
      }
    }

    // 입력 데이터 검증
    if (!data.name || !data.phoneNumber) {
      return NextResponse.json({ error: '필수 입력값이 누락되었습니다.' }, { status: 400 });
    }

    // 🔥 최종 강화된 나이 검증 로직
    console.log('🔍 API: 나이 필드 원본 값:', {
      age: data.age,
      type: typeof data.age,
      isUndefined: data.age === undefined,
      isNull: data.age === null,
      isEmpty: data.age === '',
      isOne: data.age === 1,  // 🔥 1 값 특별 확인
      isNaN: isNaN(data.age),
      stringified: JSON.stringify(data.age)
    });

    // 🚨 나이 필드 완전 제거 조건들 (1 추가)
    const shouldRemoveAge = (
      data.age === undefined ||
      data.age === null ||
      data.age === '' ||
      data.age === 0 ||
      data.age === 1 ||  // 🔥 1도 의심스러운 값으로 처리
      (typeof data.age === 'string' && data.age.trim() === '') ||
      (typeof data.age === 'string' && data.age.trim() === '1') ||  // 🔥 문자열 "1"도 차단
      isNaN(Number(data.age)) ||
      Number(data.age) < 2 ||  // 🔥 최소 나이를 2세로 상향
      Number(data.age) > 120
    );

    if (shouldRemoveAge) {
      console.log('🚨 API: 나이 필드 완전 제거 (의심스러운 값)', {
        originalValue: data.age,
        reason: data.age === 1 ? 'AGE_ONE_BLOCKED' : 'INVALID_VALUE'
      });
      delete data.age;
    } else {
      // 유효한 나이 값으로 변환
      const validAge = parseInt(String(data.age), 10);
      
      // 🔥 한 번 더 검증
      if (validAge === 1) {
        console.log('🚨 API: 변환 후에도 1이므로 제거');
        delete data.age;
      } else {
        data.age = validAge;
        console.log('✅ API: 유효한 나이 값 설정:', validAge);
      }
    }

    // 🔥 최종 데이터 확인
    console.log('🔍 API: 최종 저장 데이터:', {
      hasAge: 'age' in data,
      ageValue: data.age,
      ageType: typeof data.age,
      patientName: data.name
    });

    // 중복 번호 확인
    const existingPatient = await db.collection('patients').findOne({ phoneNumber: data.phoneNumber });
    if (existingPatient) {
      return NextResponse.json({ error: '이미 등록된 전화번호입니다.' }, { status: 409 });
    }

    // 환자 ID 생성 로직 (기존과 동일)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = year + month + day;
    
    const todayPattern = new RegExp(`^PT-${datePrefix}`);
    const todayPatientCount = await db.collection('patients').countDocuments({
      patientId: todayPattern
    });
    
    const nextSequence = String(todayPatientCount + 1).padStart(3, '0');
    let patientId = `PT-${datePrefix}${nextSequence}`;
    
    const existingIdPatient = await db.collection('patients').findOne({ patientId });
    if (existingIdPatient) {
      const timestamp = Date.now().toString().slice(-3);
      patientId = `PT-${datePrefix}${timestamp}`;
    }

    // 🔥 담당자 정보 포함하여 환자 정보 생성
    const nowISO = new Date().toISOString();
    const newPatient = {
      ...data,
      patientId,
      createdAt: nowISO,
      updatedAt: nowISO,
      lastConsultation: '',
      reminderStatus: '초기',
      visitConfirmed: false,
      consultationType: data.consultationType || 'outbound',
      referralSource: data.referralSource || '',
      
      // 🔥 담당자 정보 추가
      createdBy: currentUser?.id || 'unknown',
      createdByName: currentUser?.name || '알 수 없음',
      lastModifiedBy: currentUser?.id || 'unknown',
      lastModifiedByName: currentUser?.name || '알 수 없음',
      lastModifiedAt: nowISO
    };

    console.log('🔥 담당자 정보 포함 환자 등록:', {
      patientId,
      name: newPatient.name,
      createdBy: newPatient.createdBy,
      createdByName: newPatient.createdByName
    });

    const result = await db.collection('patients').insertOne(newPatient);
    
    // 🔥 생성된 환자 데이터에 ID 정규화 적용
    const insertedId = result.insertedId.toString();
    const createdPatient = {
      ...newPatient,
      _id: insertedId,
      id: insertedId  // 🔥 id 필드도 명시적으로 설정
    };
    
    // 🔥 응답 데이터 정규화 (예약 후 미내원 계산 포함)
    const normalizedPatient = normalizePatientResponse(createdPatient);
    
    console.log('🔍 API: 환자 등록 성공 및 ID 정규화:', {
      patientId: normalizedPatient.patientId,
      _id: normalizedPatient._id,
      id: normalizedPatient.id,
      name: normalizedPatient.name,
      isPostReservationPatient: normalizedPatient.isPostReservationPatient // 🔥 예약 후 미내원 로그
    });

    // 🔥 성능 최적화를 위한 헤더 추가
    const response = NextResponse.json(normalizedPatient, { status: 201 });
    
    // 🔥 캐시 제어 헤더 설정 (속도개선 2 버전)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('🚨 API: 환자 등록 실패 상세 정보:', {
      error: error,
      errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestData: data
    });
    
    // 🔥 구체적인 오류 메시지 제공
    let errorMessage = '환자 등록에 실패했습니다.';
    
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        errorMessage = '이미 등록된 전화번호입니다.';
      } else if (error.message.includes('validation')) {
        errorMessage = '입력 데이터가 올바르지 않습니다.';
      } else if (error.message.includes('connection')) {
        errorMessage = '데이터베이스 연결에 실패했습니다.';
      } else {
        errorMessage = `서버 오류: ${error.message}`;
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}