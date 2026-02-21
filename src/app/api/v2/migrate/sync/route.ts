// src/app/api/v2/migrate/sync/route.ts
// V1 → V2 증분 마이그레이션 (Upsert 방식)
// V1 기준으로 V2를 동기화 (신규 추가 + 기존 업데이트)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PatientStatus, Temperature, Journey } from '@/types/v2';

export const dynamic = 'force-dynamic';

// V1 상태 → V2 상태 매핑
function mapV1StatusToV2(
  v1Status: string,
  visitConfirmed: boolean,
  postVisitStatus?: string
): PatientStatus {
  // 내원관리 환자 (visitConfirmed = true)
  if (visitConfirmed) {
    switch (postVisitStatus) {
      case '치료시작':
        return 'treatment';
      case '치료동의':
        return 'treatmentBooked';
      case '종결':
        return 'completed';
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

// V1 콜백 이력 → V2 Journey 콜백 이력 변환
function mapCallbackHistory(callbackHistory?: any[]): any[] {
  if (!callbackHistory || callbackHistory.length === 0) return [];

  return callbackHistory.map((cb, index) => ({
    attempt: index + 1,
    date: cb.date || '',
    time: cb.time || '',
    result: cb.status === '완료' ? '통화완료' : cb.status === '부재중' ? '부재중' : '콜백재요청',
    notes: cb.notes || cb.resultNotes || '',
    counselorId: cb.handledBy || cb.createdBy || '',
    counselorName: cb.handledByName || cb.createdByName || '',
    createdAt: cb.createdAt || new Date().toISOString(),
  }));
}

// V1 환자 → V2 nextActionDate 결정
function getNextActionDate(v1Patient: any): Date | null {
  const visitConfirmed = v1Patient.visitConfirmed || false;
  const postVisitStatus = v1Patient.postVisitStatus;
  const postVisitConsultation = v1Patient.postVisitConsultation || {};

  // 내원 환자의 경우 postVisitStatus에 따라 다른 날짜 사용
  if (visitConfirmed) {
    let dateStr: string | null = null;

    switch (postVisitStatus) {
      case '치료동의':
        // 치료 시작 예정일
        dateStr = postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate || null;
        break;
      case '치료시작':
        // 다음 내원 예정일
        dateStr = postVisitConsultation?.nextVisitDate || v1Patient.nextVisitDate || null;
        break;
      case '재콜백필요':
        // 다음 콜백 날짜
        dateStr = postVisitConsultation?.nextCallbackDate || v1Patient.nextCallbackDate || null;
        break;
      case '종결':
        // 종결 시 날짜 필요 없음
        return null;
      default:
        // 내원완료 기본 상태: 콜백 날짜 사용
        dateStr = postVisitConsultation?.nextCallbackDate || v1Patient.nextCallbackDate || null;
    }

    if (dateStr) {
      return new Date(dateStr);
    }
    return null;
  }

  // 상담 환자의 경우 예약일 사용
  if (v1Patient.reservationDate) {
    const timeStr = v1Patient.reservationTime || '09:00';
    return new Date(`${v1Patient.reservationDate}T${timeStr}:00`);
  }

  return null;
}

// GET: 동기화 미리보기
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');

    // V1 환자 전체 조회
    const v1Patients = await v1Collection.find({}).toArray();

    // V2 환자 전화번호 맵 (중복 체크 및 업데이트 비교용)
    const v2Patients = await v2Collection.find({}).toArray();
    const v2PhoneMap = new Map(v2Patients.map(p => [p.phone, p]));

    // 통계 계산
    const stats = {
      totalV1Patients: v1Patients.length,
      totalV2Patients: v2Patients.length,
      toInsert: 0,    // 신규 추가 대상
      toUpdate: 0,    // 업데이트 대상
      skipped: 0,     // 스킵 (필수 필드 누락)
      issues: {
        missingPhone: 0,
        missingName: 0,
      },
    };

    const insertList: any[] = [];
    const updateList: any[] = [];

    for (const v1Patient of v1Patients) {
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

      if (existingV2) {
        // 업데이트 대상
        stats.toUpdate++;
        updateList.push({
          name: v1Patient.name,
          phone: v1Patient.phoneNumber,
          v1Status: v1Patient.status,
          v2CurrentStatus: existingV2.status,
          v2NewStatus: mapV1StatusToV2(
            v1Patient.status,
            v1Patient.visitConfirmed || false,
            v1Patient.postVisitStatus
          ),
          visitConfirmed: v1Patient.visitConfirmed || false,
        });
      } else {
        // 신규 추가 대상
        stats.toInsert++;
        insertList.push({
          name: v1Patient.name,
          phone: v1Patient.phoneNumber,
          v1Status: v1Patient.status,
          v2Status: mapV1StatusToV2(
            v1Patient.status,
            v1Patient.visitConfirmed || false,
            v1Patient.postVisitStatus
          ),
          visitConfirmed: v1Patient.visitConfirmed || false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      preview: {
        ...stats,
        sampleInserts: insertList.slice(0, 5),
        sampleUpdates: updateList.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('[Migrate Sync GET] Error:', error);
    return NextResponse.json(
      { error: '미리보기 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: 동기화 실행 (Upsert)
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');
    const callLogsCollection = db.collection('callLogs_v2');

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
          v1Patient.postVisitStatus
        );

        const existingV2 = v2PhoneMap.get(v1Patient.phoneNumber);

        if (existingV2) {
          // === 기존 환자 업데이트 ===
          const treatmentType = v1Patient.interestedServices?.[0] || '일반진료';

          // 기존 Journey 유지하면서 상태만 업데이트
          const updatedJourneys = existingV2.journeys?.map((journey: Journey) => {
            if (journey.id === existingV2.activeJourneyId) {
              return {
                ...journey,
                status: v2Status,
                treatmentType,
                callbackHistory: mapCallbackHistory(v1Patient.callbackHistory),
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
                changedBy: '마이그레이션 동기화',
              }],
              callbackHistory: mapCallbackHistory(v1Patient.callbackHistory),
              isActive: true,
              createdAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
              updatedAt: now,
            });
          }

          const updateData: Record<string, unknown> = {
            // 기본 정보 업데이트
            name: v1Patient.name,
            age: (v1Patient.age && v1Patient.age >= 2 && v1Patient.age <= 120) ? v1Patient.age : existingV2.age,
            region: mapRegion(v1Patient.region) || existingV2.region,

            // 상태 업데이트
            status: v2Status,
            statusChangedAt: now,

            // 유입 정보
            consultationType: v1Patient.consultationType || existingV2.consultationType || 'inbound',
            source: v1Patient.referralSource || existingV2.source || '',
            interest: v1Patient.interestedServices?.[0] || existingV2.interest || '일반진료',

            // Journey 업데이트
            journeys: updatedJourneys,

            // 예약/콜백 정보 (내원 상태에 따라 적절한 날짜 사용)
            nextActionDate: getNextActionDate(v1Patient) || existingV2.nextActionDate,

            // 내원 관련
            visitConfirmed: v1Patient.visitConfirmed || false,
            firstVisitDate: v1Patient.visitDate || existingV2.firstVisitDate,

            // 금액 정보
            estimatedAmount: v1Patient.postVisitConsultation?.estimateInfo?.discountPrice || existingV2.estimatedAmount || 0,

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

          results.updated++;

        } else {
          // === 신규 환자 삽입 ===
          const journeyId = new ObjectId().toString();
          const treatmentType = v1Patient.interestedServices?.[0] || '일반진료';

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
              changedBy: '마이그레이션 동기화',
            }],
            callbackHistory: mapCallbackHistory(v1Patient.callbackHistory),
            isActive: true,
            createdAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
            updatedAt: now,
          };

          const v2Patient: Record<string, unknown> = {
            // 기본 정보
            name: v1Patient.name,
            phone: v1Patient.phoneNumber,
            age: (v1Patient.age && v1Patient.age >= 2 && v1Patient.age <= 120) ? v1Patient.age : undefined,
            region: mapRegion(v1Patient.region),

            // 상태
            status: v2Status,
            temperature: 'warm' as Temperature,
            statusChangedAt: now,

            // 유입 정보
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

            // 예약/콜백 정보 (내원 상태에 따라 적절한 날짜 사용)
            nextActionDate: getNextActionDate(v1Patient) || undefined,

            // 내원 관련
            visitConfirmed: v1Patient.visitConfirmed || false,
            firstVisitDate: v1Patient.visitDate || undefined,

            // 금액 정보
            estimatedAmount: v1Patient.postVisitConsultation?.estimateInfo?.discountPrice || 0,

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

          // 중복 방지를 위해 Map에 추가
          v2PhoneMap.set(v1Patient.phoneNumber, { ...v2Patient, _id: insertResult.insertedId });
          results.inserted++;
        }

      } catch (patientError) {
        results.failed++;
        results.errors.push(`${v1Patient.name} (${v1Patient.phoneNumber}): ${(patientError as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'V1 → V2 동기화 완료',
      results,
    });
  } catch (error) {
    console.error('[Migrate Sync POST] Error:', error);
    return NextResponse.json(
      { error: '동기화 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}
