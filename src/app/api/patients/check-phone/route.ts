// src/app/api/patients/check-phone/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { phoneNumber } = await request.json();

    console.log('🔍 API: 전화번호 중복 체크 시작 -', phoneNumber);

    // 입력 검증
    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json({ 
        error: '전화번호를 입력해주세요.' 
      }, { status: 400 });
    }

    // 전화번호 포맷 정규화 (하이픈 제거 후 비교를 위해)
    const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
    
    // DB에서 동일한 전화번호 검색 (하이픈 있는 버전과 없는 버전 모두 체크)
    const existingPatient = await db.collection('patients').findOne({
      $or: [
        { phoneNumber: phoneNumber },
        { phoneNumber: normalizedPhone },
        { phoneNumber: phoneNumber.replace(/[^\d]/g, '') },
        // 하이픈이 다르게 포맷팅된 경우도 체크
        { phoneNumber: { $regex: `^${normalizedPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-?$2-?$3')}$` } }
      ]
    });

    if (existingPatient) {
      console.log('⚠️ API: 중복된 전화번호 발견 -', existingPatient.name);
      
      return NextResponse.json({
        exists: true,
        patient: {
          _id: existingPatient._id.toString(),
          id: existingPatient._id.toString(),
          patientId: existingPatient.patientId,
          name: existingPatient.name,
          phoneNumber: existingPatient.phoneNumber,
          status: existingPatient.status,
          consultationType: existingPatient.consultationType || 'outbound',
          createdAt: existingPatient.createdAt,
          createdBy: existingPatient.createdBy,
          createdByName: existingPatient.createdByName
        }
      });
    }

    console.log('✅ API: 사용 가능한 전화번호');
    return NextResponse.json({
      exists: false,
      message: '사용 가능한 전화번호입니다.'
    });

  } catch (error) {
    console.error('🚨 API: 전화번호 체크 실패:', error);
    return NextResponse.json({ 
      error: '전화번호 확인 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}