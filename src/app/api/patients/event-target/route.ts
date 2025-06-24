// src/app/api/patients/[id]/event-target/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const eventTargetInfo = await request.json();
    
    console.log('이벤트 타겟 업데이트 API 호출:', { patientId, eventTargetInfo });
    
    // MongoDB 연결
    const { db } = await connectToDatabase();
    
    // 환자 ID 검증 - ObjectId 형식과 일반 문자열 모두 지원
    let query;
    if (ObjectId.isValid(patientId)) {
      query = { $or: [{ _id: new ObjectId(patientId) }, { id: patientId }] };
    } else {
      query = { id: patientId };
    }
    
    // 환자 데이터 업데이트
    const result = await db.collection('patients').findOneAndUpdate(
      query,
      { 
        $set: { 
          eventTargetInfo: {
            ...eventTargetInfo,
            updatedAt: eventTargetInfo.updatedAt || new Date().toISOString()
          }
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      console.error('환자를 찾을 수 없음:', patientId);
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 응답 데이터 포맷팅
    const formattedPatient = {
      ...result,
      id: result._id.toString(),
      _id: result._id.toString()
    } as any;
    
    console.log('이벤트 타겟 업데이트 성공:', {
      patientId,
      patientName: formattedPatient.name,
      isEventTarget: formattedPatient.eventTargetInfo?.isEventTarget,
      targetReason: formattedPatient.eventTargetInfo?.targetReason,
      categories: formattedPatient.eventTargetInfo?.categories,
      scheduledDate: formattedPatient.eventTargetInfo?.scheduleDate
    });

    return NextResponse.json({
      message: 'Event target info updated successfully',
      eventTargetInfo: formattedPatient.eventTargetInfo,
      patient: formattedPatient
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate', // 캐시 방지
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('이벤트 타겟 정보 업데이트 오류:', error);
    return NextResponse.json(
      { 
        error: '이벤트 타겟 정보 업데이트 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// GET 메서드 추가 (디버깅 및 조회용)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    
    console.log('환자 이벤트 타겟 정보 조회:', patientId);
    
    const { db } = await connectToDatabase();
    
    // 환자 ID 검증
    let query;
    if (ObjectId.isValid(patientId)) {
      query = { $or: [{ _id: new ObjectId(patientId) }, { id: patientId }] };
    } else {
      query = { id: patientId };
    }
    
    const patient = await db.collection('patients').findOne(query);
    
    if (!patient) {
      console.error('환자를 찾을 수 없음:', patientId);
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const formattedPatient = {
      ...patient,
      id: patient._id.toString(),
      _id: patient._id.toString()
    } as any;
    
    console.log('환자 이벤트 타겟 정보 조회 성공:', {
      patientId,
      patientName: formattedPatient.name,
      eventTargetInfo: formattedPatient.eventTargetInfo
    });
    
    return NextResponse.json({
      patient: formattedPatient,
      eventTargetInfo: formattedPatient.eventTargetInfo
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('환자 이벤트 타겟 정보 조회 오류:', error);
    return NextResponse.json(
      { 
        error: '환자 이벤트 타겟 정보 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// POST 메서드도 PUT과 동일하게 처리 (호환성을 위해)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // PUT 메서드와 동일한 로직 사용
  return PUT(request, { params });
}