// 동시착신 중복 통화기록 정리 API
// 같은 발신번호 + 5초 이내 inbound 기록 중 중복 건 삭제
// 실제 통화된(connected) 건은 보존, 나머지(ringing/missed) 삭제

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json().catch(() => ({}));

    // 기본: 오늘자. date 파라미터로 특정 날짜 지정 가능 (YYYY-MM-DD)
    const targetDate = body.date || new Date().toISOString().split('T')[0];
    const startOfDay = new Date(`${targetDate}T00:00:00+09:00`);
    const endOfDay = new Date(`${targetDate}T23:59:59+09:00`);

    // 오늘자 inbound 통화기록 조회 (시간순 정렬)
    const callLogs = await db.collection('callLogs_v2')
      .find({
        direction: 'inbound',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })
      .sort({ createdAt: 1 })
      .toArray();

    const toDelete: ObjectId[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < callLogs.length; i++) {
      const current = callLogs[i];
      const currentId = current._id.toString();
      if (processed.has(currentId)) continue;

      const phone = (current.phone || '').replace(/\D/g, '');
      if (!phone) continue;

      // 같은 발신번호 + 5초 이내인 기록 그룹핑
      const group = [current];
      for (let j = i + 1; j < callLogs.length; j++) {
        const other = callLogs[j];
        const otherPhone = (other.phone || '').replace(/\D/g, '');
        if (otherPhone !== phone) continue;

        const timeDiff = Math.abs(
          new Date(other.createdAt).getTime() - new Date(current.createdAt).getTime()
        );
        if (timeDiff > 5000) break; // 5초 초과면 다른 통화

        group.push(other);
      }

      if (group.length <= 1) continue; // 중복 없음

      // connected 건이 있으면 그걸 보존, 없으면 첫 번째 보존
      const connected = group.find(g => g.status === 'connected');
      const keep = connected || group[0];

      for (const log of group) {
        processed.add(log._id.toString());
        if (log._id.toString() !== keep._id.toString()) {
          toDelete.push(log._id);
        }
      }
    }

    // dryRun 모드 (기본): 삭제 대상만 확인
    if (body.dryRun !== false) {
      const deleteDetails = await db.collection('callLogs_v2')
        .find({ _id: { $in: toDelete } })
        .project({ phone: 1, calledNumber: 1, status: 1, createdAt: 1 })
        .toArray();

      return NextResponse.json({
        message: `[DRY RUN] ${targetDate} 중복 ${toDelete.length}건 발견`,
        totalLogs: callLogs.length,
        duplicateCount: toDelete.length,
        duplicates: deleteDetails,
        hint: 'dryRun: false 로 실행하면 실제 삭제됩니다',
      });
    }

    // 실제 삭제
    if (toDelete.length > 0) {
      const result = await db.collection('callLogs_v2').deleteMany({
        _id: { $in: toDelete },
      });

      return NextResponse.json({
        message: `${targetDate} 중복 ${result.deletedCount}건 삭제 완료`,
        deletedCount: result.deletedCount,
      });
    }

    return NextResponse.json({
      message: `${targetDate} 중복 기록 없음`,
      totalLogs: callLogs.length,
      duplicateCount: 0,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: '정리 중 오류 발생' },
      { status: 500 }
    );
  }
}
