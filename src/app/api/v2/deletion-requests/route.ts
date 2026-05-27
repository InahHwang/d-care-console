// src/app/api/v2/deletion-requests/route.ts
// 삭제 승인 요청 — 매니저가 환자/여정 삭제를 요청하면 master/admin이 승인/거절한다.
//
// POST: 요청 생성 (manager 이상)
// GET : 요청 목록 조회
//        ?patientId=xxx → 해당 환자의 요청 (배지 표시용, 인증 사용자 누구나)
//        (param 없음)   → 전체 대기 목록 (master/admin 전용, 승인 화면용)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { canDeleteDirectly, canRequestDeletion, maskPatientName } from '@/lib/deletion';
import { logAudit } from '@/utils/auditLog';
import { DeletionRequest } from '@/types/v2';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const COLLECTION = 'deletionRequests_v2';

const createSchema = z.object({
  type: z.enum(['patient', 'journey']),
  patientId: z.string().min(1, '환자 ID는 필수입니다.'),
  journeyId: z.string().optional(),
  reason: z.string().trim().min(2, '삭제 사유를 입력해주세요. (2자 이상)').max(500),
});

// ============================================
// POST: 삭제 요청 생성
// ============================================
export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    if (!canRequestDeletion(auth.user.role)) {
      return NextResponse.json(
        { success: false, error: '삭제 요청 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { type, patientId, journeyId, reason } = parsed.data;

    if (type === 'journey' && !journeyId) {
      return NextResponse.json(
        { success: false, error: '여정 ID는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json({ success: false, error: '잘못된 환자 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    // 환자 존재 확인 (clinic 범위)
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId),
      clinicId,
      deletedAt: { $exists: false },
    });

    if (!patient) {
      return NextResponse.json({ success: false, error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    let journeyLabel: string | undefined;

    if (type === 'journey') {
      const journeys = (patient.journeys || []) as Array<{ id: string; treatmentType?: string }>;
      if (journeys.length <= 1) {
        return NextResponse.json(
          { success: false, error: '마지막 여정은 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }
      const target = journeys.find((j) => j.id === journeyId);
      if (!target) {
        return NextResponse.json({ success: false, error: '여정을 찾을 수 없습니다.' }, { status: 404 });
      }
      journeyLabel = target.treatmentType || '';
    }

    // 중복 대기 요청 방지
    const dupFilter: Record<string, unknown> = {
      clinicId,
      patientId,
      type,
      status: 'pending',
    };
    if (type === 'journey') dupFilter.journeyId = journeyId;

    const existing = await db.collection(COLLECTION).findOne(dupFilter);
    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 승인 대기 중인 삭제 요청이 있습니다.' },
        { status: 409 }
      );
    }

    const now = new Date();
    const doc: DeletionRequest = {
      clinicId,
      type,
      patientId,
      patientName: patient.name || '',
      journeyId: type === 'journey' ? journeyId : undefined,
      journeyLabel,
      reason,
      status: 'pending',
      requestedBy: auth.user.id,
      requestedByName: auth.user.name,
      requestedAt: now,
    };

    const result = await db.collection<DeletionRequest>(COLLECTION).insertOne(doc);

    // 활동 로그 (환자명 마스킹)
    logAudit(
      request,
      type === 'journey' ? 'journey.delete_request' : 'patient.delete_request',
      'patients_v2',
      patientId,
      [
        { field: 'requestType', oldValue: null, newValue: type },
        { field: 'reason', oldValue: null, newValue: reason },
        ...(type === 'journey' ? [{ field: 'journeyId', oldValue: null, newValue: journeyId }] : []),
      ],
      {
        documentName: maskPatientName(patient.name),
        reason,
      }
    );

    return NextResponse.json({
      success: true,
      data: { id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error('[DeletionRequests POST] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET: 삭제 요청 목록
// ============================================
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    const patientId = request.nextUrl.searchParams.get('patientId');
    const statusParam = request.nextUrl.searchParams.get('status') || 'pending';

    const filter: Record<string, unknown> = { clinicId };

    if (patientId) {
      // 환자 상세 배지용: 해당 환자의 요청만 (권한 제한 없음 — 본인 요청 상태 확인)
      filter.patientId = patientId;
      filter.status = 'pending';
    } else {
      // 전체 목록(승인 화면) — master/admin 전용
      if (!canDeleteDirectly(auth.user.role)) {
        return NextResponse.json(
          { success: false, error: '조회 권한이 없습니다.' },
          { status: 403 }
        );
      }
      if (statusParam !== 'all') {
        filter.status = statusParam;
      }
    }

    const docs = await db
      .collection<DeletionRequest>(COLLECTION)
      .find(filter)
      .sort({ requestedAt: -1 })
      .limit(200)
      .toArray();

    const requests = docs.map((doc) => ({
      id: doc._id!.toString(),
      type: doc.type,
      patientId: doc.patientId,
      patientName: doc.patientName,
      journeyId: doc.journeyId,
      journeyLabel: doc.journeyLabel,
      reason: doc.reason,
      status: doc.status,
      requestedBy: doc.requestedBy,
      requestedByName: doc.requestedByName,
      requestedAt:
        doc.requestedAt instanceof Date ? doc.requestedAt.toISOString() : doc.requestedAt,
      reviewedByName: doc.reviewedByName,
      reviewedAt: doc.reviewedAt instanceof Date ? doc.reviewedAt.toISOString() : doc.reviewedAt,
      rejectReason: doc.rejectReason,
    }));

    const pendingCount = requests.filter((r) => r.status === 'pending').length;

    return NextResponse.json({
      success: true,
      data: { requests, pendingCount },
    });
  } catch (error) {
    console.error('[DeletionRequests GET] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
