// src/app/api/v2/deletion-requests/[id]/approve/route.ts
// 삭제 요청 승인 → 실제 삭제 실행 (master/admin 전용)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import {
  canDeleteDirectly,
  performPatientDeletion,
  performJourneyDeletion,
  maskPatientName,
} from '@/lib/deletion';
import { extractUserFromRequest, logAudit } from '@/utils/auditLog';
import { DeletionRequest } from '@/types/v2';

export const dynamic = 'force-dynamic';

const COLLECTION = 'deletionRequests_v2';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    if (!canDeleteDirectly(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: '승인 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: '잘못된 요청 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const req = await db.collection<DeletionRequest>(COLLECTION).findOne({
      _id: new ObjectId(id),
      clinicId,
    });

    if (!req) {
      return NextResponse.json({ success: false, error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (req.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '이미 처리된 요청입니다.' },
        { status: 409 }
      );
    }

    // 대상 환자 조회 (clinic 범위)
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(req.patientId),
      clinicId,
    });

    if (!patient) {
      // 환자가 이미 사라진 경우 — 요청을 자동 거절 처리
      await db.collection<DeletionRequest>(COLLECTION).updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'rejected',
            reviewedBy: auth.user.id,
            reviewedByName: auth.user.name,
            reviewedAt: new Date(),
            rejectReason: '대상 환자가 존재하지 않습니다.',
          },
        }
      );
      return NextResponse.json({ success: false, error: '대상 환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const auditUser = extractUserFromRequest(request);
    let deletedCounts: Record<string, number> | undefined;

    if (req.type === 'patient') {
      const result = await performPatientDeletion(db, req.patientId);
      deletedCounts = result.deletedCounts;

      logAudit(
        request,
        'patient.delete',
        'patients_v2',
        req.patientId,
        [
          { field: 'action', oldValue: null, newValue: 'hard_delete (approved)' },
          { field: 'deletedCounts', oldValue: null, newValue: JSON.stringify(deletedCounts) },
          { field: 'deleteReason', oldValue: null, newValue: req.reason },
          { field: 'requestedBy', oldValue: null, newValue: req.requestedByName },
        ],
        { documentName: maskPatientName(patient.name), user: auditUser, reason: req.reason }
      );
    } else {
      // journey
      if (!req.journeyId) {
        return NextResponse.json({ success: false, error: '여정 ID가 없습니다.' }, { status: 400 });
      }
      const result = await performJourneyDeletion(db, req.patientId, req.journeyId, {
        journeys: patient.journeys,
        activeJourneyId: patient.activeJourneyId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.status || 400 }
        );
      }

      logAudit(
        request,
        'journey.delete',
        'patients_v2',
        req.patientId,
        [
          { field: 'action', oldValue: null, newValue: 'journey_delete (approved)' },
          { field: 'journeyId', oldValue: null, newValue: req.journeyId },
          { field: 'deleteReason', oldValue: null, newValue: req.reason },
          { field: 'requestedBy', oldValue: null, newValue: req.requestedByName },
        ],
        { documentName: maskPatientName(patient.name), user: auditUser, reason: req.reason }
      );
    }

    // 요청 승인 처리
    await db.collection<DeletionRequest>(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'approved',
          reviewedBy: auth.user.id,
          reviewedByName: auth.user.name,
          reviewedAt: new Date(),
          ...(deletedCounts ? { deletedCounts } : {}),
        },
      }
    );

    return NextResponse.json({ success: true, data: { deletedCounts } });
  } catch (error) {
    console.error('[DeletionRequests approve] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
