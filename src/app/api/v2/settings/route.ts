// src/app/api/v2/settings/route.ts
// 설정 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { updateSettingsSchema } from '@/lib/validations/schemas';
import { createRouteLogger } from '@/lib/logger';
import { withCache, cache } from '@/lib/cache';

interface Settings {
  clinicId: string;
  clinicName: string;
  cti: {
    enabled: boolean;
    serverUrl: string;
    agentId: string;
  };
  ai: {
    enabled: boolean;
    autoAnalysis: boolean;
    model: string;
  };
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
  updatedAt: string;
}

const DEFAULT_SETTINGS: Omit<Settings, 'clinicId' | 'updatedAt'> = {
  clinicName: '내 병원',
  cti: {
    enabled: true,
    serverUrl: '',
    agentId: '',
  },
  ai: {
    enabled: true,
    autoAnalysis: true,
    model: 'gpt-4o-mini',
  },
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
  const log = createRouteLogger('/api/v2/settings', 'GET');
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const clinicId = authUser.clinicId;

    const settings = await withCache(
      `settings:${clinicId}`,
      5 * 60 * 1000, // 5분 TTL
      async () => {
        const { db } = await connectToDatabase();
        let s: Settings | null = await db.collection<Settings>('settings_v2').findOne({ clinicId });

        if (!s) {
          const now = new Date().toISOString();
          const defaultSettings: Settings = {
            clinicId,
            ...DEFAULT_SETTINGS,
            updatedAt: now,
          };
          await db.collection('settings_v2').insertOne(defaultSettings);
          s = defaultSettings;
        }
        return s;
      },
    );

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    log.error('GET 오류', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const log = createRouteLogger('/api/v2/settings', 'PATCH');
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const body = await request.json();
    const validation = validateBody(updateSettingsSchema, body);
    if (!validation.success) return validation.response;
    const { clinicName, cti, ai, notifications, targets } = validation.data;

    const { db } = await connectToDatabase();

    const clinicId = authUser.clinicId;
    const now = new Date().toISOString();

    // 업데이트할 필드만 추출
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // 중첩 객체 처리
    if (clinicName !== undefined) updateData.clinicName = clinicName;
    if (cti !== undefined) updateData.cti = cti;
    if (ai !== undefined) updateData.ai = ai;
    if (notifications !== undefined) updateData.notifications = notifications;
    if (targets !== undefined) updateData.targets = targets;

    const result = await db.collection<Settings>('settings_v2').findOneAndUpdate(
      { clinicId },
      { $set: updateData },
      { returnDocument: 'after', upsert: true }
    );

    // 캐시 무효화
    cache.invalidate(`settings:${clinicId}`);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('PATCH 오류', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
