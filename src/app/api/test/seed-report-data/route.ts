// src/app/api/test/seed-report-data/route.ts
// 테스트용 보고서 데이터 삽입 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

const TREATMENTS = ['교정', '임플란트', '심미보철', '충치치료', '스케일링', '라미네이트', '틀니'];
const CONSULTANTS = ['김상담', '이상담', '박상담', '최상담'];
const DISAGREE_REASONS = ['가격이 비쌈', '시간이 없음', '다른 병원 비교', '치료가 무서움', '생각해볼게요', '보험 적용 안됨'];
const SOURCES = ['블로그', '인스타그램', '네이버 검색', '지인 소개', '간판 보고', '네이버 플레이스'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateKoreanName(): string {
  const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
  const firstNames = ['민수', '영희', '철수', '지영', '현우', '수진', '동현', '미영', '준호', '서연', '민지', '지훈'];
  return randomItem(lastNames) + randomItem(firstNames);
}

function generatePhone(): string {
  const middle = randomInt(1000, 9999);
  const last = randomInt(1000, 9999);
  return `010-${middle}-${last}`;
}

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // 이번 달과 지난 달 데이터 생성
    const createdPatients: any[] = [];
    const createdCallLogs: any[] = [];
    const createdConsultations: any[] = [];

    // 지난 30일 동안의 데이터 생성
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      // UTC 기준으로 날짜 생성 (시간대 문제 방지)
      const date = new Date();
      date.setUTCHours(12, 0, 0, 0); // UTC 정오로 설정
      date.setUTCDate(date.getUTCDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      // 하루에 5~15명 환자 데이터
      const patientsPerDay = randomInt(5, 15);

      for (let i = 0; i < patientsPerDay; i++) {
        const patientId = new ObjectId();
        const treatment = randomItem(TREATMENTS);
        const consultant = randomItem(CONSULTANTS);

        // 환자 생성
        const patient = {
          _id: patientId,
          name: generateKoreanName(),
          phone: generatePhone(),
          source: randomItem(SOURCES),
          interest: treatment,
          status: randomItem(['consulting', 'reserved', 'visited', 'treatment', 'completed']),
          temperature: randomItem(['cold', 'warm', 'hot']) as 'cold' | 'warm' | 'hot',
          createdAt: date.toISOString(),
          updatedAt: date.toISOString(),
        };
        createdPatients.push(patient);

        // 통화 기록 생성 (70% 확률로 연결)
        const isConnected = Math.random() > 0.3;
        const classification = Math.random() > 0.5 ? '신환' : (Math.random() > 0.5 ? '구신환' : '구환');

        const callLog = {
          _id: new ObjectId(),
          patientId: patientId.toString(),
          phone: patient.phone,
          direction: 'inbound' as const,
          status: isConnected ? 'connected' : 'missed',
          duration: isConnected ? randomInt(60, 600) : 0,
          startedAt: date.toISOString(),
          endedAt: date.toISOString(),
          aiStatus: isConnected ? 'completed' : 'none',
          aiAnalysis: isConnected ? {
            summary: `${treatment} 상담 문의. ${classification === '신환' ? '첫 방문 예정' : '재방문'} 환자.`,
            classification,
            temperature: patient.temperature,
            interest: treatment,
          } : undefined,
          createdAt: date.toISOString(),
        };
        createdCallLogs.push(callLog);

        // 연결된 통화만 상담 기록 생성 (80% 확률)
        if (isConnected && Math.random() > 0.2) {
          const originalAmount = randomInt(50, 500) * 10000; // 50만원 ~ 500만원
          const status = randomItem(['agreed', 'agreed', 'disagreed', 'pending']) as 'agreed' | 'disagreed' | 'pending';
          const discountRate = status === 'agreed' ? randomInt(0, 20) : 0;
          const discountAmount = Math.round(originalAmount * (discountRate / 100));
          const finalAmount = originalAmount - discountAmount;

          const consultation = {
            _id: new ObjectId(),
            patientId: patientId.toString(),
            type: randomItem(['phone', 'visit']) as 'phone' | 'visit',  // 상담 유형 추가
            treatment,
            status,
            originalAmount,
            discountRate,
            discountAmount,
            finalAmount: status === 'agreed' ? finalAmount : 0,
            discountReason: status === 'agreed' && discountRate > 0 ? '첫 방문 할인' : undefined,
            disagreeReasons: status === 'disagreed'
              ? [randomItem(DISAGREE_REASONS), ...(Math.random() > 0.5 ? [randomItem(DISAGREE_REASONS)] : [])]
              : [],
            correctionPlan: status === 'disagreed' ? '추후 리콜 예정' : undefined,
            appointmentDate: status === 'agreed'
              ? new Date(date.getTime() + randomInt(1, 14) * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
            callbackDate: status === 'pending' || status === 'disagreed'
              ? new Date(date.getTime() + randomInt(3, 30) * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
            consultantName: consultant,
            aiSummary: `${treatment} ${status === 'agreed' ? '동의' : status === 'disagreed' ? '미동의' : '대기'} 상담.`,
            date: date,
            createdAt: date.toISOString(),
          };
          createdConsultations.push(consultation);
        }
      }
    }

    // DB에 삽입
    if (createdPatients.length > 0) {
      await db.collection('patients_v2').insertMany(createdPatients);
    }
    if (createdCallLogs.length > 0) {
      await db.collection('callLogs_v2').insertMany(createdCallLogs);
    }
    if (createdConsultations.length > 0) {
      await db.collection('consultations_v2').insertMany(createdConsultations);
    }

    return NextResponse.json({
      success: true,
      message: '테스트 데이터 생성 완료',
      counts: {
        patients: createdPatients.length,
        callLogs: createdCallLogs.length,
        consultations: createdConsultations.length,
      },
    });
  } catch (error) {
    console.error('[Seed] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 테스트 데이터 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    // 지난 30일 내 데이터만 삭제 (안전장치)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 31);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const results = await Promise.all([
      db.collection('consultations_v2').deleteMany({
        createdAt: { $gte: thirtyDaysAgoStr },
      }),
      // callLogs_v2와 patients_v2는 실제 데이터가 있을 수 있으므로 주의
    ]);

    return NextResponse.json({
      success: true,
      message: '상담 데이터 삭제 완료',
      deleted: {
        consultations: results[0].deletedCount,
      },
    });
  } catch (error) {
    console.error('[Seed] 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
