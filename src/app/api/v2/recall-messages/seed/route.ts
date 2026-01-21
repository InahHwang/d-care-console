// src/app/api/v2/recall-messages/seed/route.ts
// 리콜 시스템 테스트 데이터 시드 API

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 테스트용 환자 데이터
const TEST_PATIENTS = [
  { name: '김철수', phone: '010-1234-5678', interest: '임플란트' },
  { name: '이영희', phone: '010-2345-6789', interest: '교정' },
  { name: '박민수', phone: '010-3456-7890', interest: '스케일링' },
  { name: '최지은', phone: '010-4567-8901', interest: '임플란트' },
  { name: '정대호', phone: '010-5678-9012', interest: '스케일링' },
];

// 치료별 리콜 설정
const TEST_RECALL_SETTINGS = [
  {
    treatment: '임플란트',
    schedules: [
      { id: 'impl-1', timing: '1주 후', timingDays: 7, message: '{환자명}님, 임플란트 수술 후 일주일이 지났습니다. 수술 부위에 불편하신 점이 있으시면 언제든 연락주세요.', enabled: true },
      { id: 'impl-2', timing: '1개월 후', timingDays: 30, message: '{환자명}님, 임플란트 정기 점검 시기입니다. 편하신 시간에 내원 예약 부탁드립니다.', enabled: true },
      { id: 'impl-3', timing: '6개월 후', timingDays: 180, message: '{환자명}님, 임플란트 6개월 정기 검진 안내드립니다. 건강한 치아 유지를 위해 내원해주세요.', enabled: true },
    ],
  },
  {
    treatment: '스케일링',
    schedules: [
      { id: 'scale-1', timing: '6개월 후', timingDays: 180, message: '{환자명}님, 정기 스케일링 시기가 되었습니다. 건강보험 적용 가능하니 편하신 시간에 예약해주세요.', enabled: true },
    ],
  },
  {
    treatment: '교정',
    schedules: [
      { id: 'ortho-1', timing: '1개월 후', timingDays: 30, message: '{환자명}님, 교정 정기 조정일입니다. 내원 예약 부탁드립니다.', enabled: true },
      { id: 'ortho-2', timing: '3개월 후', timingDays: 90, message: '{환자명}님, 교정 진행 상황 체크가 필요합니다. 편하신 시간에 내원해주세요.', enabled: true },
    ],
  },
];

export async function POST() {
  try {
    const { db } = await connectToDatabase();
    const now = new Date();

    // 1. 테스트 환자 생성 (또는 기존 환자 사용)
    const patientIds: string[] = [];

    for (const patient of TEST_PATIENTS) {
      // 기존 환자 확인
      let existingPatient = await db.collection('patients_v2').findOne({ phone: patient.phone });

      if (!existingPatient) {
        // 새 환자 생성
        const result = await db.collection('patients_v2').insertOne({
          name: patient.name,
          phone: patient.phone,
          status: 'completed',
          temperature: 'warm',
          interest: patient.interest,
          aiAnalysis: { interest: patient.interest },
          source: 'test',
          createdAt: now,
          updatedAt: now,
        });
        patientIds.push(result.insertedId.toString());
      } else {
        patientIds.push(existingPatient._id.toString());
      }
    }

    // 2. 리콜 설정 생성
    for (const setting of TEST_RECALL_SETTINGS) {
      const existing = await db.collection('recall_settings').findOne({ treatment: setting.treatment });

      if (!existing) {
        await db.collection('recall_settings').insertOne({
          treatment: setting.treatment,
          schedules: setting.schedules,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }
    }

    // 3. 기존 테스트 리콜 메시지 삭제
    await db.collection('recall_messages').deleteMany({
      patientId: { $in: patientIds }
    });

    // 4. 각 상태별 리콜 메시지 생성
    const recallMessages = [];

    // 4-1. pending (발송 대기) - 오늘/내일 발송 예정
    const pendingDate1 = new Date(now);
    pendingDate1.setHours(10, 0, 0, 0);

    const pendingDate2 = new Date(now);
    pendingDate2.setDate(pendingDate2.getDate() + 1);
    pendingDate2.setHours(10, 0, 0, 0);

    recallMessages.push({
      patientId: patientIds[0],
      treatment: '임플란트',
      timing: '1주 후',
      timingDays: 7,
      message: '김철수님, 임플란트 수술 후 일주일이 지났습니다. 수술 부위에 불편하신 점이 있으시면 언제든 연락주세요.',
      status: 'pending',
      scheduledAt: pendingDate1,
      lastVisit: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    recallMessages.push({
      patientId: patientIds[1],
      treatment: '교정',
      timing: '1개월 후',
      timingDays: 30,
      message: '이영희님, 교정 정기 조정일입니다. 내원 예약 부탁드립니다.',
      status: 'pending',
      scheduledAt: pendingDate2,
      lastVisit: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    // 4-2. sent (발송 완료, 응답 대기) - 1~2일 전 발송
    const sentDate1 = new Date(now);
    sentDate1.setDate(sentDate1.getDate() - 1);

    const sentDate2 = new Date(now);
    sentDate2.setDate(sentDate2.getDate() - 2);

    recallMessages.push({
      patientId: patientIds[2],
      treatment: '스케일링',
      timing: '6개월 후',
      timingDays: 180,
      message: '박민수님, 정기 스케일링 시기가 되었습니다. 건강보험 적용 가능하니 편하신 시간에 예약해주세요.',
      status: 'sent',
      scheduledAt: sentDate1,
      sentAt: sentDate1,
      lastVisit: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    // 4-3. booked (예약 완료) - 발송 후 예약 잡힌 케이스
    const bookedSentDate = new Date(now);
    bookedSentDate.setDate(bookedSentDate.getDate() - 3);

    const bookedDate = new Date(now);
    bookedDate.setDate(bookedDate.getDate() - 1);

    recallMessages.push({
      patientId: patientIds[3],
      treatment: '임플란트',
      timing: '1개월 후',
      timingDays: 30,
      message: '최지은님, 임플란트 정기 점검 시기입니다. 편하신 시간에 내원 예약 부탁드립니다.',
      status: 'booked',
      scheduledAt: bookedSentDate,
      sentAt: bookedSentDate,
      bookedAt: bookedDate,
      lastVisit: new Date(now.getTime() - 33 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    // 4-4. call-needed (전화 필요) - 발송 후 3일 이상 미응답
    const callNeededSentDate = new Date(now);
    callNeededSentDate.setDate(callNeededSentDate.getDate() - 5);

    recallMessages.push({
      patientId: patientIds[4],
      treatment: '스케일링',
      timing: '6개월 후',
      timingDays: 180,
      message: '정대호님, 정기 스케일링 시기가 되었습니다. 건강보험 적용 가능하니 편하신 시간에 예약해주세요.',
      status: 'call-needed',
      scheduledAt: callNeededSentDate,
      sentAt: callNeededSentDate,
      lastVisit: new Date(now.getTime() - 185 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    // 추가 pending 메시지 (미래 발송 예정)
    const futureDate1 = new Date(now);
    futureDate1.setDate(futureDate1.getDate() + 7);
    futureDate1.setHours(10, 0, 0, 0);

    const futureDate2 = new Date(now);
    futureDate2.setDate(futureDate2.getDate() + 30);
    futureDate2.setHours(10, 0, 0, 0);

    recallMessages.push({
      patientId: patientIds[0],
      treatment: '임플란트',
      timing: '1개월 후',
      timingDays: 30,
      message: '김철수님, 임플란트 정기 점검 시기입니다. 편하신 시간에 내원 예약 부탁드립니다.',
      status: 'pending',
      scheduledAt: futureDate1,
      lastVisit: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    recallMessages.push({
      patientId: patientIds[0],
      treatment: '임플란트',
      timing: '6개월 후',
      timingDays: 180,
      message: '김철수님, 임플란트 6개월 정기 검진 안내드립니다. 건강한 치아 유지를 위해 내원해주세요.',
      status: 'pending',
      scheduledAt: futureDate2,
      lastVisit: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      createdAt: now.toISOString(),
    });

    // 5. 메시지 저장
    if (recallMessages.length > 0) {
      await db.collection('recall_messages').insertMany(recallMessages);
    }

    // 통계 계산
    const stats = {
      patients: patientIds.length,
      recallSettings: TEST_RECALL_SETTINGS.length,
      recallMessages: {
        pending: recallMessages.filter(m => m.status === 'pending').length,
        sent: recallMessages.filter(m => m.status === 'sent').length,
        booked: recallMessages.filter(m => m.status === 'booked').length,
        callNeeded: recallMessages.filter(m => m.status === 'call-needed').length,
        total: recallMessages.length,
      },
    };

    console.log('[Recall Seed] 테스트 데이터 생성 완료:', stats);

    return NextResponse.json({
      success: true,
      message: '리콜 시스템 테스트 데이터가 생성되었습니다.',
      stats,
    });

  } catch (error) {
    console.error('[Recall Seed API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 테스트 데이터 삭제
export async function DELETE() {
  try {
    const { db } = await connectToDatabase();

    // 테스트 환자의 전화번호로 찾기
    const testPhones = TEST_PATIENTS.map(p => p.phone);

    const testPatients = await db.collection('patients_v2')
      .find({ phone: { $in: testPhones } })
      .toArray();

    const testPatientIds = testPatients.map(p => p._id.toString());

    // 리콜 메시지 삭제
    const recallResult = await db.collection('recall_messages').deleteMany({
      patientId: { $in: testPatientIds }
    });

    // 리콜 설정 삭제
    const settingsResult = await db.collection('recall_settings').deleteMany({
      treatment: { $in: TEST_RECALL_SETTINGS.map(s => s.treatment) }
    });

    // 테스트 환자 삭제 (source: 'test'인 것만)
    const patientsResult = await db.collection('patients_v2').deleteMany({
      phone: { $in: testPhones },
      source: 'test'
    });

    return NextResponse.json({
      success: true,
      message: '테스트 데이터가 삭제되었습니다.',
      deleted: {
        recallMessages: recallResult.deletedCount,
        recallSettings: settingsResult.deletedCount,
        patients: patientsResult.deletedCount,
      },
    });

  } catch (error) {
    console.error('[Recall Seed API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
