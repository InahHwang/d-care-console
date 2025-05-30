// src/app/api/patients/[id]/visit-confirmation/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const id = params.id;
    
    console.log(`내원확정 상태 변경 시도: 환자 ID = ${id}`);
    
    // 먼저 환자 찾기
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
      console.log('내원확정 변경 실패: 환자를 찾을 수 없음');
      return NextResponse.json(
        { error: '환자를 찾을 수 없습니다' },
        { status: 404 }
      );
    }
    
    // 현재 내원확정 상태를 토글
    const newVisitConfirmed = !patient.visitConfirmed;
    
    console.log(`내원확정 상태 변경: ${patient.visitConfirmed} → ${newVisitConfirmed}`);
    
    // 데이터베이스 업데이트
    const result = await db.collection('patients').findOneAndUpdate(
      { _id: patient._id },
      { 
        $set: { 
          visitConfirmed: newVisitConfirmed,
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      console.log('내원확정 상태 업데이트 실패');
      return NextResponse.json(
        { error: '내원확정 상태 업데이트에 실패했습니다' },
        { status: 500 }
      );
    }
    
    console.log('내원확정 상태 업데이트 성공:', {
      patientId: result._id,
      name: result.name,
      visitConfirmed: result.visitConfirmed
    });
    
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    console.error('내원확정 상태 변경 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}