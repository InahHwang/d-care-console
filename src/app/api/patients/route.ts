// /src/app/api/patients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const patients = await db.collection('patients').find({}).toArray();
    
    return NextResponse.json({ 
      patients,
      totalItems: patients.length 
    }, { status: 200 });
  } catch (error) {
    console.error('환자 데이터 조회 실패:', error);
    return NextResponse.json({ error: '환자 데이터를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const data = await request.json();
    
    // 입력 데이터 검증
    if (!data.name || !data.phoneNumber) {
      return NextResponse.json({ error: '필수 입력값이 누락되었습니다.' }, { status: 400 });
    }
    
    // 중복 번호 확인
    const existingPatient = await db.collection('patients').findOne({ phoneNumber: data.phoneNumber });
    if (existingPatient) {
      return NextResponse.json({ error: '이미 등록된 전화번호입니다.' }, { status: 409 });
    }
    
    // 환자 ID 생성
    const count = await db.collection('patients').countDocuments();
    const patientId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // 환자 정보 추가
    const now = new Date().toISOString();
    const newPatient = {
      ...data,
      patientId,
      createdAt: now,
      updatedAt: now,
      lastConsultation: '',
      reminderStatus: '초기',
      visitConfirmed: false
    };
    
    const result = await db.collection('patients').insertOne(newPatient);
    newPatient._id = result.insertedId;
    
    return NextResponse.json(newPatient, { status: 201 });
  } catch (error) {
    console.error('환자 등록 실패:', error);
    return NextResponse.json({ error: '환자 등록에 실패했습니다.' }, { status: 500 });
  }
}