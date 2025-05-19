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
  // 기타 필요한 필드들...
  [key: string]: any; // 다른 모든 필드를 허용
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const patientsData = await db.collection('patients').find({}).toArray();
    
    // 로그 추가
    console.log('MongoDB에서 로드된 환자 데이터:', JSON.stringify(patientsData, null, 2));
    
    // MongoDB의 ObjectId를 문자열로 변환 - 타입 지정
    const patients = patientsData.map((patient: PatientFromDB) => {
      // _id를 문자열로 변환하여 저장
      const patientWithStringId = {
        ...patient,
        _id: patient._id.toString()
      };
      
      // id 필드가 없다면 _id를 복사해서 id 필드 추가 (기존 코드 호환성)
      if (!patientWithStringId.id) {
        patientWithStringId.id = patientWithStringId._id;
      }
      
      return patientWithStringId;
    });
    
    // 변환 후 데이터 확인
    console.log('변환된 환자 데이터:', JSON.stringify(patients, null, 2));

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
      patientId, // PT-XXXX 형식 ID (표시용)
      createdAt: now,
      updatedAt: now,
      lastConsultation: '',
      reminderStatus: '초기',
      visitConfirmed: false
    };

    const result = await db.collection('patients').insertOne(newPatient);
    
    // MongoDB의 _id를 문자열로 변환하여 저장 
    const insertedId = result.insertedId.toString();
    newPatient._id = insertedId;
    
    // id 필드도 추가 (기존 코드 호환성)
    newPatient.id = insertedId;
    
    console.log('환자 등록 성공:', newPatient);

    return NextResponse.json(newPatient, { status: 201 });
  } catch (error) {
    console.error('환자 등록 실패:', error);
    return NextResponse.json({ error: '환자 등록에 실패했습니다.' }, { status: 500 });
  }
}