// src/app/api/patients/event-targets/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    // 이벤트 타겟으로 지정된 환자 조회
    const eventTargetPatients = await db.collection('patients')
      .find({ 'eventTargetInfo.isEventTarget': true })
      .toArray();
    
    // ObjectId를 문자열로 변환하고 id 필드 설정
    const formattedPatients = eventTargetPatients.map((patient: any) => {
      const formattedPatient = { ...patient };
      
      if (formattedPatient._id) {
        formattedPatient._id = formattedPatient._id.toString();
        
        // id 필드가 없으면 _id로 설정
        if (!formattedPatient.id) {
          formattedPatient.id = formattedPatient._id;
        }
      }
      
      return formattedPatient;
    });
    
    return NextResponse.json(formattedPatients, { status: 200 });
  } catch (error) {
    console.error('이벤트 타겟 환자 조회 실패:', error);
    return NextResponse.json({ error: '이벤트 타겟 환자 조회에 실패했습니다.' }, { status: 500 });
  }
}