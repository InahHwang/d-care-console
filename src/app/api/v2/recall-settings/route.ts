// src/app/api/v2/recall-settings/route.ts
// 리콜 발송 설정 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export interface RecallSchedule {
  id: string;
  timing: string;
  timingDays: number;
  message: string;
  enabled: boolean;
}

export interface RecallSetting {
  _id?: ObjectId;
  treatment: string;
  schedules: RecallSchedule[];
  createdAt: string;
  updatedAt: string;
}

// GET - 리콜 설정 목록 조회
export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const settings = await db.collection<RecallSetting>('recall_settings')
      .find({})
      .sort({ treatment: 1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: settings.map(s => ({
        id: s._id?.toString(),
        treatment: s.treatment,
        schedules: s.schedules,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[Recall Settings API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 리콜 설정 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { treatment, schedules } = body;

    if (!treatment) {
      return NextResponse.json(
        { success: false, error: 'treatment is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 중복 치료 확인
    const existing = await db.collection('recall_settings').findOne({ treatment });
    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 치료 종류입니다' },
        { status: 400 }
      );
    }

    const newSetting: RecallSetting = {
      treatment,
      schedules: schedules || [],
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('recall_settings').insertOne(newSetting);

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newSetting,
      },
    });
  } catch (error) {
    console.error('[Recall Settings API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - 리콜 설정 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, treatment, schedules } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const updateData: Partial<RecallSetting> = {
      updatedAt: now,
    };

    if (treatment) updateData.treatment = treatment;
    if (schedules) updateData.schedules = schedules;

    const result = await db.collection('recall_settings').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result._id?.toString(),
        ...result,
      },
    });
  } catch (error) {
    console.error('[Recall Settings API] PUT 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 리콜 설정 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('recall_settings').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Setting deleted',
    });
  } catch (error) {
    console.error('[Recall Settings API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
