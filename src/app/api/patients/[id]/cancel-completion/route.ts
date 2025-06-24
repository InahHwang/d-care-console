// src/app/api/patients/[id]/cancel-completion/route.ts

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

    console.log(`환자 종결 취소 시도 - 환자 ID: ${patientId}`);

    // 환자 검색
    let patient;
    
    // 1. ObjectId로 찾기 시도
    if (ObjectId.isValid(patientId)) {
      patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
    }
    
    // 2. id 필드로 찾기 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ id: patientId });
    }
    
    // 3. patientId 필드로 찾기 시도
    if (!patient) {
      patient = await db.collection('patients').findOne({ patientId: patientId });
    }
    
    if (!patient) {
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 종결 처리되지 않은 경우
    if (!patient.isCompleted) {
      return NextResponse.json({ error: "종결 처리되지 않은 환자입니다." }, { status: 400 });
    }

    // 콜백 이력에서 종결 기록 제거
    const callbackHistory = patient.callbackHistory || [];
    const updatedCallbackHistory = callbackHistory.filter((cb: any) => !cb.isCompletionRecord);

    // 원래 상태로 되돌리기 (VIP, 활성고객, 콜백필요 등)
    // 이전 상태를 알 수 없으므로 가장 최근 콜백 상태에 따라 결정
    let originalStatus = '콜백필요'; // 기본값
    
    // 완료된 콜백이 있으면 '잠재고객', 없으면 '잠재고객'으로 설정
    const hasCompletedCallback = updatedCallbackHistory.some((cb: any) => cb.status === '완료');
    if (hasCompletedCallback) {
      originalStatus = '잠재고객'; // 🔥 '활성고객'에서 '잠재고객'으로 변경
    }

    // 부재중 콜백이 있으면 '부재중'으로 설정
    const hasMissedCallback = updatedCallbackHistory.some((cb: any) => 
      cb.status === '부재중' || (cb.status === '완료' && cb.notes?.startsWith('부재중:'))
    );
    if (hasMissedCallback) {
      originalStatus = '부재중';
    }

    // 환자 정보 업데이트
    const updateData = {
      isCompleted: false,
      completedAt: null,
      completedReason: null,
      status: originalStatus,
      callbackHistory: updatedCallbackHistory,
      updatedAt: new Date().toISOString()
    };

    // MongoDB에 저장
    let result;
    if (ObjectId.isValid(patientId)) {
      result = await db.collection('patients').findOneAndUpdate(
        { _id: new ObjectId(patientId) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else if (patient.id) {
      result = await db.collection('patients').findOneAndUpdate(
        { id: patient.id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    } else {
      result = await db.collection('patients').findOneAndUpdate(
        { patientId: patient.patientId },
        { $set: updateData },
        { returnDocument: 'after' }
      );
    }

    if (!result) {
      return NextResponse.json({ error: "환자 정보 업데이트에 실패했습니다." }, { status: 500 });
    }

    const updatedPatient = result;
    
    // ID를 문자열로 변환
    if (updatedPatient._id && typeof updatedPatient._id !== 'string') {
      (updatedPatient as any)._id = updatedPatient._id.toString();
    }
    
    // 호환성을 위해 id 필드가 없다면 _id로 설정
    if (!updatedPatient.id && updatedPatient._id) {
      updatedPatient.id = updatedPatient._id;
    }

    return NextResponse.json(updatedPatient, { status: 200 });
  } catch (error) {
    console.error('환자 종결 취소 오류:', error);
    return NextResponse.json({ error: "환자 종결 취소에 실패했습니다." }, { status: 500 });
  }
}