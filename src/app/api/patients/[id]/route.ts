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
    
    return NextResponse.json(patient, { status: 200 });
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
    
    console.log('API: 환자 업데이트 요청', { id, data });
    
    // 업데이트 데이터 준비
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    delete updateData._id; // _id는 업데이트 불가
    
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
      consultationType: result.consultationType
    });
    
    // 🔥 응답 데이터 구조 확인 및 정규화
    const responseData = {
      ...result,
      _id: result._id.toString(), // ObjectId를 문자열로 변환
      id: result.id || result._id.toString() // id 필드 보장
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