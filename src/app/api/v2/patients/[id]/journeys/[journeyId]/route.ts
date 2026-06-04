// src/app/api/v2/patients/[id]/journeys/[journeyId]/route.ts
// 개별 여정 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PatientStatus } from '@/types/v2';
import { verifyToken } from '@/lib/auth';
import { canDeleteDirectly, performJourneyDeletion, maskPatientName } from '@/lib/deletion';
import { extractUserFromRequest, logAudit } from '@/utils/auditLog';

export const dynamic = 'force-dynamic';

// GET: 특정 여정 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; journeyId: string }> }
) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id, journeyId } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const patient = await db.collection('patients_v2').findOne(
      { _id: new ObjectId(id) },
      { projection: { journeys: 1, activeJourneyId: 1 } }
    );

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const journey = patient.journeys?.find((j: { id: string }) => j.id === journeyId);

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    return NextResponse.json({
      journey,
      isActive: patient.activeJourneyId === journeyId,
    });
  } catch (error) {
    console.error('Error fetching journey:', error);
    return NextResponse.json(
      { error: 'Failed to fetch journey' },
      { status: 500 }
    );
  }
}

// PATCH: 여정 수정 (상태, 금액 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; journeyId: string }> }
) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id, journeyId } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      status,
      estimatedAmount,
      actualAmount,
      paymentStatus,
      treatmentNote,
      treatmentType, // 치료 유형 (관심 분야)
      closedAt,
      eventDate,
      changedBy,
      setActive, // true면 이 여정을 활성 여정으로 설정
    } = body;

    const { db } = await connectToDatabase();

    // 현재 환자 정보 조회
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id),
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const currentJourney = patient.journeys?.find((j: { id: string }) => j.id === journeyId);
    if (!currentJourney) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    const now = new Date();
    const updateFields: Record<string, unknown> = {
      'journeys.$[journey].updatedAt': now,
    };

    // 상태 변경
    if (status !== undefined && status !== currentJourney.status) {
      updateFields['journeys.$[journey].status'] = status;

      // 상태 히스토리 추가
      const statusHistoryEntry = {
        from: currentJourney.status,
        to: status,
        eventDate: eventDate ? new Date(eventDate) : now,
        changedAt: now,
        changedBy: changedBy || undefined,
      };

      // 종결 상태면 closedAt 설정
      if (status === 'closed' || status === 'completed') {
        updateFields['journeys.$[journey].closedAt'] = closedAt ? new Date(closedAt) : now;
        updateFields['journeys.$[journey].isActive'] = false;
      }

      // 활성 여정이면 환자 기본 상태도 업데이트
      if (patient.activeJourneyId === journeyId) {
        updateFields.status = status;
        updateFields.statusChangedAt = now;
      }

      // statusHistory push는 별도로 처리
      const pushUpdate: Record<string, unknown> = {
        'journeys.$[journey].statusHistory': statusHistoryEntry,
      };
      if (patient.activeJourneyId === journeyId) {
        pushUpdate.statusHistory = statusHistoryEntry;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(id) },
        { $push: pushUpdate } as any,
        { arrayFilters: [{ 'journey.id': journeyId }] }
      );
    }

    // 금액 관련 필드
    if (estimatedAmount !== undefined) {
      updateFields['journeys.$[journey].estimatedAmount'] = Math.round(Number(estimatedAmount));
      if (patient.activeJourneyId === journeyId) {
        updateFields.estimatedAmount = Math.round(Number(estimatedAmount));
      }
    }
    if (actualAmount !== undefined) {
      updateFields['journeys.$[journey].actualAmount'] = Math.round(Number(actualAmount));
      if (patient.activeJourneyId === journeyId) {
        updateFields.actualAmount = Math.round(Number(actualAmount));
      }
    }
    if (paymentStatus !== undefined) {
      updateFields['journeys.$[journey].paymentStatus'] = paymentStatus;
      if (patient.activeJourneyId === journeyId) {
        updateFields.paymentStatus = paymentStatus;
      }
      // 🆕 paidAt: 이 여정의 결제(부분/완납) 첫 전환 시점 기록 — 인센티브 소급 판별용
      //   none → partial/completed로 처음 바뀔 때만, 이미 있으면 유지
      const PAID_STATUSES = ['partial', 'completed'];
      if (
        PAID_STATUSES.includes(paymentStatus) &&
        !PAID_STATUSES.includes(String(currentJourney.paymentStatus ?? 'none')) &&
        !currentJourney.paidAt
      ) {
        updateFields['journeys.$[journey].paidAt'] = now;
        if (patient.activeJourneyId === journeyId) {
          updateFields.paidAt = now;
        }
      }
    }
    if (treatmentNote !== undefined) {
      updateFields['journeys.$[journey].treatmentNote'] = treatmentNote;
      if (patient.activeJourneyId === journeyId) {
        updateFields.treatmentNote = treatmentNote;
      }
    }
    if (treatmentType !== undefined) {
      updateFields['journeys.$[journey].treatmentType'] = treatmentType;
      if (patient.activeJourneyId === journeyId) {
        updateFields.interest = treatmentType;
      }
    }

    // 활성 여정으로 설정
    if (setActive === true && patient.activeJourneyId !== journeyId) {
      // 기존 활성 여정 비활성화
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(id), 'journeys.isActive': true },
        { $set: { 'journeys.$[activeJ].isActive': false } },
        { arrayFilters: [{ 'activeJ.isActive': true }] }
      );

      updateFields['journeys.$[journey].isActive'] = true;
      updateFields.activeJourneyId = journeyId;
      updateFields.status = currentJourney.status;
      updateFields.statusChangedAt = now;
      updateFields.estimatedAmount = currentJourney.estimatedAmount;
      updateFields.actualAmount = currentJourney.actualAmount;
      updateFields.paymentStatus = currentJourney.paymentStatus;
      updateFields.paidAt = currentJourney.paidAt ?? null;
      updateFields.treatmentNote = currentJourney.treatmentNote;
      updateFields.interest = currentJourney.treatmentType;
    }

    updateFields.updatedAt = now;

    // 업데이트 실행
    const result = await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { arrayFilters: [{ 'journey.id': journeyId }] }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    console.log(`[Journey] 여정 수정: 환자ID=${id}, journeyId=${journeyId}, fields=${Object.keys(body).join(',')}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating journey:', error);
    return NextResponse.json(
      { error: 'Failed to update journey' },
      { status: 500 }
    );
  }
}

// DELETE: 여정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; journeyId: string }> }
) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 권한 확인 — master/admin만 즉시 삭제 가능 (manager는 삭제 요청 API 사용)
    if (!canDeleteDirectly(auth.user.role)) {
      return NextResponse.json(
        { error: '관리자만 여정을 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    const { id, journeyId } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 현재 환자 정보 조회 (clinic 범위)
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id),
      clinicId: auth.user.clinicId,
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // 여정 삭제 (공용 로직)
    const result = await performJourneyDeletion(db, id, journeyId, {
      journeys: patient.journeys,
      activeJourneyId: patient.activeJourneyId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    }

    // 활동 로그 (환자명 마스킹)
    const auditUser = extractUserFromRequest(request);
    logAudit(
      request,
      'journey.delete',
      'patients_v2',
      id,
      [
        { field: 'action', oldValue: null, newValue: 'journey_delete' },
        { field: 'journeyId', oldValue: null, newValue: journeyId },
      ],
      { documentName: maskPatientName(patient.name), user: auditUser }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting journey:', error);
    return NextResponse.json(
      { error: 'Failed to delete journey' },
      { status: 500 }
    );
  }
}
