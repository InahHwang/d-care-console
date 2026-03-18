// src/app/api/v2/audit/backfill/route.ts
// 기존 데이터에서 최근 N일 활동을 감사 로그로 백필 (1회성)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

export async function POST(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user || user.userRole !== 'master') {
    return NextResponse.json({ error: '관리자만 실행 가능합니다.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const days = body.days || 2;

    const { db } = await connectToDatabase();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceISO = since.toISOString();

    const auditLogs: Record<string, unknown>[] = [];

    // 1. patients_v2의 statusHistory에서 상태 변경 이력 추출
    const patientsWithHistory = await db.collection('patients_v2').find({
      'statusHistory.changedAt': { $gte: sinceISO },
    }, {
      projection: { name: 1, statusHistory: 1 },
    }).toArray();

    // Date 객체/문자열 모두 대응
    const patientsWithHistoryDate = await db.collection('patients_v2').find({
      'statusHistory.changedAt': { $gte: since, $type: 'date' },
    }, {
      projection: { name: 1, statusHistory: 1 },
    }).toArray();

    const allPatients = [...patientsWithHistory, ...patientsWithHistoryDate];
    const seenPatientIds = new Set<string>();

    for (const patient of allPatients) {
      const pid = patient._id.toString();
      if (seenPatientIds.has(pid)) continue;
      seenPatientIds.add(pid);

      const history = patient.statusHistory || [];
      for (const entry of history) {
        const changedAt = new Date(entry.changedAt);
        if (changedAt < since) continue;

        auditLogs.push({
          userId: 'backfill',
          userName: entry.changedBy || 'unknown',
          userRole: 'unknown',
          action: 'patient.status_change',
          collection: 'patients_v2',
          documentId: pid,
          documentName: patient.name,
          changes: [
            { field: 'status', oldValue: entry.from, newValue: entry.to },
          ],
          reason: entry.reason || undefined,
          ipAddress: 'backfill',
          userAgent: 'backfill',
          timestamp: changedAt,
        });
      }
    }

    // 2. consultations_v2에서 최근 상담 기록
    const consultations = await db.collection('consultations_v2').find({
      $or: [
        { createdAt: { $gte: sinceISO } },
        { createdAt: { $gte: since, $type: 'date' } },
      ],
    }).toArray();

    for (const c of consultations) {
      // 환자 이름 조회
      let patientName = '';
      try {
        const { ObjectId } = await import('mongodb');
        const p = await db.collection('patients_v2').findOne(
          { _id: new ObjectId(c.patientId) },
          { projection: { name: 1 } }
        );
        patientName = p?.name || '';
      } catch { /* ignore */ }

      auditLogs.push({
        userId: 'backfill',
        userName: c.consultantName || 'unknown',
        userRole: 'unknown',
        action: 'consultation.create',
        collection: 'consultations_v2',
        documentId: c._id.toString(),
        documentName: patientName,
        changes: [
          { field: 'status', oldValue: null, newValue: c.status },
          { field: 'treatment', oldValue: null, newValue: c.treatment || '' },
          { field: 'finalAmount', oldValue: null, newValue: c.finalAmount || 0 },
        ],
        ipAddress: 'backfill',
        userAgent: 'backfill',
        timestamp: new Date(c.createdAt),
      });
    }

    // 3. callbacks_v2에서 최근 콜백
    const callbacks = await db.collection('callbacks_v2').find({
      $or: [
        { createdAt: { $gte: sinceISO } },
        { createdAt: { $gte: since, $type: 'date' } },
      ],
    }).toArray();

    for (const cb of callbacks) {
      auditLogs.push({
        userId: 'backfill',
        userName: 'unknown',
        userRole: 'unknown',
        action: 'callback.create',
        collection: 'callbacks_v2',
        documentId: cb._id.toString(),
        documentName: cb.patientId,
        changes: [
          { field: 'type', oldValue: null, newValue: cb.type },
          { field: 'status', oldValue: null, newValue: cb.status },
          { field: 'scheduledAt', oldValue: null, newValue: cb.scheduledAt },
        ],
        ipAddress: 'backfill',
        userAgent: 'backfill',
        timestamp: new Date(cb.createdAt),
      });
    }

    // 중복 방지: 기존 백필 데이터 삭제 후 삽입
    if (auditLogs.length > 0) {
      await db.collection('auditLogs_v2').deleteMany({ ipAddress: 'backfill' });
      await db.collection('auditLogs_v2').insertMany(auditLogs);
    }

    return NextResponse.json({
      success: true,
      message: `최근 ${days}일 활동 ${auditLogs.length}건 백필 완료`,
      breakdown: {
        statusChanges: auditLogs.filter(l => l.action === 'patient.status_change').length,
        consultations: auditLogs.filter(l => l.action === 'consultation.create').length,
        callbacks: auditLogs.filter(l => l.action === 'callback.create').length,
      },
    });
  } catch (error) {
    console.error('[Audit Backfill] 오류:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
