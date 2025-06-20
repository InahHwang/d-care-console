// /src/app/api/patients/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;
    
    let patient;
    // ObjectId 형식인지 확인
    if (ObjectId.isValid(id)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
    } else {
      // 환자 ID로 검색
      patient = await db.collection('patients').findOne({ patientId: id });
    }
    
    if (!patient) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 기존 환자 데이터 호환성 보장
    const responsePatient = {
      ...patient,
      _id: patient._id.toString(),
      consultationType: patient.consultationType || 'outbound',
      referralSource: patient.referralSource || '' // 🔥 유입경로 기본값 설정
    };
    
    return NextResponse.json(responsePatient, { status: 200 });
  } catch (error) {
    console.error('환자 조회 실패:', error);
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
    
    console.log('API: 환자 업데이트 요청', { 
      id, 
      skipLog, // 🔥 로깅 스킵 여부 확인
      hasData: !!data 
    });
    
    // 업데이트 데이터 준비
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
      // 🔥 유입경로 필드 처리 - 빈 문자열도 허용
      referralSource: data.referralSource !== undefined ? data.referralSource : '',
      // 🔥 상담 타입 기본값 보장
      consultationType: data.consultationType || 'outbound'
    };
    delete updateData._id; // _id는 업데이트 불가
    
    console.log('API: 처리된 업데이트 데이터', updateData);
    
    let result;
    if (ObjectId.isValid(id)) {
      console.log('API: ObjectId로 업데이트 시도', id);
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else {
      console.log('API: patientId로 업데이트 시도', id);
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }
    
    if (!result) {
      console.error('API: 환자를 찾을 수 없음', id);
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 🔥 업데이트된 환자 데이터 로깅
    console.log('API: 환자 업데이트 성공', {
      _id: result._id,
      name: result.name,
      consultationType: result.consultationType,
      referralSource: result.referralSource, // 🔥 유입경로 로깅 추가
      skipLog // 🔥 로깅 스킵 여부도 표시
    });
    
    // 🔥 백엔드에서 별도 활동 로그 기록이 있었다면 여기서 스킵
    if (!skipLog) {
      // 만약 여기서 활동 로그를 기록하는 코드가 있었다면, 
      // skipLog가 false일 때만 실행되도록 해야 함
      console.log('API: 백엔드 활동 로그 기록 (현재는 없음)');
    } else {
      console.log('API: 🚫 프론트엔드에서 로깅 처리하므로 백엔드 로깅 스킵');
    }
    
    // 🔥 응답 데이터 구조 확인 및 정규화
    const responseData = {
      ...result,
      _id: result._id.toString(), // ObjectId를 문자열로 변환
      id: result.id || result._id.toString(), // id 필드 보장
      // 🔥 기존 환자 데이터 호환성 보장
      consultationType: result.consultationType || 'outbound',
      referralSource: result.referralSource || '' // 🔥 유입경로 기본값 보장
    };
    
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('환자 정보 업데이트 실패:', error);
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

    console.log(`삭제 시도: 환자 ID = ${id}`);

    // 먼저 환자 찾기 시도
    let patient;

    // 1. MongoDB ObjectId로 시도
    if (ObjectId.isValid(id)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
    }

    // 2. id 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: id });
    }

    // 3. patientId 필드로 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: id });
    }

    if (!patient) {
      console.log('삭제 실패: 환자를 찾을 수 없음');
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 찾은 환자의 _id로 삭제
    const result = await db.collection('patients').deleteOne({ _id: patient._id });

    console.log(`삭제 결과: ${JSON.stringify(result)}`);

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '환자 삭제에 실패했습니다.' }, { status: 500 });
    }

    // _id를 문자열로 변환하여 반환
    return NextResponse.json({ 
      success: true, 
      message: '환자가 삭제되었습니다.',
      deletedId: patient._id.toString() 
    }, { status: 200 });
  } catch (error) {
    console.error('환자 삭제 실패:', error);
    return NextResponse.json({ error: '환자 삭제에 실패했습니다.' }, { status: 500 });
  }
}