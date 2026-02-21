// src/app/api/v2/patients/[id]/journeys/[journeyId]/route.ts
// 개별 여정 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PatientStatus } from '@/types/v2';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { updateJourneySchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

// GET: 특정 여정 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; journeyId: string }> }
) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id, journeyId } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const patient = await db.collection('patients_v2').findOne(
      { _id: new ObjectId(id), clinicId },
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
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id, journeyId } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const body = await request.json();
    const validation = validateBody(updateJourneySchema, body);
    if (!validation.success) return validation.response;
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
    } = validation.data;

    const { db } = await connectToDatabase();

    // 현재 환자 정보 조회
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id), clinicId,
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
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { id, journeyId } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 현재 환자 정보 조회
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(id), clinicId,
    });

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // 여정이 1개뿐이면 삭제 불가
    if (!patient.journeys || patient.journeys.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only journey' },
        { status: 400 }
      );
    }

    // 활성 여정 삭제 시 다른 여정을 활성화
    const isActiveJourney = patient.activeJourneyId === journeyId;
    let newActiveJourneyId = patient.activeJourneyId;

    if (isActiveJourney) {
      // 삭제하려는 여정이 아닌 첫 번째 여정을 활성화
      const otherJourney = patient.journeys.find((j: { id: string }) => j.id !== journeyId);
      if (otherJourney) {
        newActiveJourneyId = otherJourney.id;
      }
    }

    // 여정 삭제 및 활성 여정 업데이트
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (isActiveJourney && newActiveJourneyId !== journeyId) {
      const newActiveJourney = patient.journeys.find((j: { id: string }) => j.id === newActiveJourneyId);
      if (newActiveJourney) {
        updateData.activeJourneyId = newActiveJourneyId;
        updateData.status = newActiveJourney.status;
        updateData.estimatedAmount = newActiveJourney.estimatedAmount;
        updateData.actualAmount = newActiveJourney.actualAmount;
        updateData.paymentStatus = newActiveJourney.paymentStatus;
        updateData.interest = newActiveJourney.treatmentType;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: { journeys: { id: journeyId } },
        $set: updateData,
      } as any
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }

    // 새 활성 여정의 isActive를 true로 설정
    if (isActiveJourney && newActiveJourneyId !== journeyId) {
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(id) },
        { $set: { 'journeys.$[journey].isActive': true } },
        { arrayFilters: [{ 'journey.id': newActiveJourneyId }] }
      );
    }

    console.log(`[Journey] 여정 삭제: 환자ID=${id}, journeyId=${journeyId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting journey:', error);
    return NextResponse.json(
      { error: 'Failed to delete journey' },
      { status: 500 }
    );
  }
}
