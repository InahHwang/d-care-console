// src/app/api/call-logs/archive/route.ts
// 통화기록 아카이브 API
// 기존 call-logs API는 건드리지 않고, 아카이브 전용 API를 별도로 생성

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

// 보존기간 (일 단위)
const RETENTION_PERIODS: Record<string, number> = {
  '3days': 3,
  '1week': 7,
  '2weeks': 14,
  '1month': 30,
  '3months': 90,
  '6months': 180,
  '1year': 365,
};

// AI 분석 결과를 카테고리로 매핑
function mapAnalysisResultToCategory(
  analysisResult: string | undefined,
  isMissed: boolean
): string {
  if (isMissed) {
    return 'missed_unanswered';
  }

  switch (analysisResult) {
    case '예약완료':
    case '예약예정':
      return 'new_patient';
    case '보류':
      return 'existing_new_treatment';
    case '거절':
      return 'complaint';
    case '단순문의':
    default:
      return 'simple_inquiry';
  }
}

// GET: 아카이브된 통화기록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search');

    const { db } = await connectToDatabase();

    // 아카이브 컬렉션에서 조회
    const filter: Record<string, unknown> = {};

    if (search) {
      filter.$or = [
        { callerNumber: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await db.collection('callLogsArchive').countDocuments(filter);
    const archives = await db
      .collection('callLogsArchive')
      .find(filter)
      .sort({ archivedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      data: archives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Archive] 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 아카이브 실행 (수동 또는 자동)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dryRun = false } = body; // dryRun: true면 실제 이동 없이 대상만 확인

    const { db } = await connectToDatabase();

    // 1. 보존 설정 조회
    const settings = await db.collection('settings').findOne({ type: 'call-retention' });
    if (!settings || !settings.categories) {
      return NextResponse.json({
        success: false,
        error: '보존 설정이 없습니다. 먼저 설정을 완료해주세요.',
      }, { status: 400 });
    }

    const categories = settings.categories;
    const now = new Date();
    const archiveResults: {
      category: string;
      count: number;
      retentionDays: number;
    }[] = [];

    // 2. 각 카테고리별로 아카이브 대상 확인
    for (const category of categories) {
      // 메인 목록에 표시되는 카테고리는 아카이브 대상 아님
      if (category.showInMainList) {
        continue;
      }

      const retentionDays = RETENTION_PERIODS[category.retentionPeriod] || 30;
      const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

      // callLogs에서 해당 카테고리의 오래된 기록 찾기
      // analysisResult와 isMissed를 기준으로 카테고리 매핑
      const callLogsCollection = db.collection('callLogs');

      // 분석 결과가 있는 통화기록 중 해당 카테고리에 해당하는 것 찾기
      let filter: Record<string, unknown> = {
        ringTime: { $lt: cutoffDate.toISOString() },
        isArchived: { $ne: true }, // 이미 아카이브된 건 제외
      };

      // 카테고리별 필터 조건
      if (category.category === 'missed_unanswered') {
        filter.isMissed = true;
      } else if (category.category === 'simple_inquiry') {
        // AI 분석 결과가 '단순문의'인 경우
        filter.$and = [
          { isMissed: false },
          {
            $or: [
              { 'analysisResult.result': '단순문의' },
              { analysisResult: { $exists: false } }, // 분석 안된 건도 포함
            ],
          },
        ];
      } else if (category.category === 'schedule_change') {
        // 스케줄 변경은 분석 결과에서 특별히 구분 필요
        // 현재는 단순문의와 함께 처리
        filter.$and = [
          { isMissed: false },
          { 'analysisResult.result': '단순문의' },
        ];
      }

      const targetCount = await callLogsCollection.countDocuments(filter);

      if (targetCount > 0 && !dryRun) {
        // 실제 아카이브 실행
        const targets = await callLogsCollection.find(filter).toArray();

        // 아카이브 컬렉션으로 복사
        const archiveData = targets.map(log => ({
          ...log,
          originalId: log._id,
          archivedAt: now.toISOString(),
          archivedCategory: category.category,
          retentionPeriod: category.retentionPeriod,
        }));

        if (archiveData.length > 0) {
          await db.collection('callLogsArchive').insertMany(archiveData);

          // 원본에 아카이브 표시 (삭제 대신 표시만)
          await callLogsCollection.updateMany(
            { _id: { $in: targets.map(t => t._id) } },
            {
              $set: {
                isArchived: true,
                archivedAt: now.toISOString(),
              },
            }
          );
        }
      }

      archiveResults.push({
        category: category.label,
        count: targetCount,
        retentionDays,
      });
    }

    const totalArchived = archiveResults.reduce((sum, r) => sum + r.count, 0);

    console.log(`[Archive] ${dryRun ? '(DRY RUN)' : ''} 아카이브 완료: ${totalArchived}건`);

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `${totalArchived}건이 아카이브 대상입니다.`
        : `${totalArchived}건이 아카이브되었습니다.`,
      results: archiveResults,
      archivedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Archive] 실행 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 아카이브에서 원본으로 복원
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const archiveId = searchParams.get('id');

    if (!archiveId) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 아카이브에서 찾기
    const archived = await db.collection('callLogsArchive').findOne({
      _id: new ObjectId(archiveId),
    });

    if (!archived) {
      return NextResponse.json(
        { success: false, error: 'Archive not found' },
        { status: 404 }
      );
    }

    // 원본 callLogs에서 아카이브 표시 제거
    if (archived.originalId) {
      await db.collection('callLogs').updateOne(
        { _id: archived.originalId },
        {
          $unset: { isArchived: '', archivedAt: '' },
        }
      );
    }

    // 아카이브에서 삭제
    await db.collection('callLogsArchive').deleteOne({
      _id: new ObjectId(archiveId),
    });

    console.log(`[Archive] 복원 완료: ${archiveId}`);

    return NextResponse.json({
      success: true,
      message: '통화기록이 복원되었습니다.',
    });
  } catch (error) {
    console.error('[Archive] 복원 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
