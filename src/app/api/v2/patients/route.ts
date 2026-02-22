// src/app/api/v2/patients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PatientStatus, Temperature, Journey } from '@/types/v2';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createPatientSchema } from '@/lib/validations/schemas';
import { createRouteLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface PatientQuery {
  status?: PatientStatus | { $ne: string };
  temperature?: Temperature;
  'aiAnalysis.interest'?: { $regex: string; $options: string };
  $or?: Array<{ name?: { $regex: string; $options: string }; phone?: { $regex: string } }>;
  createdAt?: { $gte?: Date; $lte?: Date };
}

// 상태별 체류일 경고 임계값 (일)
const DAYS_THRESHOLD: Record<PatientStatus, number> = {
  consulting: 7,
  reserved: 0,       // 예약은 nextActionDate로 판단
  visited: 7,
  treatmentBooked: 0, // 치료예약은 nextActionDate로 판단
  treatment: 30,
  completed: 999,    // 완료는 경고 없음
  followup: 90,
  closed: 999,       // 종결은 경고 없음
};

// 긴급도 계산 헬퍼
type UrgencyType = 'noshow' | 'today' | 'overdue' | 'normal';

function getUrgency(
  status: PatientStatus,
  nextActionDate: string | Date | null | undefined,
  daysInStatus: number
): UrgencyType {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (nextActionDate) {
    const actionDate = new Date(nextActionDate);
    actionDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((actionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'noshow';  // 예정일 지남
    if (diffDays === 0) return 'today'; // 오늘
  } else {
    // nextActionDate 없는 경우: 체류일 임계값 체크
    const threshold = DAYS_THRESHOLD[status];
    if (threshold > 0 && daysInStatus >= threshold) {
      return 'overdue';
    }
  }

  return 'normal';
}

// 기간 타입을 시작 날짜로 변환
function getPeriodStartDate(period: string | null): Date | null {
  if (!period || period === 'all') return null;

  const now = new Date();
  let monthsBack = 3;

  switch (period) {
    case '1month': monthsBack = 1; break;
    case '3months': monthsBack = 3; break;
    case '6months': monthsBack = 6; break;
    case '1year': monthsBack = 12; break;
    default: return null;
  }

  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
}

export async function GET(request: NextRequest) {
  const log = createRouteLogger('/api/v2/patients', 'GET');
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const status = searchParams.get('status') as PatientStatus | null;
    const temperature = searchParams.get('temperature') as Temperature | null;
    const interest = searchParams.get('interest');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || '3months'; // 기본값: 최근 3개월
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;
    const urgency = searchParams.get('urgency') as UrgencyType | null; // 긴급 필터

    const { db } = await connectToDatabase();
    const collection = db.collection('patients_v2');

    // 쿼리 빌드
    const query: PatientQuery = { clinicId } as PatientQuery;

    if (status) {
      // 특정 상태 필터링 (closed 포함)
      query.status = status;
    }
    // 상태 필터가 없으면 전체 환자 표시 (종결 포함)

    if (temperature) {
      query.temperature = temperature;
    }

    if (interest) {
      query['aiAnalysis.interest'] = { $regex: interest, $options: 'i' };
    }

    if (search) {
      // 전화번호 검색: 대시 유무와 관계없이 검색
      const phoneDigits = search.replace(/\D/g, ''); // 숫자만 추출
      const orConditions: Array<{ name?: { $regex: string; $options: string }; phone?: { $regex: string } }> = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } },  // 원본 그대로 검색
      ];

      // 숫자가 4자리 이상이면 뒷자리로도 검색 (더 유연한 매칭)
      if (phoneDigits.length >= 4) {
        // 마지막 4자리로 검색
        const last4 = phoneDigits.slice(-4);
        orConditions.push({ phone: { $regex: last4 } });

        // 마지막 8자리로 검색 (전화번호 뒷부분)
        if (phoneDigits.length >= 8) {
          const last8 = phoneDigits.slice(-8);
          // 대시 포함 패턴으로 변환: 3051-1241 형태
          const pattern8 = last8.slice(0, 4) + '-?' + last8.slice(4);
          orConditions.push({ phone: { $regex: pattern8 } });
        }
      }

      query.$or = orConditions;
    }

    // 기간 필터 적용 (startDate/endDate가 없으면 period 사용)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    } else {
      const periodStartDate = getPeriodStartDate(period);
      if (periodStartDate) {
        query.createdAt = { $gte: periodStartDate };
      }
    }

    // 필요한 필드만 projection
    const projection = {
      _id: 1,
      name: 1,
      phone: 1,
      status: 1,
      temperature: 1,
      consultationType: 1,
      source: 1,
      interest: 1,
      'aiAnalysis.interest': 1,
      'aiAnalysis.summary': 1,
      createdAt: 1,
      lastContactAt: 1,
      nextAction: 1,
      nextActionDate: 1,
      nextActionNote: 1,
      statusChangedAt: 1,
      lastCallDirection: 1,
      age: 1,
      region: 1,
      // 금액 관련 필드
      estimatedAmount: 1,
      actualAmount: 1,
      paymentStatus: 1,
      treatmentNote: 1,
      // 치료 진행 관련 필드
      treatmentStartDate: 1,
      expectedCompletionDate: 1,
      // 여정(Journey) 관련 필드 (간소화된 정보만)
      'journeys.id': 1,
      'journeys.treatmentType': 1,
      'journeys.status': 1,
      'journeys.isActive': 1,
      activeJourneyId: 1,
    };

    // 병렬 쿼리
    const [patients, totalCount, allStats] = await Promise.all([
      collection
        .find(query, { projection })
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
      // 필터 통계 (전체 + 각 상태별)
      collection.aggregate([
        {
          $facet: {
            all: [{ $count: 'count' }],
            consulting: [{ $match: { status: 'consulting' } }, { $count: 'count' }],
            reserved: [{ $match: { status: 'reserved' } }, { $count: 'count' }],
            visited: [{ $match: { status: 'visited' } }, { $count: 'count' }],
            treatmentBooked: [{ $match: { status: 'treatmentBooked' } }, { $count: 'count' }],
            treatment: [{ $match: { status: 'treatment' } }, { $count: 'count' }],
            completed: [{ $match: { status: 'completed' } }, { $count: 'count' }],
            followup: [{ $match: { status: 'followup' } }, { $count: 'count' }],
            closed: [{ $match: { status: 'closed' } }, { $count: 'count' }],
          },
        },
      ]).toArray(),
    ]);

    // 필터 통계 정리
    const statsResult = allStats[0] as {
      all: Array<{ count: number }>;
      consulting: Array<{ count: number }>;
      reserved: Array<{ count: number }>;
      visited: Array<{ count: number }>;
      treatmentBooked: Array<{ count: number }>;
      treatment: Array<{ count: number }>;
      completed: Array<{ count: number }>;
      followup: Array<{ count: number }>;
      closed: Array<{ count: number }>;
    };

    const filterStats = {
      all: statsResult.all[0]?.count || 0,
      consulting: statsResult.consulting[0]?.count || 0,
      reserved: statsResult.reserved[0]?.count || 0,
      visited: statsResult.visited[0]?.count || 0,
      treatmentBooked: statsResult.treatmentBooked[0]?.count || 0,
      treatment: statsResult.treatment[0]?.count || 0,
      completed: statsResult.completed[0]?.count || 0,
      followup: statsResult.followup[0]?.count || 0,
      closed: statsResult.closed[0]?.count || 0,
    };

    // 체류일 및 긴급도 계산
    const now = new Date();

    // 기간 필터가 적용된 환자들의 긴급 통계 계산 (종결 환자 제외)
    const periodQuery: Record<string, unknown> = {
      clinicId,
      status: { $ne: 'closed' }
    };
    const periodStartDate = getPeriodStartDate(period);
    if (periodStartDate) {
      periodQuery.createdAt = { $gte: periodStartDate };
    }
    const allPatientsForUrgent = await collection.find(periodQuery, { projection }).toArray();
    let urgentStats = { noshow: 0, today: 0, overdue: 0 };

    allPatientsForUrgent.forEach((p) => {
      // 치료중 상태일 때는 treatmentStartDate 우선 사용
      let statusDate: Date;
      if (p.status === 'treatment' && p.treatmentStartDate) {
        statusDate = new Date(p.treatmentStartDate);
      } else {
        statusDate = p.statusChangedAt ? new Date(p.statusChangedAt) : new Date(p.createdAt);
      }
      const days = Math.floor((now.getTime() - statusDate.getTime()) / (1000 * 60 * 60 * 24));
      const urg = getUrgency(p.status, p.nextActionDate, days);
      if (urg === 'noshow') urgentStats.noshow++;
      else if (urg === 'today') urgentStats.today++;
      else if (urg === 'overdue') urgentStats.overdue++;
    });

    // 환자 데이터 매핑 (긴급도 포함)
    let mappedPatients = patients.map((p) => {
      // 치료중 상태일 때는 treatmentStartDate 우선 사용
      let statusDate: Date;
      if (p.status === 'treatment' && p.treatmentStartDate) {
        statusDate = new Date(p.treatmentStartDate);
      } else {
        statusDate = p.statusChangedAt ? new Date(p.statusChangedAt) : new Date(p.createdAt);
      }
      const daysInStatus = Math.floor((now.getTime() - statusDate.getTime()) / (1000 * 60 * 60 * 24));
      const patientUrgency = getUrgency(p.status, p.nextActionDate, daysInStatus);

      return {
        id: p._id.toString(),
        name: p.name,
        phone: p.phone,
        status: p.status,
        temperature: p.temperature,
        consultationType: p.consultationType || '',
        interest: p.interest || p.aiAnalysis?.interest || '',
        source: p.source || '',
        createdAt: p.createdAt,
        lastContactAt: p.lastContactAt,
        lastCallDirection: p.lastCallDirection || undefined,
        nextAction: p.nextAction || '',
        nextActionDate: p.nextActionDate || null,
        nextActionNote: p.nextActionNote || '',
        daysInStatus,
        urgency: patientUrgency,
        age: p.age || undefined,
        region: p.region || undefined,
        // 금액 관련 필드
        estimatedAmount: p.estimatedAmount || 0,
        actualAmount: p.actualAmount || 0,
        paymentStatus: p.paymentStatus || 'none',
        // 치료 진행 관련 필드
        expectedCompletionDate: p.expectedCompletionDate || null,
        // 여정(Journey) 관련 필드
        journeys: p.journeys?.map((j: { id: string; treatmentType: string; status: PatientStatus; isActive: boolean }) => ({
          id: j.id,
          treatmentType: j.treatmentType,
          status: j.status,
          isActive: j.isActive,
        })) || [],
        activeJourneyId: p.activeJourneyId || undefined,
      };
    });

    // 긴급 필터 적용 (클라이언트 사이드 필터링 - 페이지네이션 재계산 필요)
    if (urgency && urgency !== 'normal') {
      // 전체 환자를 긴급도 기준으로 필터링
      const allMapped = allPatientsForUrgent.map((p) => {
        // 치료중 상태일 때는 treatmentStartDate 우선 사용
        let statusDate: Date;
        if (p.status === 'treatment' && p.treatmentStartDate) {
          statusDate = new Date(p.treatmentStartDate);
        } else {
          statusDate = p.statusChangedAt ? new Date(p.statusChangedAt) : new Date(p.createdAt);
        }
        const days = Math.floor((now.getTime() - statusDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: p._id.toString(),
          name: p.name,
          phone: p.phone,
          status: p.status,
          temperature: p.temperature,
          consultationType: p.consultationType || '',
          interest: p.interest || p.aiAnalysis?.interest || '',
          source: p.source || '',
          createdAt: p.createdAt,
          lastContactAt: p.lastContactAt,
          lastCallDirection: p.lastCallDirection || undefined,
          nextAction: p.nextAction || '',
          nextActionDate: p.nextActionDate || null,
          nextActionNote: p.nextActionNote || '',
          daysInStatus: days,
          urgency: getUrgency(p.status, p.nextActionDate, days),
          age: p.age || undefined,
          region: p.region || undefined,
          // 금액 관련 필드
          estimatedAmount: p.estimatedAmount || 0,
          actualAmount: p.actualAmount || 0,
          paymentStatus: p.paymentStatus || 'none',
          // 치료 진행 관련 필드
          expectedCompletionDate: p.expectedCompletionDate || null,
          // 여정(Journey) 관련 필드
          journeys: p.journeys?.map((j: { id: string; treatmentType: string; status: PatientStatus; isActive: boolean }) => ({
            id: j.id,
            treatmentType: j.treatmentType,
            status: j.status,
            isActive: j.isActive,
          })) || [],
          activeJourneyId: p.activeJourneyId || undefined,
        };
      });

      const filtered = allMapped.filter((p) => p.urgency === urgency);
      const filteredTotal = filtered.length;
      const start = (page - 1) * limit;
      mappedPatients = filtered.slice(start, start + limit);

      return NextResponse.json({
        patients: mappedPatients,
        pagination: {
          page,
          limit,
          totalCount: filteredTotal,
          totalPages: Math.ceil(filteredTotal / limit),
        },
        filterStats,
        urgentStats,
      });
    }

    return NextResponse.json({
      patients: mappedPatients,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      filterStats,
      urgentStats,
    });
  } catch (error) {
    log.error('Failed to fetch patients', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch patients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createRouteLogger('/api/v2/patients', 'POST');
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const body = await request.json();
    const validation = validateBody(createPatientSchema, body);
    if (!validation.success) return validation.response;
    const { name, phone, consultationType, interest, source, temperature = 'warm', nextAction, age, region } = validation.data;

    const { db } = await connectToDatabase();
    const collection = db.collection('patients_v2');

    // 중복 체크
    const existing = await collection.findOne({ phone, clinicId });
    if (existing) {
      return NextResponse.json(
        { error: 'Patient with this phone number already exists', patientId: existing._id.toString() },
        { status: 409 }
      );
    }

    const now = new Date();
    const journeyId = new ObjectId().toString();
    const treatmentType = interest || '일반진료';

    // 첫 번째 여정 생성
    const firstJourney: Journey = {
      id: journeyId,
      treatmentType,
      status: 'consulting' as PatientStatus,
      startedAt: now,
      paymentStatus: 'none',
      statusHistory: [{
        from: 'consulting' as PatientStatus,
        to: 'consulting' as PatientStatus,
        eventDate: now,
        changedAt: now,
        changedBy: '시스템',
      }],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const newPatient: Record<string, unknown> = {
      clinicId,
      name,
      phone,
      status: 'consulting' as PatientStatus,
      temperature: temperature as Temperature,
      consultationType: consultationType || '',
      source: source || '',
      interest: treatmentType,
      aiAnalysis: {
        interest: interest || '',
        summary: '',
        classification: 'new_patient',
      },
      // Journey 시스템
      journeys: [firstJourney],
      activeJourneyId: journeyId,
      // 시간 필드
      createdAt: now,
      updatedAt: now,
      lastContactAt: now,
      statusChangedAt: now,
      nextAction: nextAction || '',
    };

    // 나이 추가 (입력된 경우)
    if (age && typeof age === 'number' && age > 0) {
      newPatient.age = age;
    }

    // 지역 추가 (시/도가 선택된 경우)
    if (region && region.province) {
      newPatient.region = {
        province: region.province,
        city: region.city || undefined,
      };
    }

    const result = await collection.insertOne(newPatient);
    const patientId = result.insertedId.toString();

    // 같은 전화번호의 모든 통화기록에 patientId 연결
    try {
      const callLogUpdateResult = await db.collection('callLogs_v2').updateMany(
        { phone: phone, clinicId },
        { $set: { patientId: patientId } }
      );
      console.log(`[Patient POST] 통화기록 patientId 연결: ${callLogUpdateResult.modifiedCount}건 (전화번호: ${phone}, patientId: ${patientId})`);
    } catch (callLogError) {
      console.error('[Patient POST] 통화기록 patientId 연결 실패:', callLogError);
      // 통화기록 업데이트 실패해도 환자 등록은 성공했으므로 계속 진행
    }

    return NextResponse.json({
      success: true,
      patientId: patientId,
    });
  } catch (error) {
    log.error('Failed to create patient', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create patient' },
      { status: 500 }
    );
  }
}
