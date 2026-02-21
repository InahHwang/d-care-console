// src/app/api/v2/settings/route.ts
// 설정 관리 API

import { NextRequest, NextResponse } from 'next/server';

// 캐싱 방지: 항상 최신 설정 데이터 반환
export const dynamic = 'force-dynamic';
import { connectToDatabase } from '@/utils/mongodb';

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

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // 현재 설정 조회 (클리닉 ID는 일단 고정)
    const clinicId = 'default';
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
    const body = await request.json();
    const { db } = await connectToDatabase();

    const clinicId = 'default';
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
