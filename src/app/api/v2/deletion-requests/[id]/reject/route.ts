// src/app/api/v2/deletion-requests/[id]/reject/route.ts
// 삭제 요청 거절 (master/admin 전용)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { canDeleteDirectly, maskPatientName } from '@/lib/deletion';
import { logAudit } from '@/utils/auditLog';
import { DeletionRequest } from '@/types/v2';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const COLLECTION = 'deletionRequests_v2';

const rejectSchema = z.object({
  rejectReason: z.string().trim().max(500).optional(),
});

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
        { success: false, error: '거절 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: '잘못된 요청 ID입니다.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = rejectSchema.safeParse(body);
    const rejectReason = parsed.success ? parsed.data.rejectReason : undefined;

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

    await db.collection<DeletionRequest>(COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'rejected',
          reviewedBy: auth.user.id,
          reviewedByName: auth.user.name,
          reviewedAt: new Date(),
          rejectReason: rejectReason || '',
        },
      }
    );

    logAudit(
      request,
      'patient.delete_reject',
      'patients_v2',
      req.patientId,
      [
        { field: 'requestType', oldValue: null, newValue: req.type },
        { field: 'rejectReason', oldValue: null, newValue: rejectReason || '' },
        { field: 'requestedBy', oldValue: null, newValue: req.requestedByName },
      ],
      { documentName: maskPatientName(req.patientName), reason: rejectReason }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DeletionRequests reject] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
