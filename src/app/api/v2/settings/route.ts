// src/app/api/v2/settings/route.ts
// 설정 관리 API

import { NextRequest, NextResponse } from 'next/server';

// 캐싱 방지: 항상 최신 설정 데이터 반환
export const dynamic = 'force-dynamic';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

const settingsPatchSchema = z.object({
  clinicName: z.string().nullish(),
  cti: z.record(z.unknown()).nullish(),
  ai: z.record(z.unknown()).nullish(),
  notifications: z.object({
    missedCall: z.boolean(),
    newPatient: z.boolean(),
    callback: z.boolean(),
  }).nullish(),
  targets: z.object({
    monthlyRevenue: z.number(),
    dailyCalls: z.number(),
    conversionRate: z.number(),
  }).nullish(),
  dailyReportSms: z.object({
    enabled: z.boolean(),
    recipients: z.array(z.string()),
    schedule: z.record(z.object({ enabled: z.boolean(), time: z.string() })),
  }).nullish(),
  excludedPhones: z.array(z.string()).nullish(),
  sms: z.object({
    senderNumber: z.string(),
    senderName: z.string(),
    approvalStatus: z.enum(['none', 'pending', 'approved', 'rejected']),
    approvalNote: z.string().optional(),
    isConfigured: z.boolean().optional(),
  }).nullish(),
  channels: z.object({
    naver: z.object({ enabled: z.boolean(), authToken: z.string(), isConfigured: z.boolean() }).optional(),
    kakao: z.object({ enabled: z.boolean(), apiToken: z.string(), isConfigured: z.boolean() }).optional(),
    instagram: z.object({
      enabled: z.boolean(),
      accessToken: z.string(),
      pageId: z.string(),
      webhookVerifyToken: z.string(),
      isConfigured: z.boolean(),
    }).optional(),
  }).nullish(),
}).passthrough();

interface Settings {
  clinicId: string;
  clinicName: string;
  notifications: {
    missedCall: boolean;
    newPatient: boolean;
    callback: boolean;
  };
  targets: {
    monthlyRevenue: number;
    dailyCalls: number;
    conversionRate: number;
  };
  dailyReportSms?: {
    enabled: boolean;
    recipients: string[];
    schedule: Record<string, { enabled: boolean; time: string }>;
  };
  updatedAt: string;
}

const DEFAULT_SETTINGS: Omit<Settings, 'clinicId' | 'updatedAt'> = {
  clinicName: '내 병원',
  notifications: {
    missedCall: true,
    newPatient: true,
    callback: true,
  },
  targets: {
    monthlyRevenue: 10000,
    dailyCalls: 50,
    conversionRate: 30,
  },
};

export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();

    const clinicId = auth.user.clinicId;
    let settings: Settings | null = await db.collection<Settings>('settings_v2').findOne({ clinicId });

    if (!settings) {
      // 기본 설정 생성
      const now = new Date().toISOString();
      const defaultSettings: Settings = {
        clinicId,
        ...DEFAULT_SETTINGS,
        updatedAt: now,
      };

      await db.collection('settings_v2').insertOne(defaultSettings);
      settings = defaultSettings;
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('[Settings API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = settingsPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const clinicId = auth.user.clinicId;
    const now = new Date().toISOString();

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // 중첩 객체 처리
    if (body.clinicName !== undefined) updateData.clinicName = body.clinicName;
    if (body.cti !== undefined) updateData.cti = body.cti;
    if (body.ai !== undefined) updateData.ai = body.ai;
    if (body.notifications !== undefined) updateData.notifications = body.notifications;
    if (body.targets !== undefined) updateData.targets = body.targets;
    if (body.dailyReportSms !== undefined) updateData.dailyReportSms = body.dailyReportSms;
    if (body.excludedPhones !== undefined) updateData.excludedPhones = body.excludedPhones;
    if (body.sms !== undefined) updateData.sms = body.sms;
    if (body.channels !== undefined) updateData.channels = body.channels;

    const result = await db.collection<Settings>('settings_v2').findOneAndUpdate(
      { clinicId },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Settings API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
