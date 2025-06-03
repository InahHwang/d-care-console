// /src/app/api/patients/inbound/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { phoneNumber } = await request.json();

    // 입력 데이터 검증
    if (!phoneNumber) {
      return NextResponse.json({ error: '전화번호를 입력해주세요.' }, { status: 400 });
    }

    // 전화번호 형식 검증 (간단한 한국 번호 형식)
    const phoneRegex = /^[0-9-+\s()]{8,15}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json({ error: '올바른 전화번호 형식이 아닙니다.' }, { status: 400 });
    }

    // 중복 번호 확인
    const existingPatient = await db.collection('patients').findOne({ phoneNumber: phoneNumber.replace(/\s/g, '') });
    if (existingPatient) {
      return NextResponse.json({ 
        error: '이미 등록된 전화번호입니다.',
        existingPatient: {
          _id: existingPatient._id.toString(),
          name: existingPatient.name,
          patientId: existingPatient.patientId,
          consultationType: existingPatient.consultationType
        }
      }, { status: 409 });
    }

    // 환자 ID 생성 - 인바운드용 (IB-YYMMDDXXX)
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = year + month + day;
    
    // 같은 날짜로 시작하는 인바운드 환자 ID 개수 확인
    const todayPattern = new RegExp(`^IB-${datePrefix}`);
    const todayInboundCount = await db.collection('patients').countDocuments({
      patientId: todayPattern
    });
    
    // 오늘 날짜 기준 다음 순번
    const nextSequence = String(todayInboundCount + 1).padStart(3, '0');
    let patientId = `IB-${datePrefix}${nextSequence}`; // IB-250602001
    
    // 중복 방지 검증
    const existingIdPatient = await db.collection('patients').findOne({ patientId });
    if (existingIdPatient) {
      const timestamp = Date.now().toString().slice(-3);
      patientId = `IB-${datePrefix}${timestamp}`;
    }

    // 인바운드 환자 정보 생성
    const nowISO = new Date().toISOString();
    const newInboundPatient = {
      patientId,
      name: `인바운드 ${phoneNumber}`, // 임시 이름
      phoneNumber: phoneNumber.replace(/\s/g, ''), // 공백 제거하여 저장
      inboundPhoneNumber: phoneNumber, // 원본 입력값 보존 (표시용)
      consultationType: 'inbound',
      status: '잠재고객',
      reminderStatus: '초기',
      interestedServices: [],
      callInDate: nowISO.split('T')[0], // YYYY-MM-DD 형식
      firstConsultDate: '',
      lastConsultation: '',
      notes: '인바운드 상담 - 상세 정보 입력 필요',
      createdAt: nowISO,
      updatedAt: nowISO,
      visitConfirmed: false,
      callbackHistory: []
    };

    const result = await db.collection('patients').insertOne(newInboundPatient);
    
    // MongoDB의 _id를 문자열로 변환
    const insertedId = result.insertedId.toString();
    const responsePatient = {
      ...newInboundPatient,
      _id: insertedId,
      id: insertedId // 기존 코드 호환성
    };
    
    console.log('인바운드 환자 등록 성공:', responsePatient);

    return NextResponse.json(responsePatient, { status: 201 });
  } catch (error) {
    console.error('인바운드 환자 등록 실패:', error);
    return NextResponse.json({ error: '인바운드 환자 등록에 실패했습니다.' }, { status: 500 });
  }
}