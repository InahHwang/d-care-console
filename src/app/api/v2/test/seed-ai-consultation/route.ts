// src/app/api/v2/test/seed-ai-consultation/route.ts
// AI 자동분류 상담 결과 테스트 데이터 생성 (로컬 테스트용)

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export async function POST() {
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const nowISO = now.toISOString();

    // 1. 테스트 환자 찾기 또는 생성
    let patient = await db.collection('patients_v2').findOne({
      phone: '010-9999-0001'
    });

    if (!patient) {
      const insertResult = await db.collection('patients_v2').insertOne({
        name: '테스트환자(AI)',
        phone: '010-9999-0001',
        gender: '여',
        age: 35,
        status: 'consulting',
        statusChangedAt: nowISO,
        temperature: 'hot',
        interest: '임플란트',
        source: 'AI테스트',
        aiRegistered: true,
        aiConfidence: 0.85,
        createdAt: nowISO,
        updatedAt: nowISO,
      });
      patient = { _id: insertResult.insertedId };
    }

    const patientId = patient._id.toString();

    // 2. 기존 테스트 상담 삭제
    await db.collection('consultations_v2').deleteMany({
      patientId,
      aiGenerated: true,
    });

    // 3. AI 자동분류 상담 결과 3개 생성 (동의/미동의/보류)
    const testConsultations = [
      {
        patientId,
        callLogId: 'test-call-001',
        type: 'phone',
        status: 'agreed',
        date: now,
        treatment: '임플란트',
        originalAmount: 3500000,
        discountRate: 0,
        discountAmount: 0,
        finalAmount: 3500000,
        appointmentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3일 후
        consultantName: '(AI 자동분류)',
        aiSummary: '환자분이 임플란트 상담을 원하셨고, 가격 안내 후 "네 그럼 이번 주 금요일 3시에 예약할게요"라고 하셨습니다. 임플란트 2개 식립 예정이며, 전체 비용 350만원 안내드렸습니다.',
        aiGenerated: true,
        createdAt: nowISO,
      },
      {
        patientId,
        callLogId: 'test-call-002',
        type: 'phone',
        status: 'disagreed',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1일 전
        treatment: '치아교정',
        originalAmount: 4500000,
        discountRate: 0,
        discountAmount: 0,
        finalAmount: 0,
        disagreeReasons: ['예산 초과', '타 병원 비교 중'],
        callbackDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7일 후
        consultantName: '(AI 자동분류)',
        aiSummary: '교정 상담 문의였으나, 450만원 비용 안내 시 "좀 비싸네요, 다른 데도 알아보고 연락드릴게요"라고 하셨습니다. 일주일 후 재연락 예정.',
        aiGenerated: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        patientId,
        callLogId: 'test-call-003',
        type: 'phone',
        status: 'pending',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2일 전
        treatment: '잇몸치료',
        originalAmount: 800000,
        discountRate: 0,
        discountAmount: 0,
        finalAmount: 0,
        callbackDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5일 후
        consultantName: '(AI 자동분류)',
        aiSummary: '잇몸이 자주 붓고 피가 난다고 하셨습니다. 스케일링과 잇몸치료 권유드렸고, "남편이랑 상의해보고 다시 전화드릴게요"라고 하셨습니다.',
        aiGenerated: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    await db.collection('consultations_v2').insertMany(testConsultations);

    // 4. 환자 상태를 consulting으로 업데이트 (테스트용)
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      {
        $set: {
          status: 'consulting',
          statusChangedAt: nowISO,
          updatedAt: nowISO,
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'AI 자동분류 테스트 데이터 생성 완료',
      data: {
        patientId,
        patientName: '테스트환자(AI)',
        phone: '010-9999-0001',
        consultationsCreated: 3,
        viewUrl: `/v2/patients/${patientId}`,
      },
    });
  } catch (error) {
    console.error('[Test Seed] AI Consultation 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 테스트 데이터 삭제
export async function DELETE() {
  try {
    const { db } = await connectToDatabase();

    // 테스트 환자 찾기
    const patient = await db.collection('patients_v2').findOne({
      phone: '010-9999-0001'
    });

    if (patient) {
      // 해당 환자의 상담 기록 삭제
      await db.collection('consultations_v2').deleteMany({
        patientId: patient._id.toString(),
      });

      // 환자 삭제
      await db.collection('patients_v2').deleteOne({
        _id: patient._id,
      });
    }

    return NextResponse.json({
      success: true,
      message: '테스트 데이터 삭제 완료',
    });
  } catch (error) {
    console.error('[Test Seed] 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
