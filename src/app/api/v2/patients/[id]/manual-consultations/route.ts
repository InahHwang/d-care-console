// src/app/api/v2/patients/[id]/manual-consultations/route.ts
// 수동 상담 이력 API

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 수동 상담 이력 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

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
      .find({ patientId })
      .sort({ date: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: consultations.map((c) => ({
        id: c._id.toString(),
        type: c.type,
        direction: c.direction,
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
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id: patientId } = await params;
    const body = await request.json();
    const { type, direction, date, content, consultantName } = body;

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: '상담 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 환자 존재 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId),
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const now = new Date();
    const newConsultation: Record<string, unknown> = {
      patientId,
      type: type || 'other',
      date: date ? new Date(date) : now,
      content: content.trim(),
      consultantName: consultantName || '미지정',
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    };
    // 전화 타입이면 수신/발신 방향 저장
    if (type === 'phone' && direction) {
      newConsultation.direction = direction;
    }

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

// PATCH: 수동 상담 이력 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id: patientId } = await params;
    const body = await request.json();
    const { consultationId, type, direction, date, content, consultantName } = body;

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    if (!consultationId || !ObjectId.isValid(consultationId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상담 ID입니다.' },
        { status: 400 }
      );
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: '상담 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 해당 상담이 이 환자의 것인지 확인
    const existing = await db.collection('manualConsultations_v2').findOne({
      _id: new ObjectId(consultationId),
      patientId,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '상담 이력을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const now = new Date();
    const updateData: any = {
      content: content.trim(),
      updatedAt: now,
    };
    if (type) updateData.type = type;
    if (type === 'phone' && direction) updateData.direction = direction;
    if (date) updateData.date = new Date(date);
    if (consultantName) updateData.consultantName = consultantName;

    await db.collection('manualConsultations_v2').updateOne(
      { _id: new ObjectId(consultationId) },
      { $set: updateData }
    );

    console.log(`[수동 상담] 수정: 환자ID=${patientId}, 상담ID=${consultationId}`);

    return NextResponse.json({
      success: true,
      data: { id: consultationId, ...updateData },
    });
  } catch (error) {
    console.error('[수동 상담 이력] 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 수동 상담 이력 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { id: patientId } = await params;
    const { searchParams } = new URL(request.url);
    const consultationId = searchParams.get('consultationId');

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    if (!consultationId || !ObjectId.isValid(consultationId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상담 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 해당 상담이 이 환자의 것인지 확인
    const existing = await db.collection('manualConsultations_v2').findOne({
      _id: new ObjectId(consultationId),
      patientId,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '상담 이력을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await db.collection('manualConsultations_v2').deleteOne({
      _id: new ObjectId(consultationId),
    });

    console.log(`[수동 상담] 삭제: 환자ID=${patientId}, 상담ID=${consultationId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[수동 상담 이력] 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
