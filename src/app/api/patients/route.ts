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
        _id: patient._id.toString(),
        // 🔥 기존 환자들은 기본적으로 아웃바운드로 설정 (호환성을 위해)
        consultationType: patient.consultationType || 'outbound',
        // 🔥 기존 환자들 유입경로 기본값 설정 (호환성을 위해)
        referralSource: patient.referralSource || ''
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

    // 환자 ID 생성 - 날짜 기반 (PT-YYMMDDXXX)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // 25
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 05
    const day = String(now.getDate()).padStart(2, '0'); // 25
    const datePrefix = year + month + day; // 250525
    
    // 같은 날짜로 시작하는 환자 ID 개수 확인
    const todayPattern = new RegExp(`^PT-${datePrefix}`);
    const todayPatientCount = await db.collection('patients').countDocuments({
      patientId: todayPattern
    });
    
    // 오늘 날짜 기준 다음 순번 (001부터 시작)
    const nextSequence = String(todayPatientCount + 1).padStart(3, '0');
    let patientId = `PT-${datePrefix}${nextSequence}`; // PT-250525001
    
    // 혹시 모를 중복 방지 검증
    const existingIdPatient = await db.collection('patients').findOne({ patientId });
    if (existingIdPatient) {
      // 중복이 있다면 타임스탬프 기반으로 재생성
      const timestamp = Date.now().toString().slice(-3);
      patientId = `PT-${datePrefix}${timestamp}`;
    }

    // 환자 정보 추가
    const nowISO = new Date().toISOString();
    const newPatient = {
      ...data,
      patientId, // PT-YYMMDDXXX 형식 ID (표시용)
      createdAt: nowISO,
      updatedAt: nowISO,
      lastConsultation: '',
      reminderStatus: '초기',
      visitConfirmed: false,
      // 🔥 상담 타입 기본값 설정 (명시되지 않으면 아웃바운드)
      consultationType: data.consultationType || 'outbound',
      // 🔥 유입경로 기본값 설정 (명시되지 않으면 빈 문자열)
      referralSource: data.referralSource || ''
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