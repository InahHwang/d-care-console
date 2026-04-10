// src/app/api/v2/migrate/link-consultation-results/route.ts
// callLogId / manualConsultationId 없는 상담결과를 시간 매칭으로 연결
// GET: 미리보기 (dry-run), POST: 실제 수정

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

// GET: 미연결 상담결과 조회 + 매칭 후보 미리보기
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const clinicId = 'default';

    // 1. callLogId 없는 phone 결과 조회
    const orphanPhoneResults = await db.collection('consultations_v2')
      .find({ clinicId, type: 'phone', $or: [{ callLogId: { $exists: false } }, { callLogId: null }, { callLogId: '' }] })
      .sort({ createdAt: -1 })
      .toArray();

    // 2. manualConsultationId 없는 visit 결과 조회
    const orphanVisitResults = await db.collection('consultations_v2')
      .find({ clinicId, type: 'visit', $or: [{ manualConsultationId: { $exists: false } }, { manualConsultationId: null }, { manualConsultationId: '' }] })
      .sort({ createdAt: -1 })
      .toArray();

    // 이미 사용된 callLogId 수집 (중복 방지)
    const usedCallLogIds = new Set<string>();
    const linkedPhoneResults = await db.collection('consultations_v2')
      .find({ clinicId, type: 'phone', callLogId: { $exists: true, $nin: [null, ''] } })
      .project({ callLogId: 1 })
      .toArray();
    for (const r of linkedPhoneResults) {
      if (r.callLogId) usedCallLogIds.add(r.callLogId);
    }

    // 이미 사용된 manualConsultationId 수집
    const usedManualIds = new Set<string>();
    const linkedVisitResults = await db.collection('consultations_v2')
      .find({ clinicId, type: 'visit', manualConsultationId: { $exists: true, $nin: [null, ''] } })
      .project({ manualConsultationId: 1 })
      .toArray();
    for (const r of linkedVisitResults) {
      if (r.manualConsultationId) usedManualIds.add(r.manualConsultationId);
    }

    // 3. phone 결과 → 통화기록 매칭
    const phoneMatches = [];
    for (const result of orphanPhoneResults) {
      const resultTime = new Date(result.createdAt || result.date).getTime();
      const patientId = result.patientId;

      // 같은 환자의 통화기록 중 24시간 이내 가장 가까운 것
      const callLogs = await db.collection('callLogs_v2')
        .find({
          clinicId,
          patientId,
          startedAt: {
            $gte: new Date(resultTime - 24 * 60 * 60 * 1000),
            $lte: new Date(resultTime + 24 * 60 * 60 * 1000),
          },
        })
        .sort({ startedAt: -1 })
        .toArray();

      let bestMatch: { callLogId: string; diff: number; startedAt: string; direction: string } | null = null;
      for (const call of callLogs) {
        const callId = call._id.toString();
        if (usedCallLogIds.has(callId)) continue; // 이미 다른 결과에 연결됨
        const diff = Math.abs(new Date(call.startedAt).getTime() - resultTime);
        if (!bestMatch || diff < bestMatch.diff) {
          bestMatch = { callLogId: callId, diff, startedAt: call.startedAt, direction: call.direction };
        }
      }

      // 환자 이름 조회
      let patientName = '';
      try {
        const { ObjectId } = require('mongodb');
        const patient = await db.collection('patients_v2').findOne(
          { _id: new ObjectId(patientId) },
          { projection: { name: 1 } }
        );
        patientName = patient?.name || '';
      } catch { /* ignore */ }

      phoneMatches.push({
        resultId: result._id.toString(),
        patientId,
        patientName,
        resultStatus: result.status,
        treatment: result.treatment,
        resultCreatedAt: result.createdAt || result.date,
        match: bestMatch ? {
          callLogId: bestMatch.callLogId,
          timeDiffMinutes: Math.round(bestMatch.diff / 60000),
          callStartedAt: bestMatch.startedAt,
          callDirection: bestMatch.direction,
        } : null,
      });

      // 매칭 성공 시 usedCallLogIds에 추가 (중복 방지)
      if (bestMatch) {
        usedCallLogIds.add(bestMatch.callLogId);
      }
    }

    // 4. visit 결과 → 수동상담 매칭
    const visitMatches = [];
    for (const result of orphanVisitResults) {
      const resultTime = new Date(result.createdAt || result.date).getTime();
      const patientId = result.patientId;

      // source='consultation_result'인 수동상담 (자동 생성된 것) 중 5분 이내
      const manuals = await db.collection('manualConsultations_v2')
        .find({
          clinicId,
          patientId,
          source: 'consultation_result',
          date: {
            $gte: new Date(resultTime - 5 * 60 * 1000),
            $lte: new Date(resultTime + 5 * 60 * 1000),
          },
        })
        .toArray();

      let bestMatch: { manualId: string; diff: number; date: string } | null = null;
      for (const manual of manuals) {
        const manualId = manual._id.toString();
        if (usedManualIds.has(manualId)) continue;
        const diff = Math.abs(new Date(manual.date).getTime() - resultTime);
        if (!bestMatch || diff < bestMatch.diff) {
          bestMatch = { manualId, diff, date: manual.date };
        }
      }

      let patientName = '';
      try {
        const { ObjectId } = require('mongodb');
        const patient = await db.collection('patients_v2').findOne(
          { _id: new ObjectId(patientId) },
          { projection: { name: 1 } }
        );
        patientName = patient?.name || '';
      } catch { /* ignore */ }

      visitMatches.push({
        resultId: result._id.toString(),
        patientId,
        patientName,
        resultStatus: result.status,
        treatment: result.treatment,
        resultCreatedAt: result.createdAt || result.date,
        match: bestMatch ? {
          manualConsultationId: bestMatch.manualId,
          timeDiffMinutes: Math.round(bestMatch.diff / 60000),
          manualDate: bestMatch.date,
        } : null,
      });

      if (bestMatch) {
        usedManualIds.add(bestMatch.manualId);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        orphanPhoneResults: orphanPhoneResults.length,
        orphanVisitResults: orphanVisitResults.length,
        phoneMatchable: phoneMatches.filter(m => m.match).length,
        phoneUnmatchable: phoneMatches.filter(m => !m.match).length,
        visitMatchable: visitMatches.filter(m => m.match).length,
        visitUnmatchable: visitMatches.filter(m => !m.match).length,
      },
      phoneMatches,
      visitMatches,
    });
  } catch (error) {
    console.error('[Migration] link-consultation-results GET 오류:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 실제 연결 수행
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const clinicId = 'default';
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;

    // 이미 사용된 ID 수집
    const usedCallLogIds = new Set<string>();
    const linkedPhone = await db.collection('consultations_v2')
      .find({ clinicId, type: 'phone', callLogId: { $exists: true, $nin: [null, ''] } })
      .project({ callLogId: 1 })
      .toArray();
    for (const r of linkedPhone) {
      if (r.callLogId) usedCallLogIds.add(r.callLogId);
    }

    const usedManualIds = new Set<string>();
    const linkedVisit = await db.collection('consultations_v2')
      .find({ clinicId, type: 'visit', manualConsultationId: { $exists: true, $nin: [null, ''] } })
      .project({ manualConsultationId: 1 })
      .toArray();
    for (const r of linkedVisit) {
      if (r.manualConsultationId) usedManualIds.add(r.manualConsultationId);
    }

    const { ObjectId } = require('mongodb');
    const updates: { type: string; resultId: string; field: string; value: string; timeDiff: number }[] = [];

    // 1. phone 결과 → callLogId 연결
    const orphanPhone = await db.collection('consultations_v2')
      .find({ clinicId, type: 'phone', $or: [{ callLogId: { $exists: false } }, { callLogId: null }, { callLogId: '' }] })
      .sort({ createdAt: -1 })
      .toArray();

    for (const result of orphanPhone) {
      const resultTime = new Date(result.createdAt || result.date).getTime();
      const callLogs = await db.collection('callLogs_v2')
        .find({
          clinicId,
          patientId: result.patientId,
          startedAt: {
            $gte: new Date(resultTime - 24 * 60 * 60 * 1000),
            $lte: new Date(resultTime + 24 * 60 * 60 * 1000),
          },
        })
        .sort({ startedAt: -1 })
        .toArray();

      let bestMatch: { callLogId: string; diff: number } | null = null;
      for (const call of callLogs) {
        const callId = call._id.toString();
        if (usedCallLogIds.has(callId)) continue;
        const diff = Math.abs(new Date(call.startedAt).getTime() - resultTime);
        if (!bestMatch || diff < bestMatch.diff) {
          bestMatch = { callLogId: callId, diff };
        }
      }

      if (bestMatch) {
        if (!dryRun) {
          await db.collection('consultations_v2').updateOne(
            { _id: result._id },
            { $set: { callLogId: bestMatch.callLogId } }
          );
        }
        usedCallLogIds.add(bestMatch.callLogId);
        updates.push({
          type: 'phone',
          resultId: result._id.toString(),
          field: 'callLogId',
          value: bestMatch.callLogId,
          timeDiff: Math.round(bestMatch.diff / 60000),
        });
      }
    }

    // 2. visit 결과 → manualConsultationId 연결
    const orphanVisit = await db.collection('consultations_v2')
      .find({ clinicId, type: 'visit', $or: [{ manualConsultationId: { $exists: false } }, { manualConsultationId: null }, { manualConsultationId: '' }] })
      .sort({ createdAt: -1 })
      .toArray();

    for (const result of orphanVisit) {
      const resultTime = new Date(result.createdAt || result.date).getTime();
      const manuals = await db.collection('manualConsultations_v2')
        .find({
          clinicId,
          patientId: result.patientId,
          source: 'consultation_result',
          date: {
            $gte: new Date(resultTime - 5 * 60 * 1000),
            $lte: new Date(resultTime + 5 * 60 * 1000),
          },
        })
        .toArray();

      let bestMatch: { manualId: string; diff: number } | null = null;
      for (const manual of manuals) {
        const manualId = manual._id.toString();
        if (usedManualIds.has(manualId)) continue;
        const diff = Math.abs(new Date(manual.date).getTime() - resultTime);
        if (!bestMatch || diff < bestMatch.diff) {
          bestMatch = { manualId, diff };
        }
      }

      if (bestMatch) {
        if (!dryRun) {
          await db.collection('consultations_v2').updateOne(
            { _id: result._id },
            { $set: { manualConsultationId: bestMatch.manualId } }
          );
        }
        usedManualIds.add(bestMatch.manualId);
        updates.push({
          type: 'visit',
          resultId: result._id.toString(),
          field: 'manualConsultationId',
          value: bestMatch.manualId,
          timeDiff: Math.round(bestMatch.diff / 60000),
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalOrphans: { phone: orphanPhone.length, visit: orphanVisit.length },
      linked: updates.length,
      unlinked: (orphanPhone.length + orphanVisit.length) - updates.length,
      updates,
    });
  } catch (error) {
    console.error('[Migration] link-consultation-results POST 오류:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
