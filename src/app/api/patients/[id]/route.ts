// /src/app/api/patients/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { validateAge } from '@/utils/mongodb';

/**
 * 환자 객체의 ID 필드들을 정규화하는 헬퍼 함수
 */
function normalizePatientResponse(patient: any) {
  if (!patient) return patient;
  
  // ObjectId를 문자열로 변환
  const stringId = typeof patient._id === 'string' ? patient._id : patient._id.toString();
  
  return {
    ...patient,
    _id: stringId,                    // MongoDB ObjectId (문자열)
    id: patient.id || stringId,       // 프론트엔드용 ID (id가 없으면 _id 사용)
    // patientId는 별도 필드로 유지 (환자 번호 등)
    consultationType: patient.consultationType || 'outbound', // 🔥 기본값 보장
    referralSource: patient.referralSource || '' // 🔥 유입경로 기본값 설정
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;
    
    console.log('🔍 API: 단일 환자 조회 시작:', id);
    
    let patient;
    // ObjectId 형식인지 확인
    if (ObjectId.isValid(id)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
      console.log('🔍 API: ObjectId로 조회 시도');
    } else {
      // 환자 ID로 검색
      patient = await db.collection('patients').findOne({ patientId: id });
      console.log('🔍 API: patientId로 조회 시도');
    }
    
    if (!patient) {
      console.log('🚨 API: 환자를 찾을 수 없음:', id);
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 ID 필드 정규화
    const normalizedPatient = normalizePatientResponse(patient);
    
    console.log('🔍 API: 단일 환자 ID 정규화 완료:', {
      original_id: patient._id,
      normalized_id: normalizedPatient.id,
      normalized_objectId: normalizedPatient._id,
      patientName: normalizedPatient.name,
      isPostReservationPatient: normalizedPatient.isPostReservationPatient // 🔥 추가
    });
    
    return NextResponse.json(normalizedPatient, { status: 200 });
  } catch (error) {
    console.error('🚨 API: 환자 조회 실패:', error);
    return NextResponse.json({ error: '환자 정보를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;
    const data = await request.json();
    
    // 🔥 프론트엔드에서 로깅 처리하는 경우 백엔드 로깅 스킵
    const skipLog = request.headers.get('X-Skip-Activity-Log') === 'true';
    
    console.log('🔍 API: 환자 업데이트 시작:', { 
      id, 
      skipLog,
      hasData: !!data,
      hasConsultation: !!data.consultation,
      ageValue: data.age,
      ageType: typeof data.age,
      regionValue: data.region
    });
    
    // 🔥 업데이트 데이터 처리 - undefined 필드는 요청에서 제외하여 기존 값 유지
    let updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
      referralSource: data.referralSource !== undefined ? data.referralSource : '',
      consultationType: data.consultationType || 'outbound'
    };
    
    // 🔥 나이 필드 검증 및 처리
    const ageValidation = validateAge(data.age);

    if (ageValidation.shouldRemove) {
      console.log('🚨 API: 나이 필드 완전 제거 (의심스러운 값)', {
        originalValue: data.age,
        reason: data.age === 1 ? 'AGE_ONE_BLOCKED' : 'INVALID_VALUE'
      });
      delete updateData.age;
      
      // 🔥 기존 DB에서도 나이 필드 제거
      if (!updateData.$unset) updateData.$unset = {};
      updateData.$unset.age = "";
    } else if (ageValidation.isValid && ageValidation.cleanedAge) {
      updateData.age = ageValidation.cleanedAge;
      console.log('✅ API: 유효한 나이 값 설정:', ageValidation.cleanedAge);
    }
    
    // 🔥 지역이 undefined인 경우 updateData에서 제거 (기존 DB 값 유지)
    if (data.region === undefined) {
      delete updateData.region;
      console.log('🔥 API: 지역 필드가 undefined이므로 업데이트에서 제외 (기존 값 유지)');
    }
    
    // 🔥 상담 정보가 포함된 경우 특별 처리
    if (data.consultation) {
      console.log('🔥 API: 상담 정보 업데이트 감지:', data.consultation);
      updateData.consultation = {
        ...data.consultation,
        updatedAt: new Date().toISOString()
      };
    }
    
    delete updateData._id; // _id는 업데이트 불가
    
    console.log('🔍 API: 처리된 업데이트 데이터', {
      hasConsultation: !!updateData.consultation,
      consultationData: updateData.consultation,
      ageInUpdate: 'age' in updateData,
      ageValue: updateData.age,
      regionInUpdate: 'region' in updateData,
      regionValue: updateData.region,
      updateDataKeys: Object.keys(updateData)
    });

    // MongoDB 업데이트 처리
    const mongoUpdate = updateData.$unset 
      ? { 
          $set: (() => {
            const { $unset, ...setData } = updateData;
            return setData;
          })(),
          $unset: updateData.$unset 
        }
      : { $set: updateData };

    console.log('🔍 API: MongoDB 업데이트 쿼리:', JSON.stringify(mongoUpdate, null, 2));

    // 🔥 MongoDB 업데이트 - ObjectId 또는 patientId로 업데이트
    let result;
    if (ObjectId.isValid(id)) {
      console.log('🔍 API: ObjectId로 업데이트 시도', id);
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(id) },
        mongoUpdate,
        { returnDocument: 'after' }
      );
    } else {
      console.log('🔍 API: patientId로 업데이트 시도', id);
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: id },
        mongoUpdate,
        { returnDocument: 'after' }
      );
    }
    
    if (!result) {
      console.error('🚨 API: 환자를 찾을 수 없음', id);
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 백엔드에서 별도 활동 로그 기록이 있었다면 여기서 스킵
    if (!skipLog) {
      console.log('🔍 API: 백엔드 활동 로그 기록 (현재는 없음)');
    } else {
      console.log('🔍 API: 🚫 프론트엔드에서 로깅 처리하므로 백엔드 로깅 스킵');
    }
    
    // 🔥 응답 데이터 정규화
    const normalizedPatient = normalizePatientResponse(result);
    
    console.log('🔥 API: 환자 업데이트 완료 및 응답:', {
      id,
      normalized_id: normalizedPatient.id,
      patientName: normalizedPatient.name,
      hasConsultation: !!normalizedPatient.consultation,
      ageAfterUpdate: normalizedPatient.age,
      regionAfterUpdate: normalizedPatient.region,
      skipLog
    });
    
    return NextResponse.json(normalizedPatient, { status: 200 });
  } catch (error) {
    console.error('🚨 API: 환자 정보 업데이트 실패:', error);
    return NextResponse.json({ error: '환자 정보 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;

    console.log('🔍 API: 환자 삭제 시도:', id);

    // 먼저 환자 찾기 시도
    let patient;

    // 1. MongoDB ObjectId로 시도
    if (ObjectId.isValid(id)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
      console.log('🔍 API: ObjectId로 환자 검색 시도');
    }

    // 2. id 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: id });
      console.log('🔍 API: id 필드로 환자 검색 시도');
    }

    // 3. patientId 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: id });
      console.log('🔍 API: patientId 필드로 환자 검색 시도');
    }

    if (!patient) {
      console.log('🚨 API: 삭제할 환자를 찾을 수 없음:', id);
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    console.log('🔍 API: 삭제할 환자 찾음:', {
      _id: patient._id,
      name: patient.name,
      patientId: patient.patientId
    });

    // 찾은 환자의 _id로 삭제
    const result = await db.collection('patients').deleteOne({ _id: patient._id });

    console.log('🔍 API: 삭제 결과:', result);

    if (result.deletedCount === 0) {
      console.error('🚨 API: 환자 삭제 실패');
      return NextResponse.json({ error: '환자 삭제에 실패했습니다.' }, { status: 500 });
    }

    // _id를 문자열로 변환하여 반환
    const deletedId = patient._id.toString();
    
    console.log('🔍 API: 환자 삭제 성공:', {
      deletedId,
      name: patient.name
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '환자가 삭제되었습니다.',
      deletedId: deletedId
    }, { status: 200 });
  } catch (error) {
    console.error('🚨 API: 환자 삭제 실패:', error);
    return NextResponse.json({ error: '환자 삭제에 실패했습니다.' }, { status: 500 });
  }
}