// src/app/api/v2/consultations/route.ts
// 상담 결과 관리 API
// 전화상담(phone) / 내원상담(visit) 결과 기록

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { ConsultationV2, ConsultationType, ConsultationStatus, ClosedReason } from '@/types/v2';
import { z } from 'zod';
import { logAudit } from '@/utils/auditLog';

const consultationCreateSchema = z.object({
  patientId: z.string().min(1, 'patientId is required'),
  type: z.enum(['phone', 'visit'], { required_error: 'type is required' }),
  status: z.enum(['agreed', 'disagreed', 'pending', 'no_answer', 'closed'], { required_error: 'status is required' }),
  consultantName: z.string().min(1, 'consultantName is required'),
  treatment: z.string().optional(),
  originalAmount: z.number().optional(),
  discountRate: z.number().optional(),
  discountReason: z.string().optional(),
  disagreeReasons: z.array(z.string()).optional(),
  correctionPlan: z.string().optional(),
  appointmentDate: z.string().optional(),
  callbackDate: z.string().optional(),
  inquiry: z.string().optional(),
  memo: z.string().optional(),
  closedReason: z.string().optional(),
  closedReasonCustom: z.string().optional(),
  callLogId: z.string().optional(),
  manualConsultationId: z.string().optional(),
});

const consultationPatchSchema = z.object({
  id: z.string().min(1, 'id is required'),
  editedBy: z.string().nullish(),
}).passthrough();

// GET - 상담 이력 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const date = searchParams.get('date'); // YYYY-MM-DD (일보고서용)
    const type = searchParams.get('type') as ConsultationType | null;
    const status = searchParams.get('status') as ConsultationStatus | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {};

    // 특정 환자의 상담 이력
    if (patientId) {
      filter.patientId = patientId;
    }

    // 특정 날짜의 상담 (일보고서용)
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      filter.$or = [
        { date: { $gte: startOfDay, $lte: endOfDay } },
        { date: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        { date: { $regex: `^${date}` } }
      ];
    }

    // 상담 유형 필터
    if (type) {
      filter.type = type;
    }

    // 상담 결과 필터
    if (status) {
      filter.status = status;
    }

    const consultations = await db.collection<ConsultationV2>('consultations_v2')
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: 'patients_v2',
            let: { patientId: { $toObjectId: '$patientId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$patientId'] } } },
              { $project: { name: 1, phone: 1, gender: 1, age: 1, interest: 1, temperature: 1, status: 1 } }
            ],
            as: 'patient'
          }
        },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } }
      ])
      .toArray();

    const totalCount = await db.collection('consultations_v2').countDocuments(filter);

    return NextResponse.json({
      success: true,
      data: {
        consultations: consultations.map(c => ({
          id: c._id?.toString(),
          patientId: c.patientId,
          patientName: c.patient?.name || '알 수 없음',
          patientPhone: c.patient?.phone || '',
          patientGender: c.patient?.gender,
          patientAge: c.patient?.age,
          type: c.type,
          status: c.status,
          treatment: c.treatment,
          originalAmount: c.originalAmount,
          discountRate: c.discountRate,
          discountAmount: c.discountAmount,
          finalAmount: c.finalAmount,
          discountReason: c.discountReason,
          disagreeReasons: c.disagreeReasons || [],
          correctionPlan: c.correctionPlan,
          appointmentDate: c.appointmentDate,
          callbackDate: c.callbackDate,
          consultantName: c.consultantName,
          inquiry: c.inquiry,
          memo: c.memo,
          closedReason: c.closedReason,
          closedReasonCustom: c.closedReasonCustom,
          aiSummary: c.aiSummary,
          aiGenerated: c.aiGenerated,        // AI 자동 생성 여부
          callLogId: c.callLogId,            // 연결된 통화 기록 ID
          manualConsultationId: c.manualConsultationId, // 연결된 수동 상담 ID
          editedAt: c.editedAt,              // 수정 시간
          editedBy: c.editedBy,              // 수정한 상담사
          date: c.date,
          createdAt: c.createdAt,
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Consultations API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 상담 결과 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = consultationCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      patientId,
      type,
      status,
      consultantName,
      treatment,
      originalAmount,
      discountRate,
      discountReason,
      disagreeReasons,
      correctionPlan,
      appointmentDate,
      callbackDate,
      inquiry,
      memo,
      closedReason,
      closedReasonCustom,
      callLogId,
      manualConsultationId,
    } = parsed.data;

    const { db } = await connectToDatabase();
    const now = new Date();
    const nowISO = now.toISOString();

    // 금액 계산
    const amount = originalAmount || 0;
    const discount = discountRate || 0;
    const discountAmount = Math.round(amount * (discount / 100));
    const finalAmount = status === 'agreed' ? amount - discountAmount : 0;

    // 상담 기록 생성
    const newConsultation: Omit<ConsultationV2, '_id'> = {
      patientId,
      callLogId: callLogId || undefined,
      manualConsultationId: manualConsultationId || undefined,
      type: type as ConsultationType,
      status: status as ConsultationStatus,
      date: now,
      treatment: treatment || '',
      originalAmount: amount,
      discountRate: discount,
      discountAmount,
      finalAmount,
      discountReason: discountReason || undefined,
      disagreeReasons: status === 'disagreed' ? disagreeReasons : undefined,
      correctionPlan: status === 'disagreed' ? correctionPlan : undefined,
      appointmentDate: status === 'agreed' && appointmentDate ? new Date(appointmentDate) : undefined,
      callbackDate: (status === 'disagreed' || status === 'pending' || status === 'no_answer') && callbackDate
        ? new Date(callbackDate) : undefined,
      consultantName,
      inquiry: inquiry || undefined,
      memo: memo || undefined,
      closedReason: status === 'closed' ? closedReason as ClosedReason : undefined,
      closedReasonCustom: status === 'closed' && closedReason === '기타' ? closedReasonCustom : undefined,
      createdAt: nowISO,
    };

    const result = await db.collection('consultations_v2').insertOne(newConsultation);

    // 환자 상태 업데이트
    const currentPatientForStatus = await db.collection('patients_v2').findOne(
      { _id: new ObjectId(patientId) },
      { projection: { status: 1, activeJourneyId: 1, name: 1 } }
    );

    // 감사 로그
    logAudit(request, 'consultation.create', 'consultations_v2', result.insertedId.toString(), [
      { field: 'patientId', oldValue: null, newValue: patientId },
      { field: 'status', oldValue: null, newValue: status },
      { field: 'treatment', oldValue: null, newValue: treatment || '' },
      { field: 'finalAmount', oldValue: null, newValue: finalAmount },
    ], { documentName: currentPatientForStatus?.name || patientId, changedBy: consultantName });
    const patientUpdate: Record<string, unknown> = {
      updatedAt: nowISO,
    };

    // 동의 시: 상태 변경 + 예약일 설정
    if (status === 'agreed') {
      // 전화상담 동의 → reserved (내원예약)
      // 내원상담 동의 → treatmentBooked (치료예약)
      const newStatus = type === 'phone' ? 'reserved' : 'treatmentBooked';

      // 상태 진행도 순서 — 이미 더 진행된 상태면 되돌리지 않음
      const STATUS_ORDER: Record<string, number> = {
        consulting: 0, reserved: 1, visited: 2, treatmentBooked: 3,
        treatment: 4, completed: 5, followup: 6, closed: 7,
      };
      const currentOrder = STATUS_ORDER[currentPatientForStatus?.status || 'consulting'] ?? 0;
      const newOrder = STATUS_ORDER[newStatus] ?? 0;

      if (newOrder > currentOrder) {
        patientUpdate.status = newStatus;
        patientUpdate.statusChangedAt = nowISO;

        // statusHistory 기록
        const statusHistoryEntry = {
          from: currentPatientForStatus?.status || 'consulting',
          to: newStatus,
          eventDate: appointmentDate ? new Date(appointmentDate) : now,
          changedAt: now,
          changedBy: consultantName,
        };
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          { $push: { statusHistory: statusHistoryEntry } as any }
        );

        // 여정 상태 동기화
        if (currentPatientForStatus?.activeJourneyId) {
          await db.collection('patients_v2').updateOne(
            { _id: new ObjectId(patientId) },
            { $set: {
              'journeys.$[journey].status': newStatus,
              'journeys.$[journey].updatedAt': now,
            } },
            { arrayFilters: [{ 'journey.id': currentPatientForStatus.activeJourneyId }] }
          );
          await db.collection('patients_v2').updateOne(
            { _id: new ObjectId(patientId) },
            { $push: { 'journeys.$[journey].statusHistory': statusHistoryEntry } as any },
            { arrayFilters: [{ 'journey.id': currentPatientForStatus.activeJourneyId }] }
          );
        }
      }

      if (appointmentDate) {
        patientUpdate.nextAction = type === 'phone' ? '내원예약' : '치료예약';
        patientUpdate.nextActionDate = appointmentDate;
      }

      // 금액 정보 업데이트
      if (amount > 0) {
        patientUpdate.estimatedAmount = amount;
      }
    }

    // 종결 시: 환자 status를 'closed'로 변경 + statusHistory에 기록 + 여정 업데이트
    if (status === 'closed') {
      const currentPatient = await db.collection('patients_v2').findOne(
        { _id: new ObjectId(patientId) }
      );

      patientUpdate.status = 'closed';
      patientUpdate.statusChangedAt = nowISO;
      patientUpdate.closedReason = closedReason || undefined;
      patientUpdate.closedReasonDetail = closedReason === '기타' ? closedReasonCustom : undefined;
      // 종결 시 다음 일정 초기화
      patientUpdate.nextAction = null;
      patientUpdate.nextActionDate = null;

      // statusHistory에 종결 이력 추가 (기존 종결 버튼과 동일 구조)
      const closedHistoryEntry = {
        from: currentPatient?.status || 'consulting',
        to: 'closed',
        eventDate: nowISO,
        changedAt: nowISO,
        changedBy: consultantName,
        reason: closedReason,
        customReason: closedReason === '기타' ? closedReasonCustom : undefined,
      };

      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(patientId) },
        { $push: { statusHistory: closedHistoryEntry } as any }
      );

      // 활성 여정(Journey)의 상태도 함께 종결 처리 (종결 버튼과 동일하게)
      if (currentPatient?.activeJourneyId) {
        // 여정 status, closedAt, nextActionDate 업데이트
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          { $set: {
            'journeys.$[journey].status': 'closed',
            'journeys.$[journey].closedAt': now,
            'journeys.$[journey].nextActionDate': null,
            'journeys.$[journey].updatedAt': now,
          } },
          { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
        );

        // 여정 statusHistory에도 종결 이력 push
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          { $push: { 'journeys.$[journey].statusHistory': closedHistoryEntry } } as any,
          { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
        );

        console.log(`[Consultations] 여정 종결 동기화: journeyId=${currentPatient.activeJourneyId}`);
      }
    }

    // 🆕 내원상담인 경우: 상담이력(manualConsultations_v2)에 자동 등록
    if (type === 'visit') {
      // 결과 라벨 생성
      const statusLabel = status === 'agreed' ? '동의'
        : status === 'disagreed' ? '미동의'
        : status === 'pending' ? '보류'
        : status === 'closed' ? '종결'
        : status;

      // 상담 내용 생성 (미동의사유 + 콜백일자 + 상담내용)
      const contentParts: string[] = [];

      // 미동의 사유
      if (status === 'disagreed' && disagreeReasons && disagreeReasons.length > 0) {
        contentParts.push(`미동의 사유: ${disagreeReasons.join(', ')}`);
      }

      // 다음 콜백일자
      if (callbackDate) {
        const callbackDateObj = new Date(callbackDate);
        const formattedDate = `${callbackDateObj.getMonth() + 1}/${callbackDateObj.getDate()}`;
        contentParts.push(`다음 연락: ${formattedDate}`);
      }

      // 상담 내용 (기존 memo)
      if (memo) {
        contentParts.push(memo);
      }

      const consultationContent = contentParts.join('\n') || statusLabel;

      // manualConsultations_v2에 저장
      const manualResult = await db.collection('manualConsultations_v2').insertOne({
        patientId,
        type: 'visit',  // 내원상담
        date: now,
        content: consultationContent,
        consultantName: consultantName || '미지정',
        status,  // 결과 상태 저장 (동의/미동의/보류)
        disagreeReasons: status === 'disagreed' ? disagreeReasons : undefined,
        callbackDate: callbackDate ? new Date(callbackDate) : undefined,
        source: 'consultation_result',  // 상담결과 입력에서 자동 생성됨
        createdAt: now,
        updatedAt: now,
      });

      // 상담 결과 ↔ 수동상담 서로 연결 (수정/삭제 버튼 표시용)
      await db.collection('consultations_v2').updateOne(
        { _id: result.insertedId },
        { $set: { manualConsultationId: manualResult.insertedId.toString() } }
      );

      console.log(`[내원상담] 상담이력 자동 등록 및 연결: 환자ID=${patientId}, 결과=${statusLabel}`);
    }

    // 미동의/보류/부재중 시: 콜백 설정 및 콜백 이력 기록 (전화상담 + 내원상담 모두)
    if ((status === 'disagreed' || status === 'pending' || status === 'no_answer') && callbackDate) {
      const currentPatient = await db.collection('patients_v2').findOne(
        { _id: new ObjectId(patientId) }
      );

      // 콜백 이력에 기록할 노트 생성
      const callbackNote = status === 'no_answer'
        ? '부재중 - 통화 연결 안 됨'
        : status === 'disagreed'
          ? `미동의: ${(disagreeReasons || []).join(', ') || '사유 미입력'}`
          : '보류 - 재상담 필요';

      // 메모가 있으면 추가
      const fullNote = memo ? `${callbackNote}\n메모: ${memo}` : callbackNote;

      // 콜백 이력 엔트리 생성 (상담 결과 입력 시 항상 기록)
      const callbackHistoryEntry = {
        scheduledAt: new Date(callbackDate),  // 다음 콜백 예정일
        reason: status === 'no_answer' ? 'no_answer'
              : status === 'disagreed' ? 'disagreed'
              : 'postponed',
        note: fullNote,
        consultantName,  // 상담사 이름 추가
        createdAt: now,
      };

      // 환자 레벨의 callbackHistory에 추가 (첫 상담이든 아니든 항상)
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(patientId) },
        { $push: { callbackHistory: callbackHistoryEntry } as any }
      );

      // 활성 여정의 callbackHistory에도 추가
      if (currentPatient?.activeJourneyId) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          { $push: { 'journeys.$[journey].callbackHistory': callbackHistoryEntry } as any },
          { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
        );
      }

      patientUpdate.nextAction = '콜백';
      patientUpdate.nextActionDate = callbackDate;

      // 활성 여정의 nextActionDate도 동기화
      if (currentPatient?.activeJourneyId) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          { $set: {
            'journeys.$[journey].nextActionDate': callbackDate,
            'journeys.$[journey].nextActionNote': fullNote,
          } },
          { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
        );
      }

      // callbacks_v2에도 추가
      await db.collection('callbacks_v2').insertOne({
        patientId,
        type: 'callback',
        scheduledAt: new Date(callbackDate),
        status: 'pending',
        note: fullNote,
        createdAt: nowISO,
      });
    }

    // 환자 정보 업데이트
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      { $set: patientUpdate }
    );

    // ★ 종결 제외, 상담내용 있는 환자 → AI 코칭 자동 생성 (fire-and-forget)
    // 동의: 내원 상담 전략 / 미동의·보류·부재중: 콜백 전략
    if (
      status !== 'closed' &&
      callLogId
    ) {
      // 환자가 오늘 등록된 신환인지 확인
      const patient = await db.collection('patients_v2').findOne(
        { _id: new ObjectId(patientId) },
        { projection: { createdAt: 1 } }
      );
      if (patient?.createdAt) {
        const kstOffset = 9 * 60 * 60 * 1000;
        const createdKST = new Date(new Date(patient.createdAt).getTime() + kstOffset);
        const todayKST = new Date(Date.now() + kstOffset);
        const isToday = createdKST.getUTCFullYear() === todayKST.getUTCFullYear()
          && createdKST.getUTCMonth() === todayKST.getUTCMonth()
          && createdKST.getUTCDate() === todayKST.getUTCDate();

        if (isToday) {
          // callLog에 transcript가 있고, 아직 코칭이 없는 경우에만 생성
          const callLog = await db.collection('callLogs_v2').findOne(
            { _id: new ObjectId(callLogId) },
            { projection: { 'aiAnalysis.transcript': 1, aiCoaching: 1 } }
          );
          if (callLog?.aiAnalysis?.transcript && !callLog.aiCoaching) {
            // fire-and-forget: 코칭 API를 내부 호출 (응답 기다리지 않음)
            const baseUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : process.env.NEXTAUTH_URL || 'http://localhost:3000';
            fetch(`${baseUrl}/api/v2/call-analysis/coaching`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callLogId }),
            }).catch((err) => {
              console.error('[Consultations] 자동 코칭 트리거 실패:', err);
            });
            console.log(`[Consultations] 자동 AI 코칭 트리거: callLogId=${callLogId}, patientId=${patientId}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newConsultation,
      },
    });
  } catch (error) {
    console.error('[Consultations API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 상담 결과 수정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = consultationPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id, editedBy, ...updateData } = body as Record<string, any>;

    const { db } = await connectToDatabase();
    const now = new Date();
    const nowISO = now.toISOString();

    // 기존 데이터 조회 (금액 재계산 및 수정 추적용)
    const existing = await db.collection('consultations_v2').findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Consultation not found' },
        { status: 404 }
      );
    }

    // 금액 재계산 (필요시)
    if (updateData.originalAmount !== undefined || updateData.discountRate !== undefined) {
      const amount = updateData.originalAmount ?? existing.originalAmount;
      const discount = updateData.discountRate ?? existing.discountRate;
      updateData.discountAmount = Math.round(amount * (discount / 100));
      updateData.finalAmount = (updateData.status ?? existing.status) === 'agreed'
        ? amount - updateData.discountAmount
        : 0;
    }

    const updateFields: Record<string, unknown> = {
      ...updateData,
      updatedAt: nowISO,
    };

    const result = await db.collection('consultations_v2').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    // 환자 정보 업데이트 (상태 및 예정일 연동)
    const patientId = existing.patientId;
    if (patientId) {
      const finalStatus = updateData.status ?? existing.status;
      const patientUpdate: Record<string, unknown> = {
        updatedAt: nowISO,
      };

      // 동의로 변경된 경우: 상태 변경 + 예약일 설정
      if (finalStatus === 'agreed') {
        const consultationType = existing.type;
        const newPatientStatus = consultationType === 'phone' ? 'reserved' : 'treatmentBooked';

        // 현재 환자 상태 조회
        const currentPatientForStatus = await db.collection('patients_v2').findOne(
          { _id: new ObjectId(patientId) },
          { projection: { status: 1, activeJourneyId: 1 } }
        );

        // 상태 진행도 순서 — 이미 더 진행된 상태면 되돌리지 않음
        const STATUS_ORDER: Record<string, number> = {
          consulting: 0, reserved: 1, visited: 2, treatmentBooked: 3,
          treatment: 4, completed: 5, followup: 6, closed: 7,
        };
        const currentOrder = STATUS_ORDER[currentPatientForStatus?.status || 'consulting'] ?? 0;
        const newOrder = STATUS_ORDER[newPatientStatus] ?? 0;

        const appointmentDate = updateData.appointmentDate ?? existing.appointmentDate;

        if (newOrder > currentOrder) {
          patientUpdate.status = newPatientStatus;
          patientUpdate.statusChangedAt = nowISO;

          // statusHistory 기록
          const statusHistoryEntry = {
            from: currentPatientForStatus?.status || 'consulting',
            to: newPatientStatus,
            eventDate: appointmentDate ? new Date(appointmentDate) : now,
            changedAt: now,
            changedBy: existing.consultantName,
          };
          await db.collection('patients_v2').updateOne(
            { _id: new ObjectId(patientId) },
            { $push: { statusHistory: statusHistoryEntry } as any }
          );

          // 여정 상태 동기화
          if (currentPatientForStatus?.activeJourneyId) {
            await db.collection('patients_v2').updateOne(
              { _id: new ObjectId(patientId) },
              { $set: {
                'journeys.$[journey].status': newPatientStatus,
                'journeys.$[journey].updatedAt': now,
              } },
              { arrayFilters: [{ 'journey.id': currentPatientForStatus.activeJourneyId }] }
            );
            await db.collection('patients_v2').updateOne(
              { _id: new ObjectId(patientId) },
              { $push: { 'journeys.$[journey].statusHistory': statusHistoryEntry } as any },
              { arrayFilters: [{ 'journey.id': currentPatientForStatus.activeJourneyId }] }
            );
          }
        }

        if (appointmentDate) {
          patientUpdate.nextAction = consultationType === 'phone' ? '내원예약' : '치료예약';
          patientUpdate.nextActionDate = appointmentDate;
        }

        // 금액 정보 업데이트
        const amount = updateData.originalAmount ?? existing.originalAmount;
        if (amount > 0) {
          patientUpdate.estimatedAmount = amount;
        }
      }

      // 미동의/보류/부재중으로 변경된 경우: 콜백 설정
      if (finalStatus === 'disagreed' || finalStatus === 'pending' || finalStatus === 'no_answer') {
        const callbackDate = updateData.callbackDate ?? existing.callbackDate;
        if (callbackDate) {
          patientUpdate.nextAction = '콜백';
          patientUpdate.nextActionDate = callbackDate;
        }
      }

      // 환자 정보 업데이트 실행
      if (Object.keys(patientUpdate).length > 1) { // updatedAt 외에 다른 필드가 있으면
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(patientId) },
          { $set: patientUpdate }
        );

        // 활성 여정의 nextActionDate도 동기화
        if (patientUpdate.nextActionDate) {
          const currentPatient = await db.collection('patients_v2').findOne(
            { _id: new ObjectId(patientId) },
            { projection: { activeJourneyId: 1 } }
          );
          if (currentPatient?.activeJourneyId) {
            await db.collection('patients_v2').updateOne(
              { _id: new ObjectId(patientId) },
              { $set: {
                'journeys.$[journey].nextActionDate': patientUpdate.nextActionDate,
                'journeys.$[journey].nextActionNote': patientUpdate.nextAction || '콜백',
              } },
              { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Consultations API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 상담 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('consultations_v2').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Consultation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Consultation deleted',
    });
  } catch (error) {
    console.error('[Consultations API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
