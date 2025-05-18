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
    
    // 업데이트 데이터 준비
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    delete updateData._id; // _id는 업데이트 불가
    
    let result;
    if (ObjectId.isValid(id)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }
    
    if (!result) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    return NextResponse.json(result, { status: 200 });
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
    
    let result;
    if (ObjectId.isValid(id)) {
      result = await db.collection('patients').deleteOne({ _id: new ObjectId(id) });
    } else {
      result = await db.collection('patients').deleteOne({ patientId: id });
    }
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: '환자가 삭제되었습니다.' }, { status: 200 });
  } catch (error) {
    console.error('환자 삭제 실패:', error);
    return NextResponse.json({ error: '환자 삭제에 실패했습니다.' }, { status: 500 });
  }
}