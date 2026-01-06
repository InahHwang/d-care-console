// src/app/api/test/seed/route.ts
// 테스트 데이터 생성 API

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { PatientV2, ResultReason, CallbackResult, CallbackRecord } from '@/types/patientV2';

const TEST_COLLECTION = 'patients_v2_test';

// 샘플 데이터
const SAMPLE_LAST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const SAMPLE_FIRST_NAMES_M = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '현우', '도현', '건우', '우진', '선우', '민재', '현준', '연우', '유준', '정우'];
const SAMPLE_FIRST_NAMES_F = ['서연', '서윤', '지우', '서현', '민서', '하은', '하윤', '윤서', '지유', '채원', '수아', '지아', '지민', '수빈', '소율', '예은', '시은', '지원', '예서', '소연'];
const SAMPLE_SERVICES = ['임플란트', '교정', '충치치료', '잇몸치료', '미백', '스케일링', '보철', '발치'];
const SAMPLE_SOURCES = ['네이버', '굿닥', '강남언니', '지인소개', '재방문', '인스타그램', '블로그', '기타'];
const RESULT_REASONS: ResultReason[] = ['예산초과', '분납조건불가', '치료계획이견', '치료거부', '치료기간부담', '가족상의필요', '타병원비교', '추가정보필요', '일정조율어려움', '치료두려움', '연락두절'];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomChoices<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  return `010-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;
}

function randomName(gender: '남' | '여'): string {
  const lastName = randomChoice(SAMPLE_LAST_NAMES);
  const firstName = gender === '남'
    ? randomChoice(SAMPLE_FIRST_NAMES_M)
    : randomChoice(SAMPLE_FIRST_NAMES_F);
  return lastName + firstName;
}

function randomTeeth(): number[] {
  const count = randomInt(1, 4);
  const teeth: number[] = [];
  const allTeeth = [11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28,
                    31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48];
  for (let i = 0; i < count; i++) {
    const tooth = randomChoice(allTeeth);
    if (!teeth.includes(tooth)) teeth.push(tooth);
  }
  return teeth.sort((a, b) => a - b);
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function getRandomPastDate(maxDaysAgo: number): string {
  return getDateDaysAgo(randomInt(0, maxDaysAgo));
}

// POST: 테스트 데이터 생성
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const testPatients: Omit<PatientV2, '_id'>[] = [];

    // === 상담관리 환자 (visitConfirmed: false) ===

    // 1. 신규 환자 - 15명
    for (let i = 0; i < 15; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(7);
      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(20, 70),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: randomChoice(['인바운드', '아웃바운드']),
        visitConfirmed: false,
        firstVisitDate: null,
        phase: '전화상담',
        currentStatus: '신규',
        result: null,
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: Math.random() > 0.2 ? randomTeeth() : [],
          teethUnknown: Math.random() < 0.15,
          interestedServices: randomChoices(SAMPLE_SERVICES, randomInt(1, 3)),
          consultationNotes: randomChoice(['상담 문의', '가격 문의', '치료 기간 문의', '예약 문의', '']),
          estimatedAmount: randomInt(50, 800) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [],
        postVisitCallbacks: [],
        postVisitConsultation: null,
        statusHistory: [{
          date: callDate,
          time: `${randomInt(9, 18).toString().padStart(2, '0')}:${randomInt(0, 59).toString().padStart(2, '0')}`,
          fromPhase: '전화상담',
          toPhase: '전화상담',
          fromStatus: null,
          toStatus: '신규',
          changedBy: 'test-user',
          note: '환자 등록'
        }],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 2. 콜백 필요/부재중 환자 - 12명
    for (let i = 0; i < 12; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(14);
      const callbackCount = randomInt(1, 3);
      const callbacks: CallbackRecord[] = [];
      const currentStatus = randomChoice(['콜백필요', '부재중']) as '콜백필요' | '부재중';

      for (let j = 0; j < callbackCount; j++) {
        const result: CallbackResult = j === callbackCount - 1
          ? (currentStatus === '부재중' ? '부재중' : '콜백재요청')
          : randomChoice(['통화완료', '부재중', '콜백재요청'] as CallbackResult[]);
        callbacks.push({
          attempt: j + 1,
          date: getDateDaysAgo(14 - j * 2),
          time: `${randomInt(9, 18).toString().padStart(2, '0')}:${randomInt(0, 59).toString().padStart(2, '0')}`,
          result,
          notes: randomChoice(['다시 연락 예정', '고민 중', '가족과 상의 필요', '시간 없음', '']),
          counselorId: 'test-user',
          createdAt: now
        });
      }

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(25, 65),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: false,
        firstVisitDate: null,
        phase: '전화상담',
        currentStatus,
        result: null,
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: randomChoices(SAMPLE_SERVICES, randomInt(1, 2)),
          consultationNotes: '상담 진행 중',
          estimatedAmount: randomInt(100, 600) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: callbacks,
        postVisitCallbacks: [],
        postVisitConsultation: null,
        statusHistory: [
          { date: callDate, time: '09:00', fromPhase: '전화상담', toPhase: '전화상담', fromStatus: null, toStatus: '신규', changedBy: 'test-user', note: '환자 등록' },
          { date: today, time: '10:30', fromPhase: '전화상담', toPhase: '전화상담', fromStatus: '신규', toStatus: currentStatus, changedBy: 'test-user', note: `${callbackCount}차 콜백` }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 3. 잠재고객 - 8명
    for (let i = 0; i < 8; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(30);
      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(30, 60),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: false,
        firstVisitDate: null,
        phase: '전화상담',
        currentStatus: '잠재고객',
        result: null,
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: randomChoices(SAMPLE_SERVICES, 2),
          consultationNotes: '추후 연락 예정',
          estimatedAmount: randomInt(200, 500) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [
          { attempt: 1, date: callDate, time: '11:00', result: '보류' as CallbackResult, notes: '시간이 안 맞아서 나중에 연락하기로', counselorId: 'test-user', createdAt: now }
        ],
        postVisitCallbacks: [],
        postVisitConsultation: null,
        statusHistory: [
          { date: callDate, time: '09:00', fromPhase: '전화상담', toPhase: '전화상담', fromStatus: null, toStatus: '신규', changedBy: 'test-user', note: '환자 등록' },
          { date: callDate, time: '11:00', fromPhase: '전화상담', toPhase: '전화상담', fromStatus: '신규', toStatus: '잠재고객', changedBy: 'test-user', note: '잠재고객 전환' }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 4. 예약확정 환자 - 10명
    for (let i = 0; i < 10; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(10);
      const reservationDate = getDateDaysAgo(randomInt(-3, 3)); // 과거~미래 3일 내

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(25, 55),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: false,
        firstVisitDate: null,
        phase: '예약확정',
        currentStatus: null,
        result: null,
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: randomChoices(SAMPLE_SERVICES, randomInt(1, 2)),
          consultationNotes: '예약 완료',
          estimatedAmount: randomInt(150, 500) * 10000,
          consultationDate: callDate
        },
        reservation: {
          date: reservationDate,
          time: `${randomInt(9, 17).toString().padStart(2, '0')}:${randomChoice(['00', '30'])}`,
          type: randomChoice(['초진', '재진']),
          notes: '',
          confirmedAt: now,
          confirmedBy: 'test-user'
        },
        preVisitCallbacks: [
          { attempt: 1, date: callDate, time: '10:00', result: '예약확정' as CallbackResult, notes: '예약 확정', counselorId: 'test-user', createdAt: now }
        ],
        postVisitCallbacks: [],
        postVisitConsultation: null,
        statusHistory: [
          { date: callDate, time: '09:00', fromPhase: '전화상담', toPhase: '전화상담', fromStatus: null, toStatus: '신규', changedBy: 'test-user', note: '환자 등록' },
          { date: callDate, time: '10:00', fromPhase: '전화상담', toPhase: '예약확정', fromStatus: '신규', toStatus: null, changedBy: 'test-user', note: '예약 확정' }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 5. 예약취소/노쇼 환자 - 5명
    for (let i = 0; i < 5; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(20);
      const status = randomChoice(['예약취소', '노쇼']) as '예약취소' | '노쇼';

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(28, 60),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: false,
        firstVisitDate: null,
        phase: '전화상담',
        currentStatus: status,
        result: null,
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: [randomChoice(SAMPLE_SERVICES)],
          consultationNotes: status === '예약취소' ? '예약 취소됨' : '노쇼',
          estimatedAmount: randomInt(100, 400) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [
          { attempt: 1, date: callDate, time: '11:00', result: (status === '예약취소' ? '예약취소' : '부재중') as CallbackResult, notes: status === '예약취소' ? '환자 사정으로 취소' : '연락 안됨', counselorId: 'test-user', createdAt: now }
        ],
        postVisitCallbacks: [],
        postVisitConsultation: null,
        statusHistory: [
          { date: callDate, time: '09:00', fromPhase: '전화상담', toPhase: '예약확정', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '예약 확정' },
          { date: today, time: '11:00', fromPhase: '예약확정', toPhase: '전화상담', fromStatus: null, toStatus: status, changedBy: 'test-user', note: status }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // === 내원관리 환자 (visitConfirmed: true) ===

    // 6. 내원완료 - 재콜백필요 - 8명
    for (let i = 0; i < 8; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(14);
      const visitDate = getRandomPastDate(7);
      const callbackCount = randomInt(1, 2);
      const postCallbacks: CallbackRecord[] = [];

      for (let j = 0; j < callbackCount; j++) {
        postCallbacks.push({
          attempt: j + 1,
          date: getDateDaysAgo(7 - j),
          time: `${randomInt(14, 18).toString().padStart(2, '0')}:${randomInt(0, 59).toString().padStart(2, '0')}`,
          result: '보류' as CallbackResult,
          notes: randomChoice(['고민 중', '가족과 상의 필요', '다른 병원 견적 받는 중', '시간 조율 중']),
          counselorId: 'test-user',
          createdAt: now
        });
      }

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(30, 65),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: true,
        firstVisitDate: visitDate,
        phase: '내원완료',
        currentStatus: '재콜백필요',
        result: null,
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: randomChoices(SAMPLE_SERVICES, 2),
          consultationNotes: '내원 상담 완료',
          estimatedAmount: randomInt(200, 600) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [
          { attempt: 1, date: callDate, time: '10:00', result: '예약확정' as CallbackResult, notes: '예약 확정', counselorId: 'test-user', createdAt: now }
        ],
        postVisitCallbacks: postCallbacks,
        postVisitConsultation: {
          visitDate,
          doctorName: randomChoice(['김원장', '이원장', '박원장']),
          diagnosisNotes: '상담 완료',
          treatmentRecommendation: randomChoice(SAMPLE_SERVICES),
          estimateInfo: {
            regularPrice: randomInt(300, 700) * 10000,
            discountPrice: randomInt(250, 600) * 10000,
            discountRate: randomInt(0, 15),
            discountReason: randomChoice(['', '첫방문 할인', '이벤트 할인', '소개 할인']),
            treatmentPlan: '치료 계획 수립',
            estimateDate: visitDate
          },
          patientResponse: '고민 중',
          followUpPlan: '재연락 예정'
        },
        statusHistory: [
          { date: callDate, time: '09:00', fromPhase: '전화상담', toPhase: '예약확정', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '예약 확정' },
          { date: visitDate, time: '14:00', fromPhase: '예약확정', toPhase: '내원완료', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '내원 확인' },
          { date: today, time: '15:00', fromPhase: '내원완료', toPhase: '내원완료', fromStatus: null, toStatus: '재콜백필요', changedBy: 'test-user', note: '콜백 필요' }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 7. 종결 - 동의 - 10명
    for (let i = 0; i < 10; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(30);
      const visitDate = getRandomPastDate(20);
      const regularPrice = randomInt(300, 800) * 10000;
      const discountRate = randomInt(0, 20);
      const discountPrice = Math.round(regularPrice * (1 - discountRate / 100));

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(25, 70),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: true,
        firstVisitDate: visitDate,
        phase: '종결',
        currentStatus: null,
        result: '동의',
        resultReason: null,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: randomChoices(SAMPLE_SERVICES, randomInt(1, 2)),
          consultationNotes: '치료 동의',
          estimatedAmount: regularPrice,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [
          { attempt: 1, date: callDate, time: '10:00', result: '예약확정' as CallbackResult, notes: '', counselorId: 'test-user', createdAt: now }
        ],
        postVisitCallbacks: [
          { attempt: 1, date: visitDate, time: '16:00', result: '치료동의' as CallbackResult, notes: '치료 동의 완료', counselorId: 'test-user', createdAt: now }
        ],
        postVisitConsultation: {
          visitDate,
          doctorName: randomChoice(['김원장', '이원장', '박원장']),
          diagnosisNotes: '치료 계획 수립 완료',
          treatmentRecommendation: randomChoices(SAMPLE_SERVICES, 2).join(', '),
          estimateInfo: {
            regularPrice,
            discountPrice,
            discountRate,
            discountReason: discountRate > 0 ? randomChoice(['첫방문 할인', '이벤트 할인', '소개 할인', '패키지 할인']) : '',
            treatmentPlan: '치료 진행 예정',
            estimateDate: visitDate
          },
          patientResponse: '동의',
          followUpPlan: '치료 일정 조율'
        },
        statusHistory: [
          { date: callDate, time: '09:00', fromPhase: '전화상담', toPhase: '예약확정', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '예약 확정' },
          { date: visitDate, time: '14:00', fromPhase: '예약확정', toPhase: '내원완료', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '내원 확인' },
          { date: visitDate, time: '16:00', fromPhase: '내원완료', toPhase: '종결', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '종결: 동의' }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 8. 종결 - 미동의 - 7명
    for (let i = 0; i < 7; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(30);
      const visitDate = getRandomPastDate(15);
      const reason = randomChoice(RESULT_REASONS);

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(30, 65),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: true,
        firstVisitDate: visitDate,
        phase: '종결',
        currentStatus: null,
        result: '미동의',
        resultReason: reason,
        resultReasonDetail: reason === '기타' ? '개인 사정' : '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: [randomChoice(SAMPLE_SERVICES)],
          consultationNotes: '미동의',
          estimatedAmount: randomInt(200, 500) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [],
        postVisitCallbacks: [
          { attempt: 1, date: visitDate, time: '17:00', result: '치료거부' as CallbackResult, notes: reason, counselorId: 'test-user', createdAt: now }
        ],
        postVisitConsultation: {
          visitDate,
          doctorName: randomChoice(['김원장', '이원장', '박원장']),
          diagnosisNotes: '상담 완료',
          treatmentRecommendation: randomChoice(SAMPLE_SERVICES),
          estimateInfo: {
            regularPrice: randomInt(300, 600) * 10000,
            discountPrice: randomInt(300, 600) * 10000,
            discountRate: 0,
            discountReason: '',
            treatmentPlan: '',
            estimateDate: visitDate
          },
          patientResponse: reason,
          followUpPlan: ''
        },
        statusHistory: [
          { date: visitDate, time: '14:00', fromPhase: '예약확정', toPhase: '내원완료', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '내원 확인' },
          { date: visitDate, time: '17:00', fromPhase: '내원완료', toPhase: '종결', fromStatus: null, toStatus: null, changedBy: 'test-user', note: `종결: 미동의 (${reason})` }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 9. 종결 - 보류 - 5명
    for (let i = 0; i < 5; i++) {
      const gender = randomChoice(['남', '여']) as '남' | '여';
      const callDate = getRandomPastDate(21);
      const visitDate = getRandomPastDate(10);
      const reason = randomChoice(['가족상의필요', '타병원비교', '일정조율어려움', '추가정보필요'] as ResultReason[]);

      testPatients.push({
        name: randomName(gender),
        phone: randomPhone(),
        gender,
        age: randomInt(28, 55),
        address: '',
        callInDate: callDate,
        source: randomChoice(SAMPLE_SOURCES),
        consultationType: '인바운드',
        visitConfirmed: true,
        firstVisitDate: visitDate,
        phase: '종결',
        currentStatus: null,
        result: '보류',
        resultReason: reason,
        resultReasonDetail: '',
        assignedTo: 'test-user',
        createdBy: 'test-user',
        consultation: {
          selectedTeeth: randomTeeth(),
          teethUnknown: false,
          interestedServices: randomChoices(SAMPLE_SERVICES, 2),
          consultationNotes: '보류',
          estimatedAmount: randomInt(250, 450) * 10000,
          consultationDate: callDate
        },
        reservation: null,
        preVisitCallbacks: [],
        postVisitCallbacks: [
          { attempt: 1, date: visitDate, time: '15:00', result: '보류' as CallbackResult, notes: '추후 연락 예정', counselorId: 'test-user', createdAt: now },
          { attempt: 2, date: getDateDaysAgo(5), time: '16:00', result: '보류' as CallbackResult, notes: '아직 고민 중', counselorId: 'test-user', createdAt: now }
        ],
        postVisitConsultation: {
          visitDate,
          doctorName: randomChoice(['김원장', '이원장', '박원장']),
          diagnosisNotes: '상담 완료, 보류',
          treatmentRecommendation: randomChoice(SAMPLE_SERVICES),
          estimateInfo: {
            regularPrice: randomInt(300, 500) * 10000,
            discountPrice: randomInt(280, 480) * 10000,
            discountRate: randomInt(5, 10),
            discountReason: '이벤트 할인',
            treatmentPlan: '치료 계획 제안',
            estimateDate: visitDate
          },
          patientResponse: '보류',
          followUpPlan: '추후 연락'
        },
        statusHistory: [
          { date: visitDate, time: '14:00', fromPhase: '예약확정', toPhase: '내원완료', fromStatus: null, toStatus: null, changedBy: 'test-user', note: '내원 확인' },
          { date: today, time: '16:00', fromPhase: '내원완료', toPhase: '종결', fromStatus: null, toStatus: null, changedBy: 'test-user', note: `종결: 보류 (${reason})` }
        ],
        postVisitStatusInfo: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false
      });
    }

    // 기존 테스트 데이터 삭제 후 새로 삽입
    await collection.deleteMany({});
    await collection.insertMany(testPatients);

    const consultationCount = testPatients.filter(p => !p.visitConfirmed).length;
    const visitCount = testPatients.filter(p => p.visitConfirmed).length;

    return NextResponse.json({
      success: true,
      message: `${testPatients.length}개의 테스트 데이터가 생성되었습니다. (상담관리: ${consultationCount}명, 내원관리: ${visitCount}명)`,
      count: testPatients.length,
      breakdown: {
        consultation: consultationCount,
        visit: visitCount
      }
    });

  } catch (error) {
    console.error('테스트 데이터 생성 오류:', error);
    return NextResponse.json(
      { success: false, error: '테스트 데이터 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 테스트 데이터 삭제
export async function DELETE() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const result = await collection.deleteMany({});

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount}개의 테스트 데이터가 삭제되었습니다.`,
      count: result.deletedCount
    });

  } catch (error) {
    console.error('테스트 데이터 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '테스트 데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
