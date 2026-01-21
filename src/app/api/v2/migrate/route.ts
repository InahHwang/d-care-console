// src/app/api/v2/migrate/route.ts
// V1 patients → V2 patients_v2 마이그레이션 API
// 운영 중 호출 전까지 아무 동작 안 함

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { Patient, CallbackItem } from '@/types/patient';
import type { PatientV2, PatientStatus, Temperature, CallbackHistoryEntry, Journey, ConsultationV2, ConsultationStatus } from '@/types/v2';

// ============================================
// 상태 매핑 테이블
// ============================================

const STATUS_MAP: Record<string, PatientStatus> = {
  '잠재고객': 'consulting',
  '콜백필요': 'consulting',
  '부재중': 'consulting',
  'VIP': 'consulting',
  '예약확정': 'reserved',
  '재예약확정': 'reserved',
  '종결': 'closed',
};

const POST_VISIT_STATUS_MAP: Record<string, PatientStatus> = {
  '치료동의': 'treatmentBooked',
  '치료시작': 'treatment',
  '재콜백필요': 'visited',
  '종결': 'completed',
};

// ============================================
// 변환 함수들
// ============================================

function mapStatus(v1Patient: Patient): PatientStatus {
  // 1. 내원 후 상태가 있으면 우선
  if (v1Patient.postVisitStatus && POST_VISIT_STATUS_MAP[v1Patient.postVisitStatus]) {
    return POST_VISIT_STATUS_MAP[v1Patient.postVisitStatus];
  }

  // 2. 내원 확정이면 visited
  if (v1Patient.visitConfirmed && v1Patient.visitDate) {
    return 'visited';
  }

  // 3. 기본 상태 매핑
  return STATUS_MAP[v1Patient.status] || 'consulting';
}

function mapTemperature(v1Patient: Patient): Temperature {
  // VIP면 hot
  if (v1Patient.status === 'VIP') {
    return 'hot';
  }

  // 예약확정이면 warm
  if (v1Patient.status === '예약확정' || v1Patient.status === '재예약확정') {
    return 'warm';
  }

  // 종결이면 cold
  if (v1Patient.status === '종결' || v1Patient.isCompleted) {
    return 'cold';
  }

  // 기본값
  return 'warm';
}

function mapRegion(v1Region?: { province: string; city?: string }): string | undefined {
  if (!v1Region) return undefined;

  if (v1Region.city) {
    return `${v1Region.province} ${v1Region.city}`;
  }
  return v1Region.province;
}

function mapCallbackHistory(v1Callbacks?: CallbackItem[]): CallbackHistoryEntry[] {
  if (!v1Callbacks || v1Callbacks.length === 0) return [];

  return v1Callbacks
    .filter(cb => cb.status === '예정' || cb.status === '완료')
    .slice(-5) // 최근 5개만 (V2 구조용)
    .map(cb => ({
      scheduledAt: cb.date,
      reason: cb.status === '부재중' ? 'no_answer' as const : undefined,
      note: cb.notes || cb.resultNotes,
      createdAt: cb.createdAt,
    }));
}

// ============================================
// V1 콜백 이력 → 텍스트 변환 (memo용)
// ============================================

function formatCallbackToText(cb: CallbackItem, index: number): string {
  const lines: string[] = [];

  // 헤더: [1차] 2024-01-10 14:00 | 완료
  const timeStr = cb.time ? ` ${cb.time}` : '';
  lines.push(`[${cb.type}] ${cb.date}${timeStr} | ${cb.status}`);

  // 상담 기록
  if (cb.consultationRecord?.consultationContent) {
    lines.push(`  → 상담: ${cb.consultationRecord.consultationContent}`);
  }

  // 노트
  if (cb.notes) {
    lines.push(`  → 메모: ${cb.notes}`);
  }
  if (cb.resultNotes && cb.resultNotes !== cb.notes) {
    lines.push(`  → 결과: ${cb.resultNotes}`);
  }

  // 첫 상담 결과
  if (cb.firstConsultationResult) {
    const fcr = cb.firstConsultationResult;
    if (fcr.status) {
      lines.push(`  → 첫상담결과: ${fcr.status}`);
    }
    if (fcr.reservationDate) {
      const resTime = fcr.reservationTime ? ` ${fcr.reservationTime}` : '';
      lines.push(`  → 예약: ${fcr.reservationDate}${resTime}`);
    }
    if (fcr.consultationContent) {
      lines.push(`  → 내용: ${fcr.consultationContent}`);
    }
    if (fcr.callbackDate) {
      lines.push(`  → 다음콜백: ${fcr.callbackDate}`);
    }
    if (fcr.terminationReason) {
      lines.push(`  → 종결사유: ${fcr.terminationReason}`);
    }
    if (fcr.postponementReason) {
      const customReason = fcr.postponementReasonCustom ? ` (${fcr.postponementReasonCustom})` : '';
      lines.push(`  → 미룸사유: ${fcr.postponementReason}${customReason}`);
    }
  }

  // 예약 후 결과
  if (cb.postReservationResult) {
    const prr = cb.postReservationResult;
    if (prr.status) {
      lines.push(`  → 예약후결과: ${prr.status}`);
    }
    if (prr.reReservationDate) {
      const resTime = prr.reReservationTime ? ` ${prr.reReservationTime}` : '';
      lines.push(`  → 재예약: ${prr.reReservationDate}${resTime}`);
    }
    if (prr.callbackDate) {
      lines.push(`  → 다음콜백: ${prr.callbackDate}`);
    }
    if (prr.reason) {
      lines.push(`  → 사유: ${prr.reason}`);
    }
    if (prr.terminationReason) {
      lines.push(`  → 종결사유: ${prr.terminationReason}`);
    }
  }

  // 콜백 후속 결과
  if (cb.callbackFollowupResult) {
    const cfr = cb.callbackFollowupResult;
    if (cfr.status) {
      lines.push(`  → 후속결과: ${cfr.status}`);
    }
    if (cfr.reservationDate) {
      const resTime = cfr.reservationTime ? ` ${cfr.reservationTime}` : '';
      lines.push(`  → 예약: ${cfr.reservationDate}${resTime}`);
    }
    if (cfr.nextCallbackDate) {
      lines.push(`  → 다음콜백: ${cfr.nextCallbackDate}`);
    }
    if (cfr.reason) {
      lines.push(`  → 사유: ${cfr.reason}`);
    }
  }

  // 내원관리 콜백인 경우
  if (cb.isVisitManagementCallback && cb.visitManagementReason) {
    lines.push(`  → 내원관리사유: ${cb.visitManagementReason}`);
  }

  return lines.join('\n');
}

function buildMemoFromV1(v1Patient: Patient): string {
  const sections: string[] = [];

  // 1. 기존 메모
  const existingMemo = v1Patient.notes || v1Patient.memo;
  if (existingMemo) {
    sections.push(`[기존 메모]\n${existingMemo}`);
  }

  // 2. 상담 정보 (consultation)
  if (v1Patient.consultation) {
    const c = v1Patient.consultation;
    const consultLines: string[] = ['[상담 정보]'];
    if (c.consultationDate) consultLines.push(`상담일: ${c.consultationDate}`);
    if (c.estimatedAmount) consultLines.push(`견적금액: ${c.estimatedAmount.toLocaleString()}원`);
    if (c.consultationNotes) consultLines.push(`상담메모: ${c.consultationNotes}`);
    if (c.treatmentPlan) consultLines.push(`치료계획: ${c.treatmentPlan}`);
    if (c.selectedTeeth && c.selectedTeeth.length > 0) {
      consultLines.push(`선택치아: ${c.selectedTeeth.join(', ')}`);
    }
    if (c.estimateAgreed !== undefined) {
      consultLines.push(`견적동의: ${c.estimateAgreed ? 'Y' : 'N'}`);
    }
    if (consultLines.length > 1) {
      sections.push(consultLines.join('\n'));
    }
  }

  // 3. 내원 후 상담 정보
  if (v1Patient.postVisitConsultation) {
    const pvc = v1Patient.postVisitConsultation;
    const visitLines: string[] = ['[내원 후 상담]'];
    if (pvc.consultationContent) visitLines.push(`상담내용: ${pvc.consultationContent}`);
    if (pvc.firstVisitConsultationContent) visitLines.push(`첫내원상담: ${pvc.firstVisitConsultationContent}`);
    if (pvc.estimateInfo) {
      const ei = pvc.estimateInfo;
      if (ei.regularPrice) visitLines.push(`정가: ${ei.regularPrice.toLocaleString()}원`);
      if (ei.discountPrice) visitLines.push(`할인가: ${ei.discountPrice.toLocaleString()}원`);
      if (ei.discountEvent) visitLines.push(`할인이벤트: ${ei.discountEvent}`);
      if (ei.patientReaction) visitLines.push(`환자반응: ${ei.patientReaction}`);
    }
    if (pvc.nextCallbackDate) visitLines.push(`다음콜백: ${pvc.nextCallbackDate}`);
    if (pvc.nextConsultationPlan) visitLines.push(`상담계획: ${pvc.nextConsultationPlan}`);
    if (pvc.treatmentContent) visitLines.push(`치료내용: ${pvc.treatmentContent}`);
    if (pvc.completionNotes) visitLines.push(`완료메모: ${pvc.completionNotes}`);
    if (pvc.treatmentConsentInfo) {
      const tci = pvc.treatmentConsentInfo;
      if (tci.treatmentStartDate) visitLines.push(`치료시작예정: ${tci.treatmentStartDate}`);
      if (tci.consentNotes) visitLines.push(`동의메모: ${tci.consentNotes}`);
    }
    if (visitLines.length > 1) {
      sections.push(visitLines.join('\n'));
    }
  }

  // 4. 콜백 이력 (전체)
  if (v1Patient.callbackHistory && v1Patient.callbackHistory.length > 0) {
    const callbackLines: string[] = ['[콜백 이력]'];
    callbackLines.push('━'.repeat(30));

    v1Patient.callbackHistory.forEach((cb, idx) => {
      callbackLines.push(formatCallbackToText(cb, idx));
      if (idx < v1Patient.callbackHistory!.length - 1) {
        callbackLines.push('─'.repeat(30));
      }
    });

    sections.push(callbackLines.join('\n'));
  }

  // 5. 기타 중요 정보
  const etcLines: string[] = [];
  if (v1Patient.visitDate) etcLines.push(`내원일: ${v1Patient.visitDate}`);
  if (v1Patient.reservationDate) {
    const resTime = v1Patient.reservationTime ? ` ${v1Patient.reservationTime}` : '';
    etcLines.push(`예약일: ${v1Patient.reservationDate}${resTime}`);
  }
  if (v1Patient.treatmentStartDate) etcLines.push(`치료시작일: ${v1Patient.treatmentStartDate}`);
  if (v1Patient.completedReason) etcLines.push(`종결사유: ${v1Patient.completedReason}`);
  if (v1Patient.postVisitStatus) etcLines.push(`내원후상태: ${v1Patient.postVisitStatus}`);

  if (etcLines.length > 0) {
    sections.push('[기타 정보]\n' + etcLines.join('\n'));
  }

  // 마이그레이션 표시
  sections.push(`\n─────────────────\n[V1에서 마이그레이션됨: ${new Date().toLocaleDateString('ko-KR')}]`);

  return sections.join('\n\n');
}

// ============================================
// V1 내원상담 → V2 ConsultationV2 변환
// ============================================

function mapPatientReactionToStatus(reaction?: string): ConsultationStatus {
  if (!reaction) return 'pending';

  switch (reaction) {
    case '동의해요(적당)':
    case '생각보다 저렴해요':
      return 'agreed';
    case '비싸요':
      return 'disagreed';
    default:
      return 'pending';
  }
}

function createVisitConsultation(v1Patient: Patient, v2PatientId: string): Omit<ConsultationV2, '_id'> | null {
  const pvc = v1Patient.postVisitConsultation;

  // 내원 후 상담 정보가 없으면 null
  if (!pvc) return null;

  // 상담 내용이 없으면 null
  const consultationContent = pvc.firstVisitConsultationContent || pvc.consultationContent;
  if (!consultationContent) return null;

  const now = new Date().toISOString();
  const estimateInfo = pvc.estimateInfo;

  // 금액 정보
  const originalAmount = estimateInfo?.regularPrice || 0;
  const finalAmount = estimateInfo?.discountPrice || originalAmount;
  const discountAmount = originalAmount - finalAmount;
  const discountRate = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0;

  // 상담 상태 (환자 반응 기반)
  const status = mapPatientReactionToStatus(estimateInfo?.patientReaction);

  // 미동의 사유
  const disagreeReasons: string[] = [];
  if (estimateInfo?.patientReaction === '비싸요') {
    disagreeReasons.push('가격 부담');
  }

  // 메모 조합
  const memoLines: string[] = [];
  if (pvc.firstVisitConsultationContent) {
    memoLines.push(`[첫내원상담] ${pvc.firstVisitConsultationContent}`);
  }
  if (pvc.consultationContent && pvc.consultationContent !== pvc.firstVisitConsultationContent) {
    memoLines.push(`[상담내용] ${pvc.consultationContent}`);
  }
  if (pvc.treatmentContent) {
    memoLines.push(`[치료내용] ${pvc.treatmentContent}`);
  }
  if (pvc.nextConsultationPlan) {
    memoLines.push(`[상담계획] ${pvc.nextConsultationPlan}`);
  }
  if (pvc.completionNotes) {
    memoLines.push(`[완료메모] ${pvc.completionNotes}`);
  }
  if (estimateInfo?.discountEvent) {
    memoLines.push(`[할인이벤트] ${estimateInfo.discountEvent}`);
  }
  if (estimateInfo?.patientReaction) {
    memoLines.push(`[환자반응] ${estimateInfo.patientReaction}`);
  }

  return {
    patientId: v2PatientId,
    type: 'visit',  // 내원 상담
    date: v1Patient.visitDate || v1Patient.updatedAt || now,
    treatment: v1Patient.interestedServices?.[0] || '일반진료',
    originalAmount,
    discountRate,
    discountAmount,
    finalAmount,
    discountReason: estimateInfo?.discountEvent,
    status,
    disagreeReasons: disagreeReasons.length > 0 ? disagreeReasons : undefined,
    callbackDate: pvc.nextCallbackDate,
    consultantName: 'V1 마이그레이션',
    memo: memoLines.join('\n'),
    aiGenerated: false,  // 수동 입력으로 표시
    createdAt: v1Patient.visitDate || v1Patient.updatedAt || now,
  };
}

function createInitialJourney(v1Patient: Patient): Journey | undefined {
  // 관심 서비스가 있으면 여정 생성
  const treatmentType = v1Patient.interestedServices?.[0] || '일반진료';

  return {
    id: new ObjectId().toString(),
    treatmentType,
    status: mapStatus(v1Patient),
    startedAt: v1Patient.createdAt || new Date().toISOString(),
    isActive: true,
    createdAt: v1Patient.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function convertV1ToV2(v1Patient: Patient): Omit<PatientV2, '_id'> {
  const now = new Date().toISOString();
  const status = mapStatus(v1Patient);
  const journey = createInitialJourney(v1Patient);

  return {
    // 기본 정보
    name: v1Patient.name,
    phone: v1Patient.phoneNumber,
    age: v1Patient.age,
    region: mapRegion(v1Patient.region),

    // 상태
    status,
    statusChangedAt: v1Patient.updatedAt || now,
    temperature: mapTemperature(v1Patient),

    // 유입/관심
    interest: v1Patient.interestedServices?.[0],
    interestDetail: v1Patient.interestedServices?.slice(1).join(', '),
    source: v1Patient.referralSource || v1Patient.consultationType || 'outbound',

    // AI 관련 (기본값)
    aiRegistered: false,

    // 콜백 이력
    callbackHistory: mapCallbackHistory(v1Patient.callbackHistory),

    // 통화 관련
    lastCallDirection: v1Patient.consultationType === 'inbound' ? 'inbound' : 'outbound',
    lastContactAt: v1Patient.lastConsultation || v1Patient.updatedAt,

    // 메모 (V1 전체 이력 포함)
    memo: buildMemoFromV1(v1Patient),

    // 여정
    journeys: journey ? [journey] : [],
    activeJourneyId: journey?.id,

    // 타임스탬프
    createdAt: v1Patient.createdAt || now,
    updatedAt: now,
  };
}

// ============================================
// API 핸들러
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    // V1, V2 컬렉션
    const v1Collection = db.collection<Patient>('patients');
    const v2Collection = db.collection<PatientV2>('patients_v2');
    const consultationsCollection = db.collection<ConsultationV2>('consultations');

    // 통계
    const stats = {
      total: 0,
      success: 0,
      skipped: 0,
      failed: 0,
      consultationsCreated: 0,  // 상담 기록 생성 수
      errors: [] as string[],
    };

    // V1 환자 전체 조회
    const v1Patients = await v1Collection.find({}).toArray();
    stats.total = v1Patients.length;

    console.log(`[Migration] Starting migration of ${stats.total} patients`);

    // 배치 처리 (100개씩)
    const BATCH_SIZE = 100;

    for (let i = 0; i < v1Patients.length; i += BATCH_SIZE) {
      const batch = v1Patients.slice(i, i + BATCH_SIZE);

      for (const v1Patient of batch) {
        try {
          // 중복 확인 (전화번호 기준)
          const existing = await v2Collection.findOne({ phone: v1Patient.phoneNumber });

          if (existing) {
            stats.skipped++;
            continue;
          }

          // V1 → V2 변환
          const v2Patient = convertV1ToV2(v1Patient);

          // V2에 삽입
          const insertResult = await v2Collection.insertOne({
            ...v2Patient,
            // 마이그레이션 추적용 필드
            _migratedFromV1: true,
            _migratedAt: new Date().toISOString(),
            _originalV1Id: v1Patient._id?.toString() || v1Patient.id,
          } as PatientV2 & { _migratedFromV1: boolean; _migratedAt: string; _originalV1Id: string });

          // 내원 상담 기록이 있으면 consultations 컬렉션에도 저장
          const v2PatientId = insertResult.insertedId.toString();
          const visitConsultation = createVisitConsultation(v1Patient, v2PatientId);

          if (visitConsultation) {
            await consultationsCollection.insertOne({
              ...visitConsultation,
              _migratedFromV1: true,
            } as ConsultationV2 & { _migratedFromV1: boolean });
            stats.consultationsCreated++;
          }

          stats.success++;

        } catch (error) {
          stats.failed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          stats.errors.push(`Patient ${v1Patient.name} (${v1Patient.phoneNumber}): ${errorMsg}`);
        }
      }

      console.log(`[Migration] Processed ${Math.min(i + BATCH_SIZE, v1Patients.length)}/${stats.total}`);
    }

    console.log('[Migration] Complete:', stats);

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      stats,
    });

  } catch (error) {
    console.error('[Migration] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET: 마이그레이션 상태 확인 (미리보기)
export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const v1Count = await db.collection('patients').countDocuments();
    const v2Count = await db.collection('patients_v2').countDocuments();
    const v2MigratedCount = await db.collection('patients_v2').countDocuments({ _migratedFromV1: true });

    // V2에 있는 전화번호 목록
    const v2Phones = await db.collection('patients_v2')
      .find({}, { projection: { phone: 1 } })
      .toArray();
    const v2PhoneSet = new Set(v2Phones.map(p => p.phone));

    // V1에서 V2에 없는 환자 수
    const v1Patients = await db.collection('patients')
      .find({}, { projection: { phoneNumber: 1, name: 1 } })
      .toArray();

    const toMigrate = v1Patients.filter(p => !v2PhoneSet.has(p.phoneNumber));

    return NextResponse.json({
      success: true,
      preview: {
        v1Total: v1Count,
        v2Total: v2Count,
        v2Migrated: v2MigratedCount,
        toMigrate: toMigrate.length,
        willSkip: v1Count - toMigrate.length,
        sampleToMigrate: toMigrate.slice(0, 5).map(p => ({
          name: p.name,
          phone: p.phoneNumber,
        })),
      },
      message: `${toMigrate.length}명 마이그레이션 예정, ${v1Count - toMigrate.length}명 건너뜀 (이미 존재)`,
    });

  } catch (error) {
    console.error('[Migration Preview] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
