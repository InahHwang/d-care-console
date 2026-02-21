// src/app/api/v2/seed/route.ts
// v2 테스트 데이터 생성 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import type { PatientV2, CallLogV2, ConsultationV2, CallbackV2, ReferralV2, Temperature, PatientStatus, CallbackType } from '@/types/v2';

// 랜덤 선택 헬퍼
function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 랜덤 전화번호 생성
function randomPhone(): string {
  const mid = Math.floor(1000 + Math.random() * 9000);
  const last = Math.floor(1000 + Math.random() * 9000);
  return `010-${mid}-${last}`;
}

// 랜덤 날짜 (최근 N일 이내)
function randomDate(daysBack: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return past;
}

// 오늘 날짜의 랜덤 시간
function todayRandomTime(): Date {
  const now = new Date();
  now.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
  return now;
}

const NAMES = ['김민수', '이영희', '박철수', '정미영', '최준호', '강수진', '윤태호', '임서연', '한지원', '오민석',
               '송혜진', '장동건', '유재석', '김태희', '이민호', '박보영', '조인성', '전지현', '공유', '손예진'];

const INTERESTS = ['임플란트', '교정', '충치치료', '스케일링', '검진', '미백', '크라운', '브릿지', '틀니', '신경치료'];

const SOURCES = ['네이버', '카카오', '인스타그램', '지인소개', '재방문', '전화문의', '방문상담'];

const STATUSES: PatientStatus[] = ['consulting', 'reserved', 'visited', 'treatmentBooked', 'treatment', 'completed', 'followup'];

const TEMPERATURES: Temperature[] = ['hot', 'warm', 'cold'];

// 신환/구신환만 환자등록 대상
const CLASSIFICATIONS = ['신환', '구신환', '구환', '부재중', '거래처', '스팸', '기타'] as const;
const REGISTRABLE_CLASSIFICATIONS = ['신환', '구신환'] as const;

const SUMMARIES = [
  '임플란트 상담 문의. 앞니 2개 빠진 상태로 가격과 기간 문의함. 다음주 내원 예정.',
  '교정 상담. 성인 교정 관심 있으며 투명교정 선호. 비용 부담 언급.',
  '스케일링 예약 문의. 1년만에 방문 예정. 오후 시간대 선호.',
  '충치 치료 문의. 통증 있어 빠른 예약 원함. 내일 오전 가능 여부 확인.',
  '검진 예약 요청. 정기 검진 목적. 주말 가능 여부 문의.',
  '미백 상담. 결혼 전 미백 원함. 기간과 효과 문의.',
  '틀니 수리 요청. 기존 틀니 불편함 호소. 조정 필요.',
  '재예약 문의. 지난번 치료 후 불편함 있음. 확인 필요.',
];

const DISAGREE_REASONS = [
  '예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨',
  '치료 계획 이견', '치료 기간 부담', '가족 상의 필요', '타 병원 비교 중'
];

// 상태별 nextAction 및 nextActionDate 생성 헬퍼
// 퍼널: 전화상담 → 내원예약 → 내원완료 → 치료예약 → 치료중 → 치료완료 → 사후관리
function getNextActionInfo(status: PatientStatus, forceScenario?: 'today' | 'noshow' | 'overdue'): { nextAction?: string; nextActionDate?: Date; statusChangedDaysAgo?: number } {
  const today = () => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  };
  const futureDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d;
  };
  const pastDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d;
  };

  // 강제 시나리오가 있으면 해당 시나리오로
  if (forceScenario === 'today') {
    // 오늘 예정 (D-Day)
    switch (status) {
      case 'consulting': return { nextAction: '콜백', nextActionDate: today() };
      case 'reserved': return { nextAction: '내원', nextActionDate: today() };
      case 'treatmentBooked': return { nextAction: '치료', nextActionDate: today() };
      case 'treatment': return { nextAction: '다음치료', nextActionDate: today() };
      case 'followup': return { nextAction: '리콜', nextActionDate: today() };
      default: return {};
    }
  }

  if (forceScenario === 'noshow') {
    // 노쇼/지연 (+N일)
    switch (status) {
      case 'consulting': return { nextAction: '콜백', nextActionDate: pastDate(Math.floor(Math.random() * 3) + 1) };
      case 'reserved': return { nextAction: '내원', nextActionDate: pastDate(Math.floor(Math.random() * 3) + 1) };
      case 'treatmentBooked': return { nextAction: '치료', nextActionDate: pastDate(Math.floor(Math.random() * 5) + 1) };
      case 'treatment': return { nextAction: '다음치료', nextActionDate: pastDate(Math.floor(Math.random() * 7) + 1) };
      case 'followup': return { nextAction: '리콜', nextActionDate: pastDate(Math.floor(Math.random() * 30) + 1) };
      default: return {};
    }
  }

  if (forceScenario === 'overdue') {
    // 장기 방치 (임계값 초과, nextActionDate 없음)
    switch (status) {
      case 'consulting': return { statusChangedDaysAgo: 10 + Math.floor(Math.random() * 5) }; // 10~14일
      case 'visited': return { statusChangedDaysAgo: 10 + Math.floor(Math.random() * 10) }; // 10~19일
      case 'treatment': return { statusChangedDaysAgo: 35 + Math.floor(Math.random() * 20) }; // 35~54일
      case 'followup': return { statusChangedDaysAgo: 100 + Math.floor(Math.random() * 50) }; // 100~149일
      default: return {};
    }
  }

  // 랜덤하게 일부는 nextActionDate 없이, 일부는 미래, 일부는 과거로
  const scenario = Math.random();

  switch (status) {
    case 'consulting':
      // 전화상담: 콜백 예정
      if (scenario < 0.4) return { nextAction: '콜백', nextActionDate: futureDate(Math.floor(Math.random() * 5) + 1) }; // D-1~5
      if (scenario < 0.7) return { nextAction: '콜백', nextActionDate: pastDate(Math.floor(Math.random() * 3) + 1) }; // +1~3일
      return { nextAction: '콜백' }; // nextActionDate 없음 → N일째 표시
    case 'reserved':
      // 내원예약: 내원 예정일
      if (scenario < 0.6) return { nextAction: '내원', nextActionDate: futureDate(Math.floor(Math.random() * 14) + 1) }; // D-1~14
      return { nextAction: '내원', nextActionDate: pastDate(Math.floor(Math.random() * 3) + 1) }; // +1~3일 (노쇼)
    case 'visited':
      // 내원완료(상담완료): 치료예약 유도 필요 → nextActionDate 없음 → N일째 표시
      return {}; // 치료예약 잡아야 함
    case 'treatmentBooked':
      // 치료예약: 치료 시작 예정일
      if (scenario < 0.6) return { nextAction: '치료', nextActionDate: futureDate(Math.floor(Math.random() * 14) + 1) }; // D-1~14
      return { nextAction: '치료', nextActionDate: pastDate(Math.floor(Math.random() * 5) + 1) }; // +1~5일 (노쇼)
    case 'treatment':
      // 치료중: 다음 치료 예약
      if (scenario < 0.5) return { nextAction: '다음치료', nextActionDate: futureDate(Math.floor(Math.random() * 21) + 7) };
      if (scenario < 0.8) return { nextAction: '다음치료', nextActionDate: pastDate(Math.floor(Math.random() * 7) + 1) };
      return {}; // 예약 안 잡힘 → N일째 표시
    case 'completed':
      // 치료완료: 리콜 유도 필요 → nextActionDate 없음 → N일째 표시
      return {};
    case 'followup':
      // 사후관리: 리콜 예정
      if (scenario < 0.5) return { nextAction: '리콜', nextActionDate: futureDate(Math.floor(Math.random() * 90) + 30) };
      if (scenario < 0.8) return { nextAction: '리콜', nextActionDate: pastDate(Math.floor(Math.random() * 30) + 1) };
      return {}; // N일째 표시
    default:
      return {};
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 기존 v2 데이터 삭제 (선택적)
    const { searchParams } = new URL(request.url);
    const clearExisting = searchParams.get('clear') === 'true';

    if (clearExisting) {
      await db.collection('patients_v2').deleteMany({});
      await db.collection('callLogs_v2').deleteMany({});
      await db.collection('consultations_v2').deleteMany({});
      await db.collection('callbacks_v2').deleteMany({});
      await db.collection('referrals_v2').deleteMany({});
      console.log('[Seed] 기존 v2 데이터 삭제 완료');
    }

    // 1. 환자 데이터 생성 (35명 - 각 상태별 다양한 시나리오)
    const patients: Array<Omit<PatientV2, '_id'>> = [];

    // 상태별 명시적 테스트 케이스 정의
    interface TestCase {
      status: PatientStatus;
      scenario: 'today' | 'noshow' | 'overdue' | 'normal';
      description: string;
    }

    const testCases: TestCase[] = [
      // 1. 전화상담 (consulting) - 5명
      { status: 'consulting', scenario: 'today', description: '오늘 콜백 예정' },
      { status: 'consulting', scenario: 'noshow', description: '콜백 놓침' },
      { status: 'consulting', scenario: 'overdue', description: '10일째 방치' },
      { status: 'consulting', scenario: 'normal', description: 'D-3 콜백' },
      { status: 'consulting', scenario: 'normal', description: '일반 상담중' },

      // 2. 내원예약 (reserved) - 5명
      { status: 'reserved', scenario: 'today', description: '오늘 내원 예정' },
      { status: 'reserved', scenario: 'noshow', description: '노쇼 +2일' },
      { status: 'reserved', scenario: 'normal', description: 'D-5 내원 예정' },
      { status: 'reserved', scenario: 'normal', description: 'D-1 내원 예정' },
      { status: 'reserved', scenario: 'normal', description: 'D-7 내원 예정' },

      // 3. 내원완료 (visited) - 5명
      { status: 'visited', scenario: 'overdue', description: '12일째 치료예약 미정' },
      { status: 'visited', scenario: 'overdue', description: '8일째 결정 보류' },
      { status: 'visited', scenario: 'normal', description: '3일째 상담완료' },
      { status: 'visited', scenario: 'normal', description: '1일째 상담완료' },
      { status: 'visited', scenario: 'normal', description: '5일째 고민중' },

      // 4. 치료예약 (treatmentBooked) - 5명
      { status: 'treatmentBooked', scenario: 'today', description: '오늘 치료 시작' },
      { status: 'treatmentBooked', scenario: 'noshow', description: '치료 노쇼 +3일' },
      { status: 'treatmentBooked', scenario: 'normal', description: 'D-7 치료 예정' },
      { status: 'treatmentBooked', scenario: 'normal', description: 'D-2 치료 예정' },
      { status: 'treatmentBooked', scenario: 'normal', description: 'D-14 치료 예정' },

      // 5. 치료중 (treatment) - 5명
      { status: 'treatment', scenario: 'today', description: '오늘 다음 치료' },
      { status: 'treatment', scenario: 'noshow', description: '치료 지연 +5일' },
      { status: 'treatment', scenario: 'overdue', description: '40일째 치료중' },
      { status: 'treatment', scenario: 'normal', description: 'D-14 다음 치료' },
      { status: 'treatment', scenario: 'normal', description: '정상 진행중' },

      // 6. 치료완료 (completed) - 5명
      { status: 'completed', scenario: 'normal', description: '7일째 완료' },
      { status: 'completed', scenario: 'normal', description: '30일째 완료' },
      { status: 'completed', scenario: 'normal', description: '14일째 완료' },
      { status: 'completed', scenario: 'normal', description: '3일째 완료' },
      { status: 'completed', scenario: 'normal', description: '60일째 완료' },

      // 7. 사후관리 (followup) - 5명
      { status: 'followup', scenario: 'today', description: '오늘 리콜 예정' },
      { status: 'followup', scenario: 'noshow', description: '리콜 놓침 +10일' },
      { status: 'followup', scenario: 'overdue', description: '120일째 연락없음' },
      { status: 'followup', scenario: 'normal', description: 'D-30 리콜 예정' },
      { status: 'followup', scenario: 'normal', description: 'D-60 리콜 예정' },
    ];

    const MEMOS = [
      '비용 부담 있어 할부 문의함. 카드 3개월 무이자 안내함.',
      '직장인이라 주말 예약 선호. 토요일 오전 가능 여부 확인 필요.',
      '타 병원에서 받은 견적과 비교 중. 경쟁 병원 가격 확인 필요.',
      '가족과 상의 후 결정한다고 함. 1주일 후 연락 예정.',
      '통증 심해서 빠른 치료 원함. 우선 예약 필요.',
      '',
      '',
      '',
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const { status, scenario, description } = testCase;

      const createdAt = randomDate(60);
      const actionInfo = scenario === 'normal'
        ? getNextActionInfo(status)
        : getNextActionInfo(status, scenario);

      const { nextAction, nextActionDate, statusChangedDaysAgo } = actionInfo;

      // statusChangedAt 계산: overdue인 경우 강제로 오래된 날짜
      let statusChangedAt: Date;
      if (statusChangedDaysAgo) {
        statusChangedAt = new Date();
        statusChangedAt.setDate(statusChangedAt.getDate() - statusChangedDaysAgo);
      } else if (status === 'completed') {
        // 치료완료는 description에서 일수 추출
        const daysMatch = description.match(/(\d+)일째/);
        const days = daysMatch ? parseInt(daysMatch[1]) : 7;
        statusChangedAt = new Date();
        statusChangedAt.setDate(statusChangedAt.getDate() - days);
      } else {
        statusChangedAt = randomDate(7);
      }

      patients.push({
        clinicId: 'default',
        name: NAMES[i % NAMES.length],
        phone: randomPhone(),
        gender: randomPick(['남', '여']),
        age: 25 + Math.floor(Math.random() * 40),
        region: randomPick(['서울', '경기', '인천', '부산', '대구']),
        status,
        statusChangedAt,
        temperature: randomPick(TEMPERATURES),
        interest: randomPick(INTERESTS),
        interestDetail: `${randomPick(INTERESTS)} 관련 상담`,
        source: randomPick(SOURCES),
        aiRegistered: Math.random() > 0.3,
        aiConfidence: 0.7 + Math.random() * 0.3,
        nextAction,
        nextActionDate,
        lastCallDirection: randomPick(['inbound', 'outbound'] as const),
        lastContactAt: randomDate(14),
        memo: randomPick(MEMOS),
        callCount: Math.floor(Math.random() * 5) + 1,
        createdAt,
        updatedAt: now,
      });
    }

    const patientResult = await db.collection('patients_v2').insertMany(patients);
    const patientIds = Object.values(patientResult.insertedIds).map(id => id.toString());
    console.log(`[Seed] 환자 ${patientIds.length}명 생성 완료`);

    // 2. 오늘의 통화 기록 생성 (21건 - 각 분류별 3건씩)
    const callLogs: Array<Omit<CallLogV2, '_id'>> = [];

    // 각 분류별로 균등하게 생성
    for (let i = 0; i < 21; i++) {
      const classification = CLASSIFICATIONS[i % 7]; // 7개 분류를 순환
      const isConnected = classification !== '부재중'; // 부재중이 아니면 연결됨
      const patientId = randomPick(patientIds);
      const patient = patients[patientIds.indexOf(patientId)];

      // 신환/구신환만 환자 등록됨 (patientId 연결)
      const isRegistrable = REGISTRABLE_CLASSIFICATIONS.includes(classification as typeof REGISTRABLE_CLASSIFICATIONS[number]);
      const shouldRegister = isRegistrable && Math.random() > 0.3; // 70%는 등록됨

      const callLog: Omit<CallLogV2, '_id'> = {
        clinicId: 'default',
        phone: patient?.phone || randomPhone(),
        patientId: shouldRegister ? patientId : undefined,
        direction: randomPick(['inbound', 'outbound']),
        status: isConnected ? 'connected' : 'missed',
        duration: isConnected ? 30 + Math.floor(Math.random() * 300) : 0,
        startedAt: todayRandomTime(),
        endedAt: now,
        aiStatus: 'completed',
        aiAnalysis: {
          classification: classification,
          patientName: classification === '거래처' ? '○○의료기기' :
                       ['스팸', '기타'].includes(classification) ? undefined : patient?.name,
          interest: ['거래처', '스팸', '부재중', '기타'].includes(classification) ? undefined : randomPick(INTERESTS),
          temperature: randomPick(TEMPERATURES),
          summary: classification === '거래처' ? '의료기기 영업 전화. 임플란트 픽스처 신제품 소개.' :
                   classification === '스팸' ? '광고성 전화. 대출 상품 안내.' :
                   classification === '부재중' ? '통화 연결 안됨. 재시도 필요.' :
                   classification === '기타' ? '분류 불가 통화. 내용 확인 필요.' :
                   randomPick(SUMMARIES),
          followUp: classification === '부재중' ? '콜백필요' :
                    ['거래처', '스팸', '기타'].includes(classification) ? '종결' :
                    randomPick(['콜백필요', '예약확정', '종결']),
          concerns: [],
          confidence: 0.8 + Math.random() * 0.2,
        },
        aiCompletedAt: now.toISOString(),
        createdAt: todayRandomTime().toISOString(),
      };

      callLogs.push(callLog);
    }

    // 과거 통화 기록 (30건)
    for (let i = 0; i < 30; i++) {
      const classification = randomPick(CLASSIFICATIONS);
      const isConnected = classification !== '부재중';
      const patientId = randomPick(patientIds);
      const patient = patients[patientIds.indexOf(patientId)];
      const callTime = randomDate(14);

      // 신환/구신환만 환자 등록됨
      const isRegistrable = REGISTRABLE_CLASSIFICATIONS.includes(classification as typeof REGISTRABLE_CLASSIFICATIONS[number]);
      const shouldRegister = isRegistrable && Math.random() > 0.3;

      callLogs.push({
        clinicId: 'default',
        phone: patient?.phone || randomPhone(),
        patientId: shouldRegister ? patientId : undefined,
        direction: randomPick(['inbound', 'outbound']),
        status: isConnected ? 'connected' : 'missed',
        duration: isConnected ? 30 + Math.floor(Math.random() * 300) : 0,
        startedAt: callTime,
        endedAt: callTime,
        aiStatus: 'completed',
        aiAnalysis: {
          classification,
          patientName: classification === '거래처' ? '△△메디칼' :
                       classification === '스팸' ? undefined : patient?.name,
          interest: ['거래처', '스팸', '부재중'].includes(classification) ? undefined : randomPick(INTERESTS),
          temperature: randomPick(TEMPERATURES),
          summary: randomPick(SUMMARIES),
          followUp: randomPick(['콜백필요', '예약확정', '종결']),
          concerns: [],
          confidence: 0.8 + Math.random() * 0.2,
        },
        createdAt: callTime.toISOString(),
      });
    }

    await db.collection('callLogs_v2').insertMany(callLogs);
    console.log(`[Seed] 통화기록 ${callLogs.length}건 생성 완료`);

    // 3. 상담 기록 생성 (10건)
    const consultations: Array<Omit<ConsultationV2, '_id'>> = [];
    for (let i = 0; i < 10; i++) {
      const patientId = patientIds[i];
      const patient = patients[i];
      const status = randomPick(['agreed', 'disagreed', 'pending'] as const);
      const originalAmount = (50 + Math.floor(Math.random() * 450)) * 10000; // 50~500만원
      const discountRate = Math.floor(Math.random() * 20); // 0~20%
      const discountAmount = Math.floor(originalAmount * discountRate / 100);

      consultations.push({
        clinicId: 'default',
        patientId,
        type: randomPick(['phone', 'visit'] as const),  // 상담 유형 추가
        date: randomDate(7),
        treatment: patient.interest || randomPick(INTERESTS),
        originalAmount,
        discountRate,
        discountAmount,
        finalAmount: originalAmount - discountAmount,
        discountReason: discountRate > 0 ? randomPick(['첫 방문 할인', '소개 할인', '이벤트']) : undefined,
        status,
        disagreeReasons: status === 'disagreed' ? [randomPick(DISAGREE_REASONS), randomPick(DISAGREE_REASONS)] : undefined,
        correctionPlan: status === 'disagreed' ? '재상담 예정' : undefined,
        appointmentDate: status === 'agreed' ? randomDate(-7) : undefined,
        callbackDate: status === 'pending' ? randomDate(-3) : undefined,
        consultantName: randomPick(['김상담', '이상담', '박상담']),
        aiSummary: randomPick(SUMMARIES),
        createdAt: randomDate(7),
      });
    }

    await db.collection('consultations_v2').insertMany(consultations);
    console.log(`[Seed] 상담기록 ${consultations.length}건 생성 완료`);

    // 4. 콜백/리콜 일정 생성 (20건)
    const callbacks: Array<Omit<CallbackV2, '_id'>> = [];

    // 오늘 콜백 6건 (대기/완료/미연결 혼합)
    const todayCallbackData = [
      { name: '김민수', time: [9, 0], status: 'pending', note: '임플란트 가격 재문의' },
      { name: '이영희', time: [10, 30], status: 'pending', note: '교정 상담 후속 연락' },
      { name: '박철수', time: [11, 0], status: 'pending', note: '충치 치료 예약 확정 필요' },
      { name: '정미영', time: [13, 30], status: 'pending', note: '스케일링 예약 확인' },
      { name: '최준호', time: [14, 0], status: 'completed', note: '상담 완료 - 다음주 내원 확정' },
      { name: '강수진', time: [15, 30], status: 'missed', note: '3회 부재중' },
    ];

    for (let i = 0; i < todayCallbackData.length; i++) {
      const data = todayCallbackData[i];
      const patientId = patientIds[i % patientIds.length];

      const scheduledDate = new Date(today);
      scheduledDate.setHours(data.time[0], data.time[1], 0, 0);

      callbacks.push({
        clinicId: 'default',
        patientId,
        type: 'callback',
        scheduledAt: scheduledDate,
        status: data.status as 'pending' | 'completed' | 'missed',
        note: data.note,
        completedAt: data.status === 'completed' ? now.toISOString() : undefined,
        createdAt: now.toISOString(),
      });
    }

    // 추가 콜백 (과거/미래 분포)
    for (let i = 6; i < 20; i++) {
      const patientId = patientIds[i % patientIds.length];
      const type: CallbackType = i % 3 === 0 ? 'callback' : i % 3 === 1 ? 'recall' : 'thanks';

      // -3일 ~ +7일 사이의 일정 (오늘 제외)
      let dayOffset = Math.floor(Math.random() * 10) - 3;
      if (dayOffset === 0) dayOffset = 1; // 오늘은 이미 위에서 생성했으므로 제외

      const scheduledDate = new Date(today);
      scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
      scheduledDate.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 4) * 15, 0, 0);

      const isPast = dayOffset < 0;
      const status = isPast
        ? (Math.random() > 0.3 ? 'completed' : 'missed')
        : 'pending';

      callbacks.push({
        clinicId: 'default',
        patientId,
        type,
        scheduledAt: scheduledDate,
        status,
        note: type === 'callback'
          ? '상담 후속 연락 필요'
          : type === 'recall'
          ? '정기 검진 리콜'
          : '소개 감사 인사',
        completedAt: status === 'completed' ? now.toISOString() : undefined,
        createdAt: now.toISOString(),
      });
    }

    await db.collection('callbacks_v2').insertMany(callbacks);
    console.log(`[Seed] 콜백/리콜 ${callbacks.length}건 생성 완료`);

    // 5. 소개 관계 생성 (5건)
    const referrals: Array<Omit<ReferralV2, '_id'>> = [];

    for (let i = 0; i < 5; i++) {
      const referrerId = patientIds[i];
      const referredId = patientIds[i + 10]; // 다른 환자를 피소개자로

      referrals.push({
        clinicId: 'default',
        referrerId,
        referredId,
        thanksSent: Math.random() > 0.5,
        thanksSentAt: Math.random() > 0.5 ? randomDate(7).toISOString() : undefined,
        createdAt: randomDate(14).toISOString(),
      });
    }

    await db.collection('referrals_v2').insertMany(referrals);
    console.log(`[Seed] 소개관계 ${referrals.length}건 생성 완료`);

    return NextResponse.json({
      success: true,
      message: 'Test data created successfully',
      data: {
        patients: patientIds.length,
        callLogs: callLogs.length,
        consultations: consultations.length,
        callbacks: callbacks.length,
        referrals: referrals.length,
      },
    });
  } catch (error) {
    console.error('[Seed] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create test data' },
      { status: 500 }
    );
  }
}

// GET - 현재 v2 데이터 상태 확인
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const { db } = await connectToDatabase();

    const [patientsCount, callLogsCount, consultationsCount, callbacksCount, referralsCount] = await Promise.all([
      db.collection('patients_v2').countDocuments(),
      db.collection('callLogs_v2').countDocuments(),
      db.collection('consultations_v2').countDocuments(),
      db.collection('callbacks_v2').countDocuments(),
      db.collection('referrals_v2').countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        patients_v2: patientsCount,
        callLogs_v2: callLogsCount,
        consultations_v2: consultationsCount,
        callbacks_v2: callbacksCount,
        referrals_v2: referralsCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to check data' },
      { status: 500 }
    );
  }
}
