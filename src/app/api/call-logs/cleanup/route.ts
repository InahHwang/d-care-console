// src/app/api/call-logs/cleanup/route.ts
// 중복 통화기록 정리 API

import { NextRequest, NextResponse } from 'next/server';
import { getCallLogsCollection } from '@/utils/mongodb';

// POST - 중복 통화기록 정리
export async function POST(request: NextRequest) {
  try {
    const callLogsCollection = await getCallLogsCollection();

    // 모든 통화기록 조회 (시간순)
    const allLogs = await callLogsCollection
      .find({})
      .sort({ ringTime: 1 })
      .toArray();

    console.log(`[Cleanup] 전체 통화기록: ${allLogs.length}개`);

    // 전화번호 + 시간대(5분 이내)로 그룹화하여 중복 찾기
    const toDelete: string[] = [];
    const processed = new Map<string, any>(); // key: 전화번호+시간대, value: 대표 기록

    for (const log of allLogs) {
      const phone = (log.callerNumber || '').replace(/\D/g, '').slice(-8);
      const ringTime = new Date(log.ringTime).getTime();

      // 같은 번호의 최근 기록 찾기 (5분 이내)
      let foundKey: string | null = null;
      const entries = Array.from(processed.entries());
      for (let i = 0; i < entries.length; i++) {
        const [key, existing] = entries[i];
        if (key.startsWith(phone)) {
          const existingTime = new Date(existing.ringTime).getTime();
          const timeDiff = Math.abs(ringTime - existingTime);

          // 5분(300초) 이내면 같은 통화로 간주
          if (timeDiff < 5 * 60 * 1000) {
            foundKey = key;
            break;
          }
        }
      }

      if (foundKey) {
        // 이미 처리된 통화 - 중복이므로 삭제 대상
        // 단, ended/answered 상태가 더 우선순위 높음
        const existing = processed.get(foundKey);

        // 현재 기록이 더 완성된 기록이면 기존 것을 삭제 대상으로
        if (
          (log.callStatus === 'ended' && existing.callStatus !== 'ended') ||
          (log.callStatus === 'answered' && existing.callStatus === 'ringing')
        ) {
          toDelete.push(existing._id.toString());
          processed.set(foundKey, log);
        } else {
          // 현재 기록이 덜 완성된 기록이면 현재 것을 삭제 대상으로
          toDelete.push(log._id.toString());
        }
      } else {
        // 새로운 통화
        const newKey = `${phone}_${ringTime}`;
        processed.set(newKey, log);
      }
    }

    console.log(`[Cleanup] 삭제 대상: ${toDelete.length}개`);

    // 중복 기록 삭제
    if (toDelete.length > 0) {
      const { ObjectId } = await import('mongodb');
      const deleteResult = await callLogsCollection.deleteMany({
        _id: { $in: toDelete.map(id => new ObjectId(id)) }
      });
      console.log(`[Cleanup] 삭제 완료: ${deleteResult.deletedCount}개`);

      return NextResponse.json({
        success: true,
        message: `중복 통화기록 ${deleteResult.deletedCount}개 삭제 완료`,
        before: allLogs.length,
        after: allLogs.length - deleteResult.deletedCount,
        deleted: deleteResult.deletedCount
      });
    }

    return NextResponse.json({
      success: true,
      message: '삭제할 중복 기록이 없습니다',
      before: allLogs.length,
      after: allLogs.length,
      deleted: 0
    });

  } catch (error) {
    console.error('[Cleanup API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
