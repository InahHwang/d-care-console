// src/app/api/patients/[id]/reset-post-visit/route.ts - 내원 후 상태 초기화 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const patientId = params.id;
    
    console.log('내원 후 상태 초기화 요청:', { patientId });
    
    // 환자 ID 유효성 검사
    if (!patientId) {
      return NextResponse.json({ error: '환자 ID가 필요합니다.' }, { status: 400 });
    }
    
    // 🔥 먼저 환자가 존재하는지 확인
    let existingPatient;
    if (ObjectId.isValid(patientId)) {
      existingPatient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    } else {
      existingPatient = await db.collection('patients').findOne({ id: patientId });
    }
    
    if (!existingPatient) {
      console.error('환자를 찾을 수 없음:', patientId);
      return NextResponse.json({ error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    console.log('초기화 대상 환자 찾음:', existingPatient.name);
    
    // 🔥 초기화할 필드들 정의
    const resetData = {
      // 내원 후 상태 초기화
      postVisitStatus: null,
      
      // 내원 후 상담 정보 완전 삭제
      postVisitConsultation: null,
      
      // 호환성을 위한 기존 필드들도 초기화
      postVisitNotes: null,
      treatmentStartDate: null,
      nextVisitDate: null,
      nextCallbackDate: null,
      visitDate: null,
      
      // 업데이트 시간 기록
      updatedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    };
    
    console.log('초기화 데이터:', resetData);
    
    // 🔥 MongoDB에서 환자 정보 초기화 (unset 사용하여 완전 삭제)
    let result;
    if (ObjectId.isValid(patientId)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(patientId) },
        { 
          $unset: {
            postVisitStatus: "",
            postVisitConsultation: "",
            postVisitNotes: "",
            treatmentStartDate: "",
            nextCallbackDate: "",
            nextVisitDate: "", // 🔥 이 필드도 초기화 (fallback 필드)
            visitDate: ""
          },
          $set: {
            updatedAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { id: patientId },
        { 
          $unset: {
            postVisitStatus: "",
            postVisitConsultation: "",
            postVisitNotes: "",
            treatmentStartDate: "",
            nextCallbackDate: "",
            nextVisitDate: "", // 🔥 이 필드도 초기화 (fallback 필드)
            visitDate: ""
          },
          $set: {
            updatedAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString()
          }
        },
        { returnDocument: 'after' }
      );
    }
    
    if (!result || !result.value) {
      console.error('초기화 실패');
      return NextResponse.json({ error: '환자 데이터 초기화에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId를 문자열로 변환
    const updatedPatient = {
      ...result.value,
      _id: result.value._id.toString(),
      id: result.value.id || result.value._id.toString()
    };
    
    console.log('내원 후 상태 초기화 완료:', {
      patientId,
      name: updatedPatient.name,
      resetFields: [
        'postVisitStatus',
        'postVisitConsultation', 
        'postVisitNotes',
        'treatmentStartDate',
        'nextCallbackDate',
        'nextVisitDate', // 🔥 fallback 필드도 포함
        'visitDate'
      ]
    });
    
    return NextResponse.json({
      success: true,
      message: '내원 후 상태 데이터가 초기화되었습니다.',
      patient: updatedPatient
    }, { status: 200 });
    
  } catch (error) {
    console.error('내원 후 상태 초기화 실패:', error);
    return NextResponse.json({
      error: '내원 후 상태 초기화에 실패했습니다.'
    }, { status: 500 });
  }
}