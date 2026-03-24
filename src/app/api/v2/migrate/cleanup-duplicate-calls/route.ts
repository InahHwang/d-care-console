// 동시착신 중복 통화기록 정리 API
// 같은 발신번호 + 10초 이내 inbound 기록 중 중복 건 삭제
// 녹취/요약 있는 건 우선 보존

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json().catch(() => ({}));

    // date 파라미터: 특정 날짜(YYYY-MM-DD) 또는 "all"로 전체 정리
    const targetDate = body.date || 'all';

    const query: Record<string, unknown> = { direction: 'inbound' };
    if (targetDate !== 'all') {
      const startOfDay = new Date(`${targetDate}T00:00:00+09:00`);
      const endOfDay = new Date(`${targetDate}T23:59:59+09:00`);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const callLogs = await db.collection('callLogs_v2')
      .find(query)
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

      // 같은 발신번호 + 10초 이내인 기록 그룹핑
      const group = [current];
      for (let j = i + 1; j < callLogs.length; j++) {
        const other = callLogs[j];
        const otherPhone = (other.phone || '').replace(/\D/g, '');
        if (otherPhone !== phone) continue;

        const timeDiff = Math.abs(
          new Date(other.createdAt).getTime() - new Date(current.createdAt).getTime()
        );
        if (timeDiff > 10000) break; // 10초 초과면 다른 통화

        group.push(other);
      }

      if (group.length <= 1) {
        processed.add(currentId);
        continue;
      }

      // 보존 우선순위: 녹취 있는 것 > aiStatus completed > duration 큰 것
      group.sort((a, b) => {
        const aRec = a.recordingUrl && a.recordingUrl.startsWith('http') ? 1 : 0;
        const bRec = b.recordingUrl && b.recordingUrl.startsWith('http') ? 1 : 0;
        if (bRec !== aRec) return bRec - aRec;
        const aComp = a.aiStatus === 'completed' ? 1 : 0;
        const bComp = b.aiStatus === 'completed' ? 1 : 0;
        if (bComp !== aComp) return bComp - aComp;
        return (b.duration || 0) - (a.duration || 0);
      });

      for (let k = 0; k < group.length; k++) {
        processed.add(group[k]._id.toString());
        if (k > 0) {
          toDelete.push(group[k]._id);
        }
      }
    }

    // dryRun 모드 (기본): 삭제 대상만 확인
    if (body.dryRun !== false) {
      const deleteDetails = await db.collection('callLogs_v2')
        .find({ _id: { $in: toDelete.slice(0, 50) } })
        .project({ phone: 1, calledNumber: 1, status: 1, duration: 1, aiStatus: 1, createdAt: 1 })
        .toArray();

      return NextResponse.json({
        message: `[DRY RUN] ${targetDate} 중복 ${toDelete.length}건 발견`,
        totalLogs: callLogs.length,
        duplicateCount: toDelete.length,
        sample: deleteDetails,
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
