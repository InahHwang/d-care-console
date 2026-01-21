// src/app/api/v2/migrate/route.ts
// V1 patients → V2 patients_v2 마이그레이션 API

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

// GET: 마이그레이션 미리보기
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');

    // V1 환자 전체 조회
    const v1Patients = await v1Collection.find({}).toArray();

    // V2 환자 전화번호 목록 (중복 체크용)
    const v2Patients = await v2Collection.find({}, { projection: { phone: 1 } }).toArray();
    const v2PhoneSet = new Set(v2Patients.map(p => p.phone));

    // 통계 계산
    const stats = {
      totalV1Patients: v1Patients.length,
      alreadyInV2: 0,
      toMigrate: 0,
      byV1Status: {} as Record<string, number>,
      byV2Status: {} as Record<string, number>,
      issues: {
        missingPhone: 0,
        missingName: 0,
        invalidAge: 0,
      },
    };

    const toMigrateList: any[] = [];

    for (const patient of v1Patients) {
      // V1 상태별 통계
      const v1Status = patient.status || 'unknown';
      stats.byV1Status[v1Status] = (stats.byV1Status[v1Status] || 0) + 1;

      // 문제 데이터 체크
      if (!patient.phoneNumber) {
        stats.issues.missingPhone++;
        continue;
      }
      if (!patient.name) {
        stats.issues.missingName++;
        continue;
      }
      if (patient.age && (patient.age < 2 || patient.age > 120)) {
        stats.issues.invalidAge++;
      }

      // 중복 체크
      if (v2PhoneSet.has(patient.phoneNumber)) {
        stats.alreadyInV2++;
        continue;
      }

      // V2 상태 매핑
      const v2Status = mapV1StatusToV2(
        patient.status,
        patient.visitConfirmed || false,
        patient.postVisitStatus
      );
      stats.byV2Status[v2Status] = (stats.byV2Status[v2Status] || 0) + 1;

      stats.toMigrate++;
      toMigrateList.push({
        name: patient.name,
        phone: patient.phoneNumber,
        v1Status: patient.status,
        v2Status,
        visitConfirmed: patient.visitConfirmed || false,
      });
    }

    return NextResponse.json({
      success: true,
      preview: {
        ...stats,
        samplePatients: toMigrateList.slice(0, 10), // 샘플 10개만
      },
    });
  } catch (error) {
    console.error('[Migrate GET] Error:', error);
    return NextResponse.json(
      { error: '미리보기 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT: 백업 생성 (마이그레이션 전 실행 권장)
export async function PUT() {
  try {
    const { db } = await connectToDatabase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const results = {
      v1Backup: { collection: '', count: 0 },
      v2Backup: { collection: '', count: 0 },
    };

    // V1 patients 백업
    const v1Collection = db.collection('patients');
    const v1BackupName = `patients_backup_${timestamp}`;
    const v1Docs = await v1Collection.find({}).toArray();

    if (v1Docs.length > 0) {
      // _id 제거하고 새 컬렉션에 삽입
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

    return NextResponse.json({
      success: true,
      message: '백업 완료',
      backups: results,
      timestamp,
    });
  } catch (error) {
    console.error('[Migrate PUT] Backup Error:', error);
    return NextResponse.json(
      { error: '백업 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST: 마이그레이션 실행
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const v1Collection = db.collection('patients');
    const v2Collection = db.collection('patients_v2');
    const callLogsCollection = db.collection('callLogs_v2');

    // V1 환자 전체 조회
    const v1Patients = await v1Collection.find({}).toArray();

    // V2 환자 전화번호 목록 (중복 체크용)
    const v2Patients = await v2Collection.find({}, { projection: { phone: 1 } }).toArray();
    const v2PhoneSet = new Set(v2Patients.map(p => p.phone));

    const results = {
      total: v1Patients.length,
      migrated: 0,
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

        // 중복 체크
        if (v2PhoneSet.has(v1Patient.phoneNumber)) {
          results.skipped++;
          continue;
        }

        // V2 상태 매핑
        const v2Status = mapV1StatusToV2(
          v1Patient.status,
          v1Patient.visitConfirmed || false,
          v1Patient.postVisitStatus
        );

        // Journey 생성
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
            changedBy: '마이그레이션',
          }],
          callbackHistory: mapCallbackHistory(v1Patient.callbackHistory),
          isActive: true,
          createdAt: v1Patient.createdAt ? new Date(v1Patient.createdAt) : now,
          updatedAt: now,
        };

        // V2 환자 문서 생성
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

          // 예약 정보 (있는 경우)
          nextActionDate: v1Patient.reservationDate
            ? new Date(`${v1Patient.reservationDate}${v1Patient.reservationTime ? 'T' + v1Patient.reservationTime : 'T09:00:00'}`)
            : undefined,

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

        // 중복 방지를 위해 Set에 추가
        v2PhoneSet.add(v1Patient.phoneNumber);
        results.migrated++;

      } catch (patientError) {
        results.failed++;
        results.errors.push(`${v1Patient.name} (${v1Patient.phoneNumber}): ${(patientError as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[Migrate POST] Error:', error);
    return NextResponse.json(
      { error: '마이그레이션 실패', details: (error as Error).message },
      { status: 500 }
    );
  }
}
