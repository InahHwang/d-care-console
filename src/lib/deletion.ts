// src/lib/deletion.ts
// 환자/여정 삭제 공용 로직 (DRY)
//
// 즉시 삭제(환자/여정 DELETE 엔드포인트)와 승인 삭제(deletion-requests approve)가
// 동일한 삭제 동작을 사용하도록 핵심 로직을 한 곳에 모은다.
// 권한 검증·사유 검증·활동 로그는 호출부에서 수행한다.

import { ObjectId, Db } from 'mongodb';

// ============================================
// 권한 헬퍼
// ============================================

/** 즉시 삭제 + 요청 승인/거절 권한 (master / admin) */
export function canDeleteDirectly(role: string): boolean {
  return role === 'master' || role === 'admin';
}

/** 삭제 요청 생성 권한 (manager 이상 — staff 제외) */
export function canRequestDeletion(role: string): boolean {
  return role === 'manager' || canDeleteDirectly(role);
}

// ============================================
// 표시용 마스킹
// ============================================

/** 환자명 마스킹 (홍길동 → 홍**) */
export function maskPatientName(name?: string): string {
  if (!name) return 'unknown';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(name.length - 1);
}

// ============================================
// 환자 완전 삭제
// ============================================

export interface PatientDeletionResult {
  deletedCounts: Record<string, number>;
}

/**
 * 환자 + 연관 데이터 6개 컬렉션 완전 삭제 (hard delete).
 * 호출 전 권한·사유·환자 존재 검증을 마쳐야 한다.
 */
export async function performPatientDeletion(
  db: Db,
  patientId: string
): Promise<PatientDeletionResult> {
  const deletedCounts: Record<string, number> = {};

  const collections = [
    { name: 'callLogs_v2', filter: { patientId } },
    { name: 'callbacks_v2', filter: { patientId } },
    { name: 'consultations_v2', filter: { patientId } },
    { name: 'manualConsultations_v2', filter: { patientId } },
    { name: 'channelChats_v2', filter: { patientId } },
    { name: 'recall_messages', filter: { patientId } },
  ];

  for (const col of collections) {
    try {
      const result = await db.collection(col.name).deleteMany(col.filter);
      deletedCounts[col.name] = result.deletedCount;
      if (result.deletedCount > 0) {
        console.log(`[Patient DELETE] ${col.name} 삭제: ${result.deletedCount}건 (환자ID: ${patientId})`);
      }
    } catch (err) {
      console.error(`[Patient DELETE] ${col.name} 삭제 실패:`, err);
    }
  }

  await db.collection('patients_v2').deleteOne({ _id: new ObjectId(patientId) });
  deletedCounts['patients_v2'] = 1;

  return { deletedCounts };
}

// ============================================
// 여정 삭제
// ============================================

interface JourneyLike {
  id: string;
  treatmentType?: string;
  status?: unknown;
  estimatedAmount?: unknown;
  actualAmount?: unknown;
  paymentStatus?: unknown;
  isActive?: boolean;
}

interface PatientWithJourneys {
  journeys?: JourneyLike[];
  activeJourneyId?: string;
}

export interface JourneyDeletionResult {
  ok: boolean;
  error?: string;
  status?: number;
}

/**
 * 여정 1개 삭제 (journeys 배열에서 $pull).
 * - 여정이 1개뿐이면 삭제 불가
 * - 활성 여정 삭제 시 다른 여정을 자동 활성화하고 환자 레벨 필드 복원
 * 호출 전 권한·환자 존재 검증을 마쳐야 한다.
 */
export async function performJourneyDeletion(
  db: Db,
  patientId: string,
  journeyId: string,
  patient: PatientWithJourneys
): Promise<JourneyDeletionResult> {
  if (!patient.journeys || patient.journeys.length <= 1) {
    return { ok: false, error: '마지막 여정은 삭제할 수 없습니다.', status: 400 };
  }

  const targetExists = patient.journeys.some((j) => j.id === journeyId);
  if (!targetExists) {
    return { ok: false, error: '여정을 찾을 수 없습니다.', status: 404 };
  }

  // 활성 여정 삭제 시 다른 여정을 활성화
  const isActiveJourney = patient.activeJourneyId === journeyId;
  let newActiveJourneyId = patient.activeJourneyId;

  if (isActiveJourney) {
    const otherJourney = patient.journeys.find((j) => j.id !== journeyId);
    if (otherJourney) {
      newActiveJourneyId = otherJourney.id;
    }
  }

  // 여정 삭제 및 활성 여정 업데이트
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (isActiveJourney && newActiveJourneyId !== journeyId) {
    const newActiveJourney = patient.journeys.find((j) => j.id === newActiveJourneyId);
    if (newActiveJourney) {
      updateData.activeJourneyId = newActiveJourneyId;
      updateData.status = newActiveJourney.status;
      updateData.estimatedAmount = newActiveJourney.estimatedAmount;
      updateData.actualAmount = newActiveJourney.actualAmount;
      updateData.paymentStatus = newActiveJourney.paymentStatus;
      updateData.interest = newActiveJourney.treatmentType;
    }
  }

  const result = await db.collection('patients_v2').updateOne(
    { _id: new ObjectId(patientId) },
    {
      $pull: { journeys: { id: journeyId } },
      $set: updateData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  );

  if (result.matchedCount === 0) {
    return { ok: false, error: '여정 삭제에 실패했습니다.', status: 500 };
  }

  // 새 활성 여정의 isActive를 true로 설정
  if (isActiveJourney && newActiveJourneyId !== journeyId) {
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      { $set: { 'journeys.$[journey].isActive': true } },
      { arrayFilters: [{ 'journey.id': newActiveJourneyId }] }
    );
  }

  console.log(`[Journey] 여정 삭제: 환자ID=${patientId}, journeyId=${journeyId}`);
  return { ok: true };
}
