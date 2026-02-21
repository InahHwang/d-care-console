// src/app/api/v2/migration/fix-duration/route.ts
// 2026-02-13 수신 통화 duration 복구 + 고아 callLog 정리
// 일회성 마이그레이션 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const maxDuration = 120; // 2분 타임아웃

// WAV 파일 헤더에서 통화시간 추출
function getWavDuration(base64Data: string): number {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 44) return 0;

    // WAV header: bytes 28-31 = byte rate (bytes per second)
    const byteRate = buffer.readUInt32LE(28);
    if (byteRate === 0) return 0;

    // Data size = total - header (약 44 bytes)
    const dataSize = buffer.length - 44;
    return Math.round(dataSize / byteRate);
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dryRun = true, targetDate = '2026-02-13' } = body;

    console.log(`[Migration] duration 복구 시작 (dryRun=${dryRun}, date=${targetDate})`);

    const { db } = await connectToDatabase();

    // 1. 대상 날짜의 수신 통화 중 duration ≤ 5초인 것 찾기 (Date 타입 createdAt)
    const dateStart = new Date(targetDate + 'T00:00:00+09:00');
    const dateEnd = new Date(targetDate + 'T23:59:59.999+09:00');

    const affectedLogs = await db.collection('callLogs_v2').find({
      direction: 'inbound',
      status: 'connected',
      duration: { $lte: 5 },
      createdAt: { $gte: dateStart, $lte: dateEnd },
    }).toArray();

    console.log(`[Migration] 대상 통화기록: ${affectedLogs.length}건`);

    const results: Array<{
      callLogId: string;
      phone: string;
      oldDuration: number;
      newDuration: number;
      hadAiAnalysis: boolean;
      reTriggered: boolean;
      orphanDeleted: boolean;
    }> = [];

    for (const log of affectedLogs) {
      const callLogId = log._id.toString();
      const phone = log.phone;

      // 2. 녹취 데이터 찾기
      const recording = await db.collection('callRecordings_v2').findOne({
        callLogId: callLogId,
      });

      let newDuration = 0;
      if (recording?.recordingBase64) {
        newDuration = getWavDuration(recording.recordingBase64);
        console.log(`[Migration] ${callLogId} (${phone}): WAV duration = ${newDuration}초`);
      }

      // WAV 파싱 실패 시 고아 callLog의 startedAt으로 추정
      if (newDuration === 0) {
        // 같은 전화번호의 고아 callLog (string 타입 createdAt) 찾기
        const orphans = await db.collection('callLogs_v2').find({
          phone: phone,
          direction: 'inbound',
          _id: { $ne: log._id },
          // string 타입 createdAt은 Date 비교에 안 걸리므로 별도 검색
        }).toArray();

        // 고아 중 createdAt이 string인 것 (= incoming-call에서 생성된 원본)
        const orphan = orphans.find(o =>
          typeof o.createdAt === 'string' &&
          o.createdAt.startsWith(targetDate.replace(/-/g, '').slice(0, 4)) // 같은 연도
        );

        if (orphan && orphan.startedAt && log.endedAt) {
          const start = new Date(orphan.startedAt);
          const end = new Date(log.endedAt);
          newDuration = Math.round((end.getTime() - start.getTime()) / 1000);
          // ring 시간 약 10초 빼기 (대략적)
          newDuration = Math.max(newDuration - 10, Math.round(newDuration * 0.85));
          console.log(`[Migration] ${callLogId}: 고아 startedAt 기반 추정 = ${newDuration}초`);
        }
      }

      if (newDuration <= 5) {
        console.log(`[Migration] ${callLogId}: duration 추정 실패, 건너뜀`);
        continue;
      }

      const hadAiAnalysis = !!(log.aiAnalysis?.summary && log.aiAnalysis.summary !== '부재중 통화');
      let reTriggered = false;

      if (!dryRun) {
        // 3. duration 업데이트
        await db.collection('callLogs_v2').updateOne(
          { _id: log._id },
          {
            $set: {
              duration: newDuration,
              updatedAt: new Date(),
            },
          }
        );

        // 4. AI 요약이 없으면 파이프라인 재실행
        if (!hadAiAnalysis && recording?.recordingBase64) {
          await db.collection('callLogs_v2').updateOne(
            { _id: log._id },
            { $set: { aiStatus: 'pending' } }
          );

          try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app';
            // STT → AI 분석 파이프라인
            const sttRes = await fetch(`${baseUrl}/api/v2/call-analysis/transcribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callLogId }),
            });
            if (sttRes.ok) {
              const sttResult = await sttRes.json();
              if (sttResult.success && !sttResult.skipped) {
                await fetch(`${baseUrl}/api/v2/call-analysis/analyze`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ callLogId }),
                });
              }
            }
            reTriggered = true;
          } catch (err) {
            console.error(`[Migration] ${callLogId}: 파이프라인 오류`, err);
          }
        }
      }

      // 5. 고아 callLog 정리 (같은 전화번호, string createdAt)
      let orphanDeleted = false;
      if (!dryRun) {
        const allForPhone = await db.collection('callLogs_v2').find({
          phone: phone,
          direction: 'inbound',
          _id: { $ne: log._id },
        }).toArray();

        for (const orphan of allForPhone) {
          if (typeof orphan.createdAt === 'string') {
            // 같은 날짜 범위인지 확인
            const orphanDate = orphan.createdAt.substring(0, 10);
            if (orphanDate === targetDate) {
              await db.collection('callLogs_v2').deleteOne({ _id: orphan._id });
              console.log(`[Migration] 고아 삭제: ${orphan._id} (${phone})`);
              orphanDeleted = true;
            }
          }
        }
      }

      results.push({
        callLogId,
        phone,
        oldDuration: log.duration,
        newDuration,
        hadAiAnalysis,
        reTriggered,
        orphanDeleted,
      });
    }

    // 6. 추가: Date 비교에 안 걸리는 고아 callLog들도 찾기
    // string 타입 createdAt은 Date $gte/$lte에 안 걸리므로 별도 검색
    const allInboundLogs = await db.collection('callLogs_v2').find({
      direction: 'inbound',
    }).toArray();

    const stringDateOrphans = allInboundLogs.filter(log => {
      if (typeof log.createdAt !== 'string') return false;
      const dateStr = log.createdAt.substring(0, 10);
      return dateStr === targetDate;
    });

    console.log(`[Migration] 고아 callLog (string 날짜): ${stringDateOrphans.length}건`);

    let orphanCleanupCount = 0;
    if (!dryRun) {
      for (const orphan of stringDateOrphans) {
        // 같은 phone으로 Date 타입 callLog가 있는지 확인
        const hasReplacement = await db.collection('callLogs_v2').findOne({
          phone: orphan.phone,
          direction: 'inbound',
          _id: { $ne: orphan._id },
          createdAt: { $gte: dateStart, $lte: dateEnd },
        });

        if (hasReplacement) {
          await db.collection('callLogs_v2').deleteOne({ _id: orphan._id });
          orphanCleanupCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      targetDate,
      summary: {
        affectedLogs: affectedLogs.length,
        fixedDurations: results.length,
        reTriggeredPipelines: results.filter(r => r.reTriggered).length,
        stringDateOrphans: stringDateOrphans.length,
        orphansDeleted: orphanCleanupCount,
      },
      details: results,
      orphanPhones: stringDateOrphans.map(o => ({
        id: o._id.toString(),
        phone: o.phone,
        duration: o.duration,
        aiStatus: o.aiStatus,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Migration] 오류:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
