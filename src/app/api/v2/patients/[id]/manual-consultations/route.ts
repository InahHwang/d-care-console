// src/app/api/v2/patients/[id]/manual-consultations/route.ts
// 수동 상담 이력 API

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createManualConsultationSchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 수동 상담 이력 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id: patientId } = await params;

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const consultations = await db
      .collection('manualConsultations_v2')
      .find({ patientId, clinicId })
      .sort({ date: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: consultations.map((c) => ({
        id: c._id.toString(),
        type: c.type,
        date: c.date,
        content: c.content,
        consultantName: c.consultantName,
        source: 'manual',
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('[수동 상담 이력] 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 수동 상담 이력 추가
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id: patientId } = await params;

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = validateBody(createManualConsultationSchema, body);
    if (!validation.success) return validation.response;
    const { type, date, content, consultantName } = validation.data;

    const { db } = await connectToDatabase();

    // 환자 존재 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId), clinicId,
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const now = new Date();
    const newConsultation = {
      clinicId,
      patientId,
      type: type || 'other',
      date: date ? new Date(date) : now,
      content: content.trim(),
      consultantName: consultantName || '미지정',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('manualConsultations_v2').insertOne(newConsultation);

    // 환자의 lastContactAt 업데이트
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      { $set: { lastContactAt: newConsultation.date, updatedAt: now } }
    );

    console.log(`[수동 상담] 등록: 환자ID=${patientId}, 유형=${type}`);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newConsultation,
      },
    });
  } catch (error) {
    console.error('[수동 상담 이력] 등록 오류:', error);
    return NextResponse.json(
      { success: false, error: '등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
