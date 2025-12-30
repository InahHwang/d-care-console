// src/app/api/settings/call-retention/route.ts
// 통화기록 보존 설정 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

// 통화 분류 타입 (AI 분석 결과와 일치) - 내부용
type CallCategory =
  | 'new_patient'      // 신규환자 상담
  | 'existing_new_treatment'  // 기존환자 신규치료 문의
  | 'complaint'        // 컴플레인/불만
  | 'schedule_change'  // 단순 스케줄 변경
  | 'simple_inquiry'   // 단순 문의 (주차장, 위치 등)
  | 'missed_unanswered' // 부재중/미응답

// 보존기간 옵션 (일 단위) - 내부용
const RETENTION_PERIODS = {
  '3days': 3,
  '1week': 7,
  '2weeks': 14,
  '1month': 30,
  '3months': 90,
  '6months': 180,
  '1year': 365,
} as const;

type RetentionPeriod = keyof typeof RETENTION_PERIODS;

// 카테고리별 보존 설정 - 내부용
interface CategoryRetentionSetting {
  category: CallCategory;
  label: string;
  description: string;
  showInMainList: boolean;  // 메인 목록에 표시 여부
  retentionPeriod: RetentionPeriod;  // 보존 기간
  isActive: boolean;  // 활성화 여부
}

// 기본 설정값
const DEFAULT_RETENTION_SETTINGS: CategoryRetentionSetting[] = [
  {
    category: 'new_patient',
    label: '신규환자 상담',
    description: '처음 문의하는 신규 환자 상담 통화',
    showInMainList: true,
    retentionPeriod: '6months',
    isActive: true,
  },
  {
    category: 'existing_new_treatment',
    label: '기존환자 신규치료 문의',
    description: '기존 환자가 새로운 치료에 대해 문의하는 통화',
    showInMainList: true,
    retentionPeriod: '3months',
    isActive: true,
  },
  {
    category: 'complaint',
    label: '컴플레인/불만',
    description: '불만이나 컴플레인 관련 통화',
    showInMainList: true,
    retentionPeriod: '6months',
    isActive: true,
  },
  {
    category: 'schedule_change',
    label: '단순 스케줄 변경',
    description: '예약 변경, 취소 등 단순 스케줄 관련 통화',
    showInMainList: false,
    retentionPeriod: '2weeks',
    isActive: true,
  },
  {
    category: 'simple_inquiry',
    label: '단순 문의',
    description: '주차장, 위치, 영업시간 등 단순 문의 통화',
    showInMainList: false,
    retentionPeriod: '1week',
    isActive: true,
  },
  {
    category: 'missed_unanswered',
    label: '부재중/미응답',
    description: '받지 못한 전화 또는 응답 없는 통화',
    showInMainList: false,
    retentionPeriod: '3days',
    isActive: true,
  },
];

// GET: 보존 설정 조회
export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // settings 컬렉션에서 call-retention 문서 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let settings: any = await db.collection('settings').findOne({ type: 'call-retention' });

    // 없으면 기본값으로 생성
    if (!settings) {
      const newSettings = {
        type: 'call-retention',
        categories: DEFAULT_RETENTION_SETTINGS,
        autoArchiveEnabled: true,  // 자동 아카이브 활성화
        archiveRunTime: '03:00',   // 새벽 3시에 실행
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('settings').insertOne(newSettings);
      settings = newSettings;
    }

    return NextResponse.json({
      success: true,
      data: {
        categories: settings.categories || DEFAULT_RETENTION_SETTINGS,
        autoArchiveEnabled: settings.autoArchiveEnabled ?? true,
        archiveRunTime: settings.archiveRunTime || '03:00',
        retentionPeriodOptions: Object.entries(RETENTION_PERIODS).map(([key, days]) => ({
          value: key,
          label: days === 3 ? '3일' :
                 days === 7 ? '1주' :
                 days === 14 ? '2주' :
                 days === 30 ? '1개월' :
                 days === 90 ? '3개월' :
                 days === 180 ? '6개월' : '1년',
          days,
        })),
      },
    });
  } catch (error) {
    console.error('[CallRetention] 설정 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 보존 설정 업데이트
export async function PUT(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    const { categories, autoArchiveEnabled, archiveRunTime } = body;

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (categories) {
      updateFields.categories = categories;
    }
    if (typeof autoArchiveEnabled === 'boolean') {
      updateFields.autoArchiveEnabled = autoArchiveEnabled;
    }
    if (archiveRunTime) {
      updateFields.archiveRunTime = archiveRunTime;
    }

    await db.collection('settings').updateOne(
      { type: 'call-retention' },
      { $set: updateFields },
      { upsert: true }
    );

    console.log('[CallRetention] 설정 업데이트 완료');

    return NextResponse.json({
      success: true,
      message: '보존 설정이 저장되었습니다.',
    });
  } catch (error) {
    console.error('[CallRetention] 설정 업데이트 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
