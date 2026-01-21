// src/app/api/v2/patients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PatientStatus, Temperature, CallbackReason, CallbackHistoryEntry } from '@/types/v2';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 환자 정보와 통화 이력을 병렬로 조회
    const [patient, callLogs] = await Promise.all([
      db.collection('patients_v2').findOne({ _id: new ObjectId(id) }),
      db.collection('callLogs_v2')
        .find({ patientId: id })
        .sort({ startedAt: -1 })
        .limit(10)
        .project({
          _id: 1,
          startedAt: 1,
          direction: 1,
          duration: 1,
          'aiAnalysis.summary': 1,
          'aiAnalysis.classification': 1,
          callbackType: 1,
          callbackId: 1,
        })
        .toArray(),
    ]);

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        phone: patient.phone,
        status: patient.status,
        consultationType: patient.consultationType || '',
        temperature: patient.temperature,
        interest: patient.aiAnalysis?.interest || patient.interest || '',
        source: patient.source || '',
        summary: patient.aiAnalysis?.summary || '',
        classification: patient.aiAnalysis?.classification || '',
        followUp: patient.aiAnalysis?.followUp || '',
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
        lastContactAt: patient.lastContactAt,
        statusChangedAt: patient.statusChangedAt,
        nextAction: patient.nextAction || '',
        nextActionDate: patient.nextActionDate,
        callbackHistory: patient.callbackHistory || [],
        callCount: patient.callCount || 0,
        memo: patient.memo || '',
        tags: patient.tags || [],
        statusHistory: patient.statusHistory || [],
        age: patient.age || undefined,
        region: patient.region || undefined,
        // 금액 관련 필드 (정수로 변환하여 부동소수점 오차 방지)
        estimatedAmount: patient.estimatedAmount ? Math.round(Number(patient.estimatedAmount)) : 0,
        actualAmount: patient.actualAmount ? Math.round(Number(patient.actualAmount)) : 0,
        paymentStatus: patient.paymentStatus || 'none',
        treatmentNote: patient.treatmentNote || '',
        // 치료 진행 관련 필드
        treatmentStartDate: patient.treatmentStartDate || null,
        expectedCompletionDate: patient.expectedCompletionDate || null,
        // 여정(Journey) 관련 필드
        journeys: patient.journeys || [],
        activeJourneyId: patient.activeJourneyId || null,
      },
      callLogs: callLogs.map((log) => ({
        id: log._id.toString(),
        callTime: log.startedAt,
        callType: log.direction,
        duration: log.duration || 0,
        summary: log.aiAnalysis?.summary || '',
        classification: log.aiAnalysis?.classification || '',
        callbackType: log.callbackType || null,
        callbackId: log.callbackId || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patient' },
      { status: 500 }
    );
  }
}

// 상태별 라벨 (히스토리용)
const STATUS_LABELS: Record<PatientStatus, string> = {
  consulting: '전화상담',
  reserved: '내원예약',
  visited: '내원완료',
  treatmentBooked: '치료예약',
  treatment: '치료중',
  completed: '치료완료',
  followup: '사후관리',
  closed: '종결',
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name, phone, status, temperature, interest, source, memo,
      nextAction, nextActionDate, tags,
      eventDate, isReservation, changedBy,
      age, region,
      closedReason, isReactivation,
      // 금액 관련 필드
      estimatedAmount, actualAmount, paymentStatus, treatmentNote,
      // 치료 진행 관련 필드
      treatmentStartDate, expectedCompletionDate,
      // 🆕 예정일 변경 관련 필드
      updateType,          // 'status' | 'schedule' - schedule이면 예정일만 변경
      callbackReason,      // 콜백 사유: 'no_answer' | 'postponed' | 'considering'
      callbackNote,        // 콜백 메모
      newScheduleDate,     // 새 예정일 (updateType === 'schedule'일 때)
    } = body;

    const { db } = await connectToDatabase();

    // 현재 환자 정보 조회 (상태 변경 감지용)
    const currentPatient = await db.collection('patients_v2').findOne({ _id: new ObjectId(id) });

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // statusHistory에 추가할 항목
    let statusHistoryEntry = null;

    // 콜백 이력에 추가할 항목
    let callbackHistoryEntry: CallbackHistoryEntry | null = null;

    // 🆕 예정일만 변경하는 경우 (updateType === 'schedule')
    if (updateType === 'schedule' && newScheduleDate !== undefined) {
      // 이전 예정일을 콜백 이력에 저장
      if (currentPatient?.nextActionDate) {
        callbackHistoryEntry = {
          scheduledAt: currentPatient.nextActionDate,
          reason: callbackReason as CallbackReason || undefined,
          note: callbackNote || undefined,
          createdAt: new Date(),
        };
      }

      // 새 예정일 설정
      updateData.nextActionDate = newScheduleDate ? new Date(newScheduleDate) : null;
      // 🆕 현재 예정일에 대한 메모도 저장
      updateData.nextActionNote = callbackNote || null;

      // 활성 여정에도 예정일 업데이트
      if (currentPatient?.activeJourneyId) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              'journeys.$[journey].nextActionDate': newScheduleDate ? new Date(newScheduleDate) : null,
              'journeys.$[journey].nextActionNote': callbackNote || null,
              'journeys.$[journey].updatedAt': new Date(),
            }
          },
          { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
        );

        // 여정에도 콜백 이력 추가
        if (callbackHistoryEntry) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await db.collection('patients_v2').updateOne(
            { _id: new ObjectId(id) },
            { $push: { 'journeys.$[journey].callbackHistory': callbackHistoryEntry } } as any,
            { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
          );
        }
      }

      console.log(`[Patient PATCH] 예정일 변경: ${currentPatient?.nextActionDate} → ${newScheduleDate}, 사유: ${callbackReason || '없음'}`);
    }

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (status !== undefined) {
      updateData.status = status as PatientStatus;
      // 상태가 변경되면 statusChangedAt 업데이트 및 히스토리 기록
      if (currentPatient && currentPatient.status !== status) {
        updateData.statusChangedAt = new Date();

        // statusHistory 항목 생성
        statusHistoryEntry = {
          from: currentPatient.status,
          to: status,
          eventDate: eventDate ? new Date(eventDate) : new Date(),
          changedAt: new Date(),
          changedBy: changedBy || undefined,
          // 종결인 경우 사유 추가
          ...(status === 'closed' && closedReason ? { reason: closedReason } : {}),
        };

        // 상태별 다음 일정 처리
        // 🆕 백엔드에서 상태 자체를 체크 (프론트 플래그에 의존하지 않음)
        const RESERVATION_STATUSES = ['reserved', 'treatmentBooked'];
        const isReservationStatus = RESERVATION_STATUSES.includes(status);

        if (status === 'closed') {
          // 종결: 다음 일정 초기화
          updateData.nextAction = null;
          updateData.nextActionDate = null;
        } else if (isReactivation) {
          // 재활성화: 다음 일정은 그대로 두거나 초기화
          updateData.nextAction = null;
          updateData.nextActionDate = null;
        } else if (isReservationStatus || isReservation) {
          // 예약 상태 (reserved, treatmentBooked): 다음 일정 설정
          updateData.nextAction = STATUS_LABELS[status as PatientStatus] || status;
          updateData.nextActionDate = eventDate ? new Date(eventDate) : null;
        } else {
          // 완료/진행 상태 (visited, treatment, completed, followup, consulting): 다음 일정 초기화
          // → 상태가 앞으로 진행되면 기존 예정일 자동 클리어
          updateData.nextAction = null;
          updateData.nextActionDate = null;
        }

        // 치료중으로 변경 시 treatmentStartDate 자동 설정
        if (status === 'treatment') {
          updateData.treatmentStartDate = eventDate ? new Date(eventDate) : new Date();
        }
      }
    }

    // 일반 수정 (상태 변경이 아닌 경우에만)
    if (status === undefined || (currentPatient && currentPatient.status === status)) {
      if (nextAction !== undefined) updateData.nextAction = nextAction;
      if (nextActionDate !== undefined) updateData.nextActionDate = nextActionDate ? new Date(nextActionDate) : null;
    }

    if (temperature !== undefined) updateData.temperature = temperature as Temperature;
    if (interest !== undefined) updateData['aiAnalysis.interest'] = interest;
    if (source !== undefined) updateData.source = source;
    if (memo !== undefined) updateData.memo = memo;
    if (tags !== undefined) updateData.tags = tags;
    if (age !== undefined) updateData.age = age;
    if (region !== undefined) updateData.region = region;

    // 금액 관련 필드 (정수로 저장하여 부동소수점 오차 방지)
    if (estimatedAmount !== undefined) updateData.estimatedAmount = Math.round(Number(estimatedAmount));
    if (actualAmount !== undefined) updateData.actualAmount = Math.round(Number(actualAmount));
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (treatmentNote !== undefined) updateData.treatmentNote = treatmentNote;

    // 치료 진행 관련 필드
    if (treatmentStartDate !== undefined) {
      updateData.treatmentStartDate = treatmentStartDate ? new Date(treatmentStartDate) : null;
    }
    if (expectedCompletionDate !== undefined) {
      updateData.expectedCompletionDate = expectedCompletionDate ? new Date(expectedCompletionDate) : null;
    }

    // 업데이트 쿼리 준비
    const updateQuery: Record<string, unknown> = { $set: updateData };

    // statusHistory, callbackHistory push 처리
    const pushOps: Record<string, unknown> = {};
    if (statusHistoryEntry) {
      pushOps.statusHistory = statusHistoryEntry;
    }
    if (callbackHistoryEntry) {
      pushOps.callbackHistory = callbackHistoryEntry;
    }
    if (Object.keys(pushOps).length > 0) {
      updateQuery.$push = pushOps;
    }

    const result = await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(id) },
      updateQuery
    );

    // 🆕 활성 여정(Journey)의 금액/결제 정보도 함께 업데이트
    if (currentPatient?.activeJourneyId) {
      const journeyDataUpdate: Record<string, unknown> = {
        'journeys.$[journey].updatedAt': new Date(),
      };
      let hasJourneyUpdate = false;

      if (estimatedAmount !== undefined) {
        journeyDataUpdate['journeys.$[journey].estimatedAmount'] = Math.round(Number(estimatedAmount));
        hasJourneyUpdate = true;
      }
      if (actualAmount !== undefined) {
        journeyDataUpdate['journeys.$[journey].actualAmount'] = Math.round(Number(actualAmount));
        hasJourneyUpdate = true;
      }
      if (paymentStatus !== undefined) {
        journeyDataUpdate['journeys.$[journey].paymentStatus'] = paymentStatus;
        hasJourneyUpdate = true;
      }
      if (treatmentNote !== undefined) {
        journeyDataUpdate['journeys.$[journey].treatmentNote'] = treatmentNote;
        hasJourneyUpdate = true;
      }

      if (hasJourneyUpdate) {
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(id) },
          { $set: journeyDataUpdate },
          { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
        );
        console.log(`[Patient PATCH] 여정 금액 동기화: journeyId=${currentPatient.activeJourneyId}`);
      }
    }

    // 🆕 활성 여정(Journey)의 상태도 함께 업데이트
    if (statusHistoryEntry && currentPatient?.activeJourneyId) {
      const journeyUpdate: Record<string, unknown> = {
        'journeys.$[journey].status': status,
        'journeys.$[journey].updatedAt': new Date(),
      };

      // 종결 상태면 closedAt 설정
      if (status === 'closed' || status === 'completed') {
        journeyUpdate['journeys.$[journey].closedAt'] = eventDate ? new Date(eventDate) : new Date();
      }

      // 🆕 여정의 nextActionDate도 환자 레벨과 동기화
      // 예약 상태면 eventDate로 설정, 아니면 클리어
      const RESERVATION_STATUSES = ['reserved', 'treatmentBooked'];
      const isReservationStatus = RESERVATION_STATUSES.includes(status);
      if (isReservationStatus) {
        journeyUpdate['journeys.$[journey].nextActionDate'] = eventDate ? new Date(eventDate) : null;
      } else {
        journeyUpdate['journeys.$[journey].nextActionDate'] = null;
      }

      // 여정 status 업데이트
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(id) },
        { $set: journeyUpdate },
        { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
      );

      // 여정 statusHistory도 push
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.collection('patients_v2').updateOne(
        { _id: new ObjectId(id) },
        { $push: { 'journeys.$[journey].statusHistory': statusHistoryEntry } } as any,
        { arrayFilters: [{ 'journey.id': currentPatient.activeJourneyId }] }
      );

      console.log(`[Patient PATCH] 여정 상태 동기화: journeyId=${currentPatient.activeJourneyId}, status=${status}`);
    }

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // 치료완료(completed)로 상태 변경 시 리콜 메시지 자동 생성
    if (status === 'completed' && currentPatient && currentPatient.status !== 'completed') {
      try {
        // 환자의 관심 시술(치료 종류) 가져오기
        const treatment = currentPatient.aiAnalysis?.interest || currentPatient.interest || '';

        if (treatment) {
          // 리콜 메시지 생성 API 호출 (내부 함수 직접 호출)
          const recallSetting = await db.collection('recall_settings').findOne({ treatment });

          if (recallSetting && recallSetting.schedules) {
            const enabledSchedules = recallSetting.schedules.filter((s: { enabled: boolean }) => s.enabled);
            const baseDate = eventDate ? new Date(eventDate) : new Date();
            const now = new Date();

            // 중복 체크
            const existingMessages = await db.collection('recall_messages').find({
              patientId: id,
              treatment: treatment,
              status: 'pending',
            }).toArray();
            const existingTimings = new Set(existingMessages.map(m => m.timing));

            const messagesToInsert = enabledSchedules
              .filter((schedule: { timing: string }) => !existingTimings.has(schedule.timing))
              .map((schedule: { timing: string; timingDays: number; message: string }) => {
                const scheduledAt = new Date(baseDate);
                scheduledAt.setDate(scheduledAt.getDate() + schedule.timingDays);
                scheduledAt.setHours(10, 0, 0, 0);

                const personalizedMessage = schedule.message
                  .replace(/\{환자명\}/g, currentPatient.name || '고객')
                  .replace(/\{이름\}/g, currentPatient.name || '고객');

                return {
                  patientId: id,
                  treatment: treatment,
                  timing: schedule.timing,
                  timingDays: schedule.timingDays,
                  message: personalizedMessage,
                  status: 'pending',
                  scheduledAt: scheduledAt,
                  lastVisit: baseDate,
                  createdAt: now.toISOString(),
                };
              });

            if (messagesToInsert.length > 0) {
              await db.collection('recall_messages').insertMany(messagesToInsert);
              console.log(`[Patient PATCH] 리콜 메시지 ${messagesToInsert.length}개 자동 생성 (환자: ${currentPatient.name}, 치료: ${treatment})`);
            }
          }
        }
      } catch (recallError) {
        console.error('[Patient PATCH] 리콜 메시지 생성 실패:', recallError);
        // 리콜 메시지 생성 실패해도 환자 상태 변경은 성공했으므로 계속 진행
      }
    }

    // 이름이 변경되면 연결된 통화기록의 patientName도 업데이트
    if (name !== undefined && currentPatient) {
      try {
        const phoneQuery = {
          $or: [
            { patientId: id },
            { phone: currentPatient.phone }
          ]
        };

        // aggregation pipeline으로 aiAnalysis가 null이어도 업데이트 가능하게
        const callLogUpdateResult = await db.collection('callLogs_v2').updateMany(
          phoneQuery,
          [
            {
              $set: {
                aiAnalysis: {
                  $mergeObjects: [
                    { $ifNull: ['$aiAnalysis', {}] },
                    { patientName: name }
                  ]
                }
              }
            }
          ]
        );
        console.log(`[Patient PATCH] 통화기록 patientName 업데이트: ${callLogUpdateResult.modifiedCount}건 (환자ID: ${id}, phone: ${currentPatient.phone})`);
      } catch (callLogError) {
        console.error('[Patient PATCH] 통화기록 업데이트 실패:', callLogError);
        // 통화기록 업데이트 실패해도 환자 정보는 성공했으므로 계속 진행
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json(
      { error: 'Failed to update patient' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('patients_v2').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // 연결된 통화기록의 patientId 해제
    try {
      const callLogUpdateResult = await db.collection('callLogs_v2').updateMany(
        { patientId: id },
        { $unset: { patientId: '' } }
      );
      console.log(`[Patient DELETE] 통화기록 patientId 해제: ${callLogUpdateResult.modifiedCount}건 (환자ID: ${id})`);
    } catch (callLogError) {
      console.error('[Patient DELETE] 통화기록 patientId 해제 실패:', callLogError);
      // 통화기록 업데이트 실패해도 환자 삭제는 성공했으므로 계속 진행
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json(
      { error: 'Failed to delete patient' },
      { status: 500 }
    );
  }
}
