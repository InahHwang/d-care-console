// src/app/api/patients/[id]/post-visit-status/route.ts - 환자 반응 지원 버전

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { db } = await connectToDatabase();
    const requestData = await request.json();
    const { postVisitStatus, postVisitConsultation, postVisitNotes, nextVisitDate } = requestData;
    
    const patientId = params.id;
    
    console.log('내원 후 상태 업데이트 요청:', {
      patientId,
      postVisitStatus,
      hasConsultation: !!postVisitConsultation,
      treatmentContent: postVisitConsultation?.treatmentContent // 🔥 치료 내용 로그 추가
    });
    
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
    
    console.log('환자 찾음:', existingPatient.name);
    
    // 업데이트할 데이터 구성
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };
    
    // 내원 후 상태 업데이트
    if (postVisitStatus) {
      updateData.postVisitStatus = postVisitStatus;
    }
    
    // 🔥 내원 후 상담 정보 업데이트 (환자 반응 지원)
   if (postVisitConsultation) {
      // 🔥 치료 내용 필드 확인 및 로깅
      if (postVisitConsultation.treatmentContent) {
        console.log('🔥 치료 내용 업데이트:', postVisitConsultation.treatmentContent);
      }

      // 🔥 견적 정보에서 patientReaction 필드 확인
      if (postVisitConsultation.estimateInfo && postVisitConsultation.estimateInfo.patientReaction) {
        console.log('환자 반응 업데이트:', postVisitConsultation.estimateInfo.patientReaction);
      }
      
      updateData.postVisitConsultation = postVisitConsultation;
      
      // 호환성을 위해 기존 필드들도 업데이트
      if (postVisitConsultation.nextVisitDate) {
        updateData.nextVisitDate = postVisitConsultation.nextVisitDate;
      }
      if (postVisitConsultation.nextCallbackDate) {
        updateData.nextCallbackDate = postVisitConsultation.nextCallbackDate;
      }
    }
    
    // 기존 호환성 필드들
    if (postVisitNotes) {
      updateData.postVisitNotes = postVisitNotes;
    }
    if (nextVisitDate) {
      updateData.nextVisitDate = nextVisitDate;
    }
    
    console.log('업데이트 데이터:', {
      ...updateData,
      postVisitConsultation: updateData.postVisitConsultation ? {
        ...updateData.postVisitConsultation,
        treatmentContent: updateData.postVisitConsultation.treatmentContent, // 🔥 치료 내용 로그
        estimateInfo: updateData.postVisitConsultation.estimateInfo ? {
          ...updateData.postVisitConsultation.estimateInfo,
          patientReaction: updateData.postVisitConsultation.estimateInfo.patientReaction
        } : undefined
      } : undefined
    });
    
    // MongoDB에서 환자 정보 업데이트
    let result;
    if (ObjectId.isValid(patientId)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(patientId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { id: patientId },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }
    
    if (!result || !result.value) {
      console.error('업데이트 실패');
      return NextResponse.json({ error: '환자 정보 업데이트에 실패했습니다.' }, { status: 500 });
    }
    
    // ObjectId를 문자열로 변환
    const updatedPatient = {
      ...result.value,
      _id: result.value._id.toString(),
      id: result.value.id || result.value._id.toString()
    };
    
    console.log('내원 후 상태 업데이트 완료:', {
      patientId,
      name: updatedPatient.name,
      postVisitStatus: updatedPatient.postVisitStatus,
      treatmentContent: updatedPatient.postVisitConsultation?.treatmentContent, // 🔥 치료 내용 로그
      patientReaction: updatedPatient.postVisitConsultation?.estimateInfo?.patientReaction
    });
    
    return NextResponse.json(updatedPatient, { status: 200 });
  } catch (error) {
    console.error('내원 후 상태 업데이트 실패:', error);
    return NextResponse.json({ 
      error: '내원 후 상태 업데이트에 실패했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}