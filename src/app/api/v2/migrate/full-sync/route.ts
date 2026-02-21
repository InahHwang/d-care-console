// src/app/api/v2/migrate/full-sync/route.ts
// V1 → V2 전체 재마이그레이션 API
// 요청사항:
// 1. V1 최초상담기록 메모 → V2 상담이력 수동입력 (전화상담)
// 2. V1 상담타입, 거주지역 → V2로 옮기기
// 3. V1 최초상담기록-상담날짜 → V2 첫상담일
// 4. V1 콜백이력 → V2 상담현황 콜백이력 (기존에 빈값으로 들어감)
// 5. V1 종결환자 종결사유 → V2 종결사유 (기타 + 주관식)
// 6. V1 치료동의 - 치료시작예정일 → V2 치료예약일
// 7. V1 내원 후 첫 상담 내용 → V2 상담이력 수동입력 (내원)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { MongoClient, ObjectId, Db } from 'mongodb';
import { PatientStatus, Temperature, Journey, CallbackHistoryEntry } from '@/types/v2';

export const dynamic = 'force-dynamic';

// 프로덕션 DB 직접 연결 함수
async function connectToProductionDb(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) {
    throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  }

  const client = new MongoClient(uri);
  await client.connect();

  // 프로덕션 DB 이름 직접 지정
  const db = client.db('d-care-db');
  console.log('✅ 프로덕션 DB (d-care-db) 연결됨');

  return { client, db };
}

// V1 상태 → V2 상태 매핑
function mapV1StatusToV2(
  v1Status: string,
  visitConfirmed: boolean,
  postVisitStatus?: string,
  isCompleted?: boolean
): PatientStatus {
  // 종결 처리된 환자
  if (isCompleted || v1Status === '종결') {
    return 'closed';
  }

  // 내원관리 환자 (visitConfirmed = true)
  if (visitConfirmed) {
    switch (postVisitStatus) {
      case '치료시작':
        return 'treatment';
      case '치료동의':
        return 'treatmentBooked';
      case '종결':
        return 'closed';
      case '재콜백필요':
      default:
        return 'visited';
    }
  }

  // 상담관리 환자 (visitConfirmed = false)
  switch (v1Status) {
    case '예약확정':
    case '재예약확정':
      return 'reserved';
    case '종결':
      return 'closed';
    case '잠재고객':
    case '콜백필요':
    case '부재중':
    case 'VIP':
    default:
      return 'consulting';
  }
}

// V1 region 객체 → V2 문자열 변환
function mapRegion(region?: { province?: string; city?: string }): string | undefined {
  if (!region || !region.province) return undefined;
  if (region.city) {
    return `${region.province} ${region.city}`;
  }
  return region.province;
}

// V1 콜백 이력 → V2 CallbackHistoryEntry 배열 변환
function mapCallbackHistoryToV2(callbackHistory?: any[]): CallbackHistoryEntry[] {
  if (!callbackHistory || callbackHistory.length === 0) return [];

  return callbackHistory
    .filter(cb => cb.date) // 날짜가 있는 항목만
    .map((cb) => {
      // 콜백 사유 매핑
      let reason: 'noshow' | 'no_answer' | 'postponed' | 'reschedule' | undefined;
      if (cb.status === '부재중') {
        reason = 'no_answer';
      } else if (cb.status === '예정' || cb.status === '완료') {
        reason = 'postponed';
      }

      // 메모 조합
      const noteParts: string[] = [];
      if (cb.type) noteParts.push(`[${cb.type}]`);
      if (cb.notes) noteParts.push(cb.notes);
      if (cb.resultNotes) noteParts.push(cb.resultNotes);
      if (cb.consultationRecord?.consultationContent) {
        noteParts.push(cb.consultationRecord.consultationContent);
      }
      // 첫 상담 결과 정보
      if (cb.firstConsultationResult?.consultationContent) {
        noteParts.push(cb.firstConsultationResult.consultationContent);
      }
      if (cb.callbackFollowupResult?.reason) {
        noteParts.push(cb.callbackFollowupResult.reason);
      }

      return {
        scheduledAt: cb.date ? new Date(cb.date + (cb.time ? `T${cb.time}` : 'T09:00:00')) : new Date(),
        reason,
        note: noteParts.join(' | ') || undefined,
        createdAt: cb.createdAt ? new Date(cb.createdAt) : new Date(),
      };
    });
}

// V1 환자 → V2 nextActionDate 결정
function getNextActionDate(v1Patient: any): Date | null {
  const visitConfirmed = v1Patient.visitConfirmed || false;
  const postVisitStatus = v1Patient.postVisitStatus;
  const postVisitConsultation = v1Patient.postVisitConsultation || {};

  // 종결된 환자는 날짜 없음
  if (v1Patient.isCompleted || v1Patient.status === '종결' || postVisitStatus === '종결') {
    return null;
  }

  // 내원 환자의 경우 postVisitStatus에 따라 다른 날짜 사용
  if (visitConfirmed) {
    let dateStr: string | null = null;

    switch (postVisitStatus) {
      case '치료동의':
        // 치료 시작 예정일
        dateStr = postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate || null;
        break;
      case '치료시작':
        // 치료 중인 환자는 nextActionDate 불필요 (콜백/예약 관리 대상 아님)
        return null;
      case '재콜백필요':
        // 다음 콜백 날짜
        dateStr = postVisitConsultation?.nextCallbackDate || v1Patient.nextCallbackDate || null;
        break;
      default:
        // 내원완료 기본 상태: 콜백 날짜 사용
        dateStr = postVisitConsultation?.nextCallbackDate || v1Patient.nextCallbackDate || null;
    }

    if (dateStr) {
      return new Date(dateStr);
    }
    return null;
  }

  // 상담 환자의 경우 상태에 따라 다른 날짜 사용
  // 콜백필요/부재중 상태면 콜백일 우선
  if (v1Patient.status === '콜백필요' || v1Patient.status === '부재중') {
    if (v1Patient.nextCallbackDate) {
      return new Date(v1Patient.nextCallbackDate);
    }
  }

  // 예약확정/내원예정 상태면 예약일 사용
  if (v1Patient.reservationDate) {
    const timeStr = v1Patient.reservationTime || '09:00';
    return new Date(`${v1Patient.reservationDate}T${timeStr}:00`);
  }

  // 콜백 날짜가 있으면 사용 (fallback)
  if (v1Patient.nextCallbackDate) {
    return new Date(v1Patient.nextCallbackDate);
  }

  return null;
}

// 최초 상담 메모 추출
function getFirstConsultationMemo(v1Patient: any): string | null {
  // 1. consultation 필드의 상담 내용 (상담관리에서 입력한 내용)
  if (v1Patient.consultation?.consultationNotes) {
    // treatmentPlan도 있으면 함께 포함
    const notes = v1Patient.consultation.consultationNotes;
    const plan = v1Patient.consultation.treatmentPlan;
    if (plan) {
      return `${notes}\n\n[치료계획] ${plan}`;
    }
    return notes;
  }

  // 2. 첫 번째 콜백의 상담 내용
  if (v1Patient.callbackHistory && v1Patient.callbackHistory.length > 0) {
    const firstCallback = v1Patient.callbackHistory[0];
    if (firstCallback.consultationRecord?.consultationContent) {
      return firstCallback.consultationRecord.consultationContent;
    }
    if (firstCallback.firstConsultationResult?.consultationContent) {
      return firstCallback.firstConsultationResult.consultationContent;
    }
    if (firstCallback.notes) {
      return firstCallback.notes;
    }
  }

  // 3. 환자 메모
  if (v1Patient.notes) {
    return v1Patient.notes;
  }

  // 4. memo 필드
  if (v1Patient.memo) {
    return v1Patient.memo;
  }

  return null;
}

// GET: 마이그레이션 미리보기
export async function GET(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    // 쿼리 파라미터로 프로덕션 DB 사용 여부 결정
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';

    let db: Db;

    if (useProduction) {
      const connection = await connectToProductionDb();
      productionClient = connection.client;
      db = connection.db;
      console.log('📊 프로덕션 DB에서 미리보기 실행');
    } else {
      const connection = await connectToDatabase();
      db = connection.db;
      console.log('📊 개발 DB에서 미리보기 실행');
    }

    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');

    // V1 환자 전체 조회
    const v1Patients = await v1Collection.find({}).toArray();

    // V2 환자 전화번호 맵
    const v2Patients = await v2Collection.find({}).toArray();
    const v2PhoneMap = new Map(v2Patients.map(p => [p.phone, p]));

    // 통계 계산
    const stats = {
      totalV1Patients: v1Patients.length,
      totalV2Patients: v2Patients.length,
      toInsert: 0,
      toUpdate: 0,
      skipped: 0,
      byV1Status: {} as Record<string, number>,
      byV2Status: {} as Record<string, number>,
      withFirstConsultMemo: 0,
      withCallbackHistory: 0,
      withVisitConsultation: 0,
      closedPatients: 0,
      issues: {
        missingPhone: 0,
        missingName: 0,
      },
    };

    const sampleData: any[] = [];

    for (const v1Patient of v1Patients) {
      // V1 상태별 통계
      const v1Status = v1Patient.status || 'unknown';
      stats.byV1Status[v1Status] = (stats.byV1Status[v1Status] || 0) + 1;

      // 문제 데이터 체크
      if (!v1Patient.phoneNumber) {
        stats.issues.missingPhone++;
        stats.skipped++;
        continue;
      }
      if (!v1Patient.name) {
        stats.issues.missingName++;
        stats.skipped++;
        continue;
      }

      const existingV2 = v2PhoneMap.get(v1Patient.phoneNumber);
      const v2Status = mapV1StatusToV2(
        v1Patient.status,
        v1Patient.visitConfirmed || false,
        v1Patient.postVisitStatus,
        v1Patient.isCompleted
      );
      stats.byV2Status[v2Status] = (stats.byV2Status[v2Status] || 0) + 1;

      if (existingV2) {
        stats.toUpdate++;
      } else {
        stats.toInsert++;
      }

      // 추가 통계
      if (getFirstConsultationMemo(v1Patient)) {
        stats.withFirstConsultMemo++;
      }
      if (v1Patient.callbackHistory && v1Patient.callbackHistory.length > 0) {
        stats.withCallbackHistory++;
      }
      if (v1Patient.postVisitConsultation?.firstVisitConsultationContent) {
        stats.withVisitConsultation++;
      }
      if (v1Patient.isCompleted || v1Patient.status === '종결') {
        stats.closedPatients++;
      }

      // 샘플 데이터 (10개만)
      if (sampleData.length < 10) {
        sampleData.push({
          name: v1Patient.name,
          phone: v1Patient.phoneNumber,
          v1Status: v1Patient.status,
          v2Status,
          visitConfirmed: v1Patient.visitConfirmed || false,
          postVisitStatus: v1Patient.postVisitStatus,
          isCompleted: v1Patient.isCompleted,
          hasCallbackHistory: (v1Patient.callbackHistory?.length || 0) > 0,
          callbackCount: v1Patient.callbackHistory?.length || 0,
          hasFirstConsultMemo: !!getFirstConsultationMemo(v1Patient),
          hasVisitConsultation: !!v1Patient.postVisitConsultation?.firstVisitConsultationContent,
          action: existingV2 ? 'UPDATE' : 'INSERT',
        });
      }
    }

    // 프로덕션 클라이언트 정리
    if (productionClient) {
      await productionClient.close();
    }

    const usedProduction = new URL(request.url).searchParams.get('production') === 'true';

    return NextResponse.json({
      success: true,
      database: usedProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      preview: {
        ...stats,
        sampleData,
      },
    });
  } catch (error) {
    console.error('[Full Sync GET] Error:', error);
    if (productionClient) {
      await productionClient.close();
    }
    return NextResponse.json(
      { error: '미리보기 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: 전체 재마이그레이션 실행
export async function POST(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    // 쿼리 파라미터로 프로덕션 DB 사용 여부 결정
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';

    let db: Db;

    if (useProduction) {
      const connection = await connectToProductionDb();
      productionClient = connection.client;
      db = connection.db;
      console.log('🚀 프로덕션 DB에서 마이그레이션 실행');
    } else {
      const connection = await connectToDatabase();
      db = connection.db;
      console.log('🚀 개발 DB에서 마이그레이션 실행');
    }

    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');
    const callLogsCollection = db.collection('callLogs_v2');
    const manualConsultationsCollection = db.collection('manualConsultations_v2');

    // V1 환자 전체 조회
    const v1Patients = await v1Collection.find({}).toArray();

    // V2 환자 전화번호 맵
    const v2Patients = await v2Collection.find({}).toArray();
    const v2PhoneMap = new Map(v2Patients.map(p => [p.phone, p]));

    const results = {
      total: v1Patients.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      manualConsultationsCreated: 0,
      errors: [] as string[],
    };

    const now = new Date();

    for (const v1Patient of v1Patients) {
      try {
        // 필수 필드 체크
        if (!v1Patient.phoneNumber || !v1Patient.name) {
          results.skipped++;
          continue;
        }

        // V2 상태 매핑
        const v2Status = mapV1StatusToV2(
          v1Patient.status,
          v1Patient.visitConfirmed || false,
          v1Patient.postVisitStatus,
          v1Patient.isCompleted
        );

        const existingV2 = v2PhoneMap.get(v1Patient.phoneNumber);
        const treatmentType = v1Patient.interestedServices?.[0] || '일반진료';

        // 콜백 이력 변환
        const callbackHistory = mapCallbackHistoryToV2(v1Patient.callbackHistory);

        if (existingV2) {
          // === 기존 환자 업데이트 ===
          const v2PatientId = existingV2._id.toString();

          // Journey 업데이트
          const updatedJourneys = existingV2.journeys?.map((journey: Journey) => {
            if (journey.id === existingV2.activeJourneyId) {
              return {
                ...journey,
                status: v2Status,
                treatmentType,
                // 콜백 이력 덮어쓰기 (V1 데이터로)
                callbackHistory: callbackHistory.length > 0 ? callbackHistory : journey.callbackHistory,
                updatedAt: now,
              };
            }
            return journey;
          }) || [];

          // Journey가 없으면 새로 생성
          if (updatedJourneys.length === 0) {
            const journeyId = new ObjectId().toString();
            updatedJourneys.push({
              id: journeyId,
              treatmentType,
              status: v2Status,
              startedAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
              paymentStatus: 'none',
              statusHistory: [{
                from: 'consulting' as PatientStatus,
                to: v2Status,
                eventDate: now,
                changedAt: now,
                changedBy: '마이그레이션',
              }],
              callbackHistory,
              isActive: true,
              createdAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
              updatedAt: now,
            });
          }

          const updateData: Record<string, unknown> = {
            // 기본 정보 업데이트
            name: v1Patient.name,
            age: (v1Patient.age && v1Patient.age >= 2 && v1Patient.age <= 120) ? v1Patient.age : existingV2.age,
            // 2. 거주지역 옮기기
            region: mapRegion(v1Patient.region) || existingV2.region,

            // 상태 업데이트
            status: v2Status,
            statusChangedAt: now,

            // 2. 상담타입 옮기기
            consultationType: v1Patient.consultationType || existingV2.consultationType || 'inbound',
            source: v1Patient.referralSource || existingV2.source || '',
            interest: treatmentType,

            // Journey 업데이트
            journeys: updatedJourneys,

            // 콜백 이력 (환자 레벨)
            callbackHistory: callbackHistory.length > 0 ? callbackHistory : existingV2.callbackHistory,

            // 예약/콜백 정보
            nextActionDate: getNextActionDate(v1Patient) || existingV2.nextActionDate,

            // 내원 관련
            visitConfirmed: v1Patient.visitConfirmed || false,
            firstVisitDate: v1Patient.visitDate || existingV2.firstVisitDate,

            // 3. 첫상담일 옮기기
            firstConsultDate: v1Patient.firstConsultDate
              ? new Date(v1Patient.firstConsultDate)
              : (existingV2.firstConsultDate || (v1Patient.createdAt ? new Date(v1Patient.createdAt) : null)),

            // 6. 치료예약일 (치료동의 시 치료시작예정일)
            treatmentBookedDate: v1Patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate
              ? new Date(v1Patient.postVisitConsultation.treatmentConsentInfo.treatmentStartDate)
              : existingV2.treatmentBookedDate,

            // 금액 정보
            estimatedAmount: v1Patient.postVisitConsultation?.estimateInfo?.discountPrice || existingV2.estimatedAmount || 0,

            // 5. 종결 사유 (기타 + 주관식)
            ...(v2Status === 'closed' && {
              closedReason: '기타',
              closedReasonDetail: v1Patient.completedReason || v1Patient.postVisitConsultation?.completionNotes || '마이그레이션 - V1 종결',
              closedAt: v1Patient.completedAt ? new Date(v1Patient.completedAt) : now,
            }),

            // 시간
            updatedAt: now,
            lastContactAt: v1Patient.updatedAt ? new Date(v1Patient.updatedAt) : existingV2.lastContactAt,

            // 동기화 메타데이터
            lastSyncedAt: now,
            v1PatientId: v1Patient.patientId || v1Patient._id.toString(),
          };

          await v2Collection.updateOne(
            { _id: existingV2._id },
            { $set: updateData }
          );

          // 1. 최초상담기록 메모 → 수동 상담 이력 (전화상담)
          const firstConsultMemo = getFirstConsultationMemo(v1Patient);
          if (firstConsultMemo) {
            // 이미 마이그레이션된 상담이 있는지 확인
            const existingManual = await manualConsultationsCollection.findOne({
              patientId: v2PatientId,
              migratedFrom: 'v1',
              type: 'phone',
            });

            if (!existingManual) {
              await manualConsultationsCollection.insertOne({
                patientId: v2PatientId,
                type: 'phone',
                date: v1Patient.firstConsultDate
                  ? new Date(v1Patient.firstConsultDate)
                  : (v1Patient.createdAt ? new Date(v1Patient.createdAt) : now),
                content: firstConsultMemo,
                consultantName: v1Patient.createdByName || v1Patient.lastModifiedByName || '마이그레이션',
                source: 'manual',
                migratedFrom: 'v1',
                migratedAt: now,
                createdAt: now,
                updatedAt: now,
              });
              results.manualConsultationsCreated++;
            }
          }

          // 7. 내원 후 첫 상담 내용 → 수동 상담 이력 (내원)
          const visitConsultContent = v1Patient.postVisitConsultation?.firstVisitConsultationContent
            || v1Patient.postVisitConsultation?.consultationContent;
          if (visitConsultContent && v1Patient.visitConfirmed) {
            const existingVisitManual = await manualConsultationsCollection.findOne({
              patientId: v2PatientId,
              migratedFrom: 'v1',
              type: 'visit',
            });

            if (!existingVisitManual) {
              await manualConsultationsCollection.insertOne({
                patientId: v2PatientId,
                type: 'visit',
                date: v1Patient.visitDate
                  ? new Date(v1Patient.visitDate)
                  : (v1Patient.createdAt ? new Date(v1Patient.createdAt) : now),
                content: visitConsultContent,
                consultantName: v1Patient.lastModifiedByName || v1Patient.createdByName || '마이그레이션',
                source: 'manual',
                migratedFrom: 'v1',
                migratedAt: now,
                createdAt: now,
                updatedAt: now,
              });
              results.manualConsultationsCreated++;
            }
          }

          results.updated++;

        } else {
          // === 신규 환자 삽입 ===
          const journeyId = new ObjectId().toString();

          const firstJourney: Journey = {
            id: journeyId,
            treatmentType,
            status: v2Status,
            startedAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
            paymentStatus: 'none',
            statusHistory: [{
              from: 'consulting' as PatientStatus,
              to: v2Status,
              eventDate: now,
              changedAt: now,
              changedBy: '마이그레이션',
            }],
            callbackHistory,
            isActive: true,
            createdAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
            updatedAt: now,
          };

          const v2Patient: Record<string, unknown> = {
            // 기본 정보
            name: v1Patient.name,
            phone: v1Patient.phoneNumber,
            age: (v1Patient.age && v1Patient.age >= 2 && v1Patient.age <= 120) ? v1Patient.age : undefined,
            // 2. 거주지역 옮기기
            region: mapRegion(v1Patient.region),

            // 상태
            status: v2Status,
            temperature: 'warm' as Temperature,
            statusChangedAt: now,

            // 2. 상담타입 옮기기
            consultationType: v1Patient.consultationType || 'inbound',
            source: v1Patient.referralSource || '',
            interest: treatmentType,

            // AI 분석 (빈 값으로 초기화)
            aiAnalysis: {
              interest: treatmentType,
              summary: '',
              classification: v1Patient.visitConfirmed ? 'patient' : 'new_patient',
            },

            // Journey
            journeys: [firstJourney],
            activeJourneyId: journeyId,

            // 콜백 이력 (환자 레벨)
            callbackHistory,

            // 예약/콜백 정보
            nextActionDate: getNextActionDate(v1Patient) || undefined,

            // 내원 관련
            visitConfirmed: v1Patient.visitConfirmed || false,
            firstVisitDate: v1Patient.visitDate || undefined,

            // 3. 첫상담일 옮기기
            firstConsultDate: v1Patient.firstConsultDate
              ? new Date(v1Patient.firstConsultDate)
              : (v1Patient.createdAt ? new Date(v1Patient.createdAt) : now),

            // 6. 치료예약일 (치료동의 시 치료시작예정일)
            treatmentBookedDate: v1Patient.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate
              ? new Date(v1Patient.postVisitConsultation.treatmentConsentInfo.treatmentStartDate)
              : undefined,

            // 금액 정보
            estimatedAmount: v1Patient.postVisitConsultation?.estimateInfo?.discountPrice || 0,

            // 5. 종결 사유 (기타 + 주관식)
            ...(v2Status === 'closed' && {
              closedReason: '기타',
              closedReasonDetail: v1Patient.completedReason || v1Patient.postVisitConsultation?.completionNotes || '마이그레이션 - V1 종결',
              closedAt: v1Patient.completedAt ? new Date(v1Patient.completedAt) : now,
            }),

            // 시간
            createdAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
            updatedAt: now,
            lastContactAt: v1Patient.updatedAt ? new Date(v1Patient.updatedAt) : now,

            // 마이그레이션 메타데이터
            migratedFrom: 'v1',
            migratedAt: now,
            lastSyncedAt: now,
            v1PatientId: v1Patient.patientId || v1Patient._id.toString(),
          };

          // V2에 삽입
          const insertResult = await v2Collection.insertOne(v2Patient);
          const newPatientId = insertResult.insertedId.toString();

          // callLogs_v2에 patientId 연결
          await callLogsCollection.updateMany(
            { phone: v1Patient.phoneNumber },
            { $set: { patientId: newPatientId } }
          );

          // 1. 최초상담기록 메모 → 수동 상담 이력 (전화상담)
          const firstConsultMemo = getFirstConsultationMemo(v1Patient);
          if (firstConsultMemo) {
            await manualConsultationsCollection.insertOne({
              patientId: newPatientId,
              type: 'phone',
              date: v1Patient.firstConsultDate
                ? new Date(v1Patient.firstConsultDate)
                : (v1Patient.createdAt ? new Date(v1Patient.createdAt) : now),
              content: firstConsultMemo,
              consultantName: v1Patient.createdByName || v1Patient.lastModifiedByName || '마이그레이션',
              source: 'manual',
              migratedFrom: 'v1',
              migratedAt: now,
              createdAt: now,
              updatedAt: now,
            });
            results.manualConsultationsCreated++;
          }

          // 7. 내원 후 첫 상담 내용 → 수동 상담 이력 (내원)
          const visitConsultContent = v1Patient.postVisitConsultation?.firstVisitConsultationContent
            || v1Patient.postVisitConsultation?.consultationContent;
          if (visitConsultContent && v1Patient.visitConfirmed) {
            await manualConsultationsCollection.insertOne({
              patientId: newPatientId,
              type: 'visit',
              date: v1Patient.visitDate
                ? new Date(v1Patient.visitDate)
                : (v1Patient.createdAt ? new Date(v1Patient.createdAt) : now),
              content: visitConsultContent,
              consultantName: v1Patient.lastModifiedByName || v1Patient.createdByName || '마이그레이션',
              source: 'manual',
              migratedFrom: 'v1',
              migratedAt: now,
              createdAt: now,
              updatedAt: now,
            });
            results.manualConsultationsCreated++;
          }

          // 중복 방지를 위해 Map에 추가
          v2PhoneMap.set(v1Patient.phoneNumber, { ...v2Patient, _id: insertResult.insertedId });
          results.inserted++;
        }

      } catch (patientError) {
        results.failed++;
        results.errors.push(`${v1Patient.name} (${v1Patient.phoneNumber}): ${(patientError as Error).message}`);
      }
    }

    // 프로덕션 클라이언트 정리
    if (productionClient) {
      await productionClient.close();
    }

    const usedProduction = new URL(request.url).searchParams.get('production') === 'true';

    return NextResponse.json({
      success: true,
      message: 'V1 → V2 전체 재마이그레이션 완료',
      database: usedProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      results,
    });
  } catch (error) {
    console.error('[Full Sync POST] Error:', error);
    if (productionClient) {
      await productionClient.close();
    }
    return NextResponse.json(
      { error: '마이그레이션 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT: 백업 생성
export async function PUT(request: NextRequest) {
  let productionClient: MongoClient | null = null;

  try {
    // 쿼리 파라미터로 프로덕션 DB 사용 여부 결정
    const { searchParams } = new URL(request.url);
    const useProduction = searchParams.get('production') === 'true';

    let db: Db;

    if (useProduction) {
      const connection = await connectToProductionDb();
      productionClient = connection.client;
      db = connection.db;
      console.log('💾 프로덕션 DB 백업 실행');
    } else {
      const connection = await connectToDatabase();
      db = connection.db;
      console.log('💾 개발 DB 백업 실행');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const results = {
      v1Backup: { collection: '', count: 0 },
      v2Backup: { collection: '', count: 0 },
      manualConsultationsBackup: { collection: '', count: 0 },
    };

    // V1 patients 백업
    const v1Collection = db.collection('patients');
    const v1BackupName = `patients_backup_${timestamp}`;
    const v1Docs = await v1Collection.find({}).toArray();

    if (v1Docs.length > 0) {
      const v1DocsWithoutId = v1Docs.map(doc => {
        const { _id, ...rest } = doc;
        return { ...rest, originalId: _id.toString(), backupAt: new Date() };
      });
      await db.collection(v1BackupName).insertMany(v1DocsWithoutId);
      results.v1Backup = { collection: v1BackupName, count: v1Docs.length };
    }

    // V2 patients_v2 백업
    const v2Collection = db.collection('patients_v2');
    const v2BackupName = `patients_v2_backup_${timestamp}`;
    const v2Docs = await v2Collection.find({}).toArray();

    if (v2Docs.length > 0) {
      const v2DocsWithoutId = v2Docs.map(doc => {
        const { _id, ...rest } = doc;
        return { ...rest, originalId: _id.toString(), backupAt: new Date() };
      });
      await db.collection(v2BackupName).insertMany(v2DocsWithoutId);
      results.v2Backup = { collection: v2BackupName, count: v2Docs.length };
    }

    // manualConsultations_v2 백업
    const manualCollection = db.collection('manualConsultations_v2');
    const manualBackupName = `manualConsultations_v2_backup_${timestamp}`;
    const manualDocs = await manualCollection.find({}).toArray();

    if (manualDocs.length > 0) {
      const manualDocsWithoutId = manualDocs.map(doc => {
        const { _id, ...rest } = doc;
        return { ...rest, originalId: _id.toString(), backupAt: new Date() };
      });
      await db.collection(manualBackupName).insertMany(manualDocsWithoutId);
      results.manualConsultationsBackup = { collection: manualBackupName, count: manualDocs.length };
    }

    // 프로덕션 클라이언트 정리
    if (productionClient) {
      await productionClient.close();
    }

    const usedProduction = new URL(request.url).searchParams.get('production') === 'true';

    return NextResponse.json({
      success: true,
      message: '백업 완료',
      database: usedProduction ? 'd-care-db (프로덕션)' : 'd-care-db-development (개발)',
      backups: results,
      timestamp,
    });
  } catch (error) {
    console.error('[Full Sync PUT] Backup Error:', error);
    if (productionClient) {
      await productionClient.close();
    }
    return NextResponse.json(
      { error: '백업 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}
