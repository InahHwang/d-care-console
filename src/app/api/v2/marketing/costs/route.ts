// src/app/api/v2/marketing/costs/route.ts
// 마케팅 광고비 CRUD API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { MarketingCostV2 } from '@/types/marketingCost';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  channel: z.string().min(1).max(50),
  category: z.enum(['online', 'offline', 'influencer', 'other']),
  amount: z.number().min(0),
  memo: z.string().max(500).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  channel: z.string().min(1).max(50).optional(),
  category: z.enum(['online', 'offline', 'influencer', 'other']).optional(),
  amount: z.number().min(0).optional(),
  memo: z.string().max(500).optional(),
});

// GET - 광고비 목록 (?year=2026 또는 ?year=2026&month=5)
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const filter: Record<string, unknown> = { clinicId };
    if (year !== undefined) filter.year = year;
    if (month !== undefined) filter.month = month;

    const costs = await db.collection<MarketingCostV2>('marketing_costs_v2')
      .find(filter)
      .sort({ year: -1, month: -1, channel: 1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: costs.map((c) => ({ ...c, _id: c._id?.toString() })),
    });
  } catch (error) {
    console.error('[marketing/costs GET] error', error);
    return NextResponse.json({ success: false, message: '광고비 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST - 광고비 추가
export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;
    const now = new Date().toISOString();

    const doc: Omit<MarketingCostV2, '_id'> = {
      clinicId,
      year: parsed.data.year,
      month: parsed.data.month,
      channel: parsed.data.channel.trim(),
      category: parsed.data.category,
      amount: parsed.data.amount,
      memo: parsed.data.memo,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.user.id,
      createdByName: auth.user.name,
    };

    const result = await db.collection('marketing_costs_v2').insertOne(doc);

    return NextResponse.json({
      success: true,
      data: { ...doc, _id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error('[marketing/costs POST] error', error);
    return NextResponse.json({ success: false, message: '광고비 등록 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// PATCH - 광고비 수정
export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: '유효하지 않은 ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.channel !== undefined) $set.channel = updates.channel.trim();
    if (updates.category !== undefined) $set.category = updates.category;
    if (updates.amount !== undefined) $set.amount = updates.amount;
    if (updates.memo !== undefined) $set.memo = updates.memo;

    const result = await db.collection('marketing_costs_v2').updateOne(
      { _id: new ObjectId(id), clinicId },
      { $set }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: '광고비 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[marketing/costs PATCH] error', error);
    return NextResponse.json({ success: false, message: '광고비 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE - 광고비 삭제 (?id=xxx)
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: '유효하지 않은 ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const result = await db.collection('marketing_costs_v2').deleteOne({
      _id: new ObjectId(id),
      clinicId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: '광고비 기록을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[marketing/costs DELETE] error', error);
    return NextResponse.json({ success: false, message: '광고비 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
