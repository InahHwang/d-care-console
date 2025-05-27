// src/app/api/patients/event-targets/route.ts (개선된 버전)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    console.log('이벤트 타겟 환자 목록 조회 API 호출');
    
    const { db } = await connectToDatabase();
    
    // 이벤트 타겟으로 지정된 환자 조회 - 정렬 추가
    const eventTargetPatients = await db.collection('patients')
      .find({ 'eventTargetInfo.isEventTarget': true })
      .sort({ 
        'eventTargetInfo.scheduledDate': 1,  // 발송 예정일 오름차순
        'eventTargetInfo.createdAt': -1      // 생성일 내림차순 (최신 등록 순)
      })
      .toArray();
    
    console.log(`조회된 이벤트 타겟 환자 수: ${eventTargetPatients.length}명`);
    
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
    
    // 디버깅을 위한 상세 로그
    const debugInfo = formattedPatients.map((p: { id: any; name: any; eventTargetInfo: { isEventTarget: any; targetReason: any; scheduledDate: any; createdAt: any; }; }) => ({
      id: p.id,
      name: p.name,
      isEventTarget: p.eventTargetInfo?.isEventTarget,
      targetReason: p.eventTargetInfo?.targetReason,
      scheduledDate: p.eventTargetInfo?.scheduledDate,
      createdAt: p.eventTargetInfo?.createdAt
    }));
    
    console.log('이벤트 타겟 환자 목록:', debugInfo);
    
    return NextResponse.json(formattedPatients, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // 캐시 방지
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('이벤트 타겟 환자 조회 실패:', error);
    return NextResponse.json({ 
      error: '이벤트 타겟 환자 조회에 실패했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}