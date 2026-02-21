// src/app/api/v2/patients/[id]/marketing-target/route.ts
// 환자 마케팅 타겟 지정/해제 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { MarketingInfo, MarketingTargetReason } from '@/types/v2';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT: 이벤트 타겟 지정/수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      targetReason,
      customReason,
      categories = [],
      scheduledDate,
      note,
      createdBy,
    } = body as {
      targetReason: MarketingTargetReason;
      customReason?: string;
      categories?: string[];
      scheduledDate?: string;
      note?: string;
      createdBy?: string;
    };

    // 필수 필드 검증
    if (!targetReason) {
      return NextResponse.json(
        { success: false, error: '타겟 사유는 필수입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 기존 환자 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id),
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 타겟인 경우 수정, 아니면 신규 생성
    const isUpdate = patient.marketingInfo?.isTarget === true;

    const marketingInfo: MarketingInfo = {
      isTarget: true,
      targetReason,
      customReason: targetReason === 'other' ? customReason : undefined,
      categories,
      scheduledDate,
      note,
      createdAt: isUpdate ? patient.marketingInfo.createdAt : now,
      updatedAt: now,
      createdBy: isUpdate ? patient.marketingInfo.createdBy : createdBy,
    };

    // 환자 정보 업데이트
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          marketingInfo,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: { marketingInfo },
      message: isUpdate ? '이벤트 타겟 정보가 수정되었습니다.' : '이벤트 타겟으로 지정되었습니다.',
    });
  } catch (error) {
    console.error('Marketing target PUT error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 타겟 지정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 이벤트 타겟 해제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 기존 환자 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id),
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이벤트 타겟 해제 (marketingInfo 필드 제거)
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(id) },
      {
        $unset: { marketingInfo: '' },
        $set: { updatedAt: now },
      }
    );

    return NextResponse.json({
      success: true,
      message: '이벤트 타겟에서 해제되었습니다.',
    });
  } catch (error) {
    console.error('Marketing target DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 타겟 해제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 특정 환자의 마케팅 타겟 정보 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const patient = await db.collection('patients_v2').findOne(
      { _id: new ObjectId(id) },
      { projection: { marketingInfo: 1, name: 1, phone: 1 } }
    );

    if (!patient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        patientId: id,
        name: patient.name,
        phone: patient.phone,
        marketingInfo: patient.marketingInfo || null,
      },
    });
  } catch (error) {
    console.error('Marketing target GET error:', error);
    return NextResponse.json(
      { success: false, error: '마케팅 타겟 정보 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
