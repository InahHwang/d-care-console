// src/app/api/v2/recall-messages/generate/route.ts
// 환자 치료 완료 시 리콜 메시지 자동 생성 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

interface RecallSchedule {
  id: string;
  timing: string;
  timingDays: number;
  message: string;
  enabled: boolean;
}

interface RecallSetting {
  _id: ObjectId;
  treatment: string;
  schedules: RecallSchedule[];
}

/**
 * 환자 치료 완료 시 리콜 메시지 자동 생성
 *
 * POST /api/v2/recall-messages/generate
 * Body: { patientId, treatment, completedDate? }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const body = await request.json();
    const { patientId, treatment, completedDate } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'patientId is required' },
        { status: 400 }
      );
    }

    if (!treatment) {
      return NextResponse.json(
        { success: false, error: 'treatment is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 1. 환자 정보 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId)
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: 'Patient not found' },
        { status: 404 }
      );
    }

    // 2. 해당 치료의 리콜 설정 조회
    const recallSetting = await db.collection<RecallSetting>('recall_settings').findOne({
      treatment: treatment
    });

    if (!recallSetting) {
      console.log(`[Recall Generate] 치료 "${treatment}"에 대한 리콜 설정이 없습니다.`);
      return NextResponse.json({
        success: true,
        message: `치료 "${treatment}"에 대한 리콜 설정이 없어 메시지가 생성되지 않았습니다.`,
        generated: 0,
      });
    }

    // 3. 활성화된 스케줄만 필터링
    const enabledSchedules = recallSetting.schedules.filter(s => s.enabled);

    if (enabledSchedules.length === 0) {
      console.log(`[Recall Generate] 치료 "${treatment}"에 활성화된 스케줄이 없습니다.`);
      return NextResponse.json({
        success: true,
        message: `치료 "${treatment}"에 활성화된 리콜 스케줄이 없습니다.`,
        generated: 0,
      });
    }

    // 4. 치료 완료일 (기본값: 오늘)
    const baseDate = completedDate ? new Date(completedDate) : new Date();
    const now = new Date();

    // 5. 각 스케줄에 대해 recall_messages 생성
    const messagesToInsert = enabledSchedules.map(schedule => {
      // 발송 예정일 계산
      const scheduledAt = new Date(baseDate);
      scheduledAt.setDate(scheduledAt.getDate() + schedule.timingDays);
      scheduledAt.setHours(10, 0, 0, 0); // 오전 10시

      // 메시지 템플릿에서 {환자명} 치환
      const personalizedMessage = schedule.message
        .replace(/\{환자명\}/g, patient.name || '고객')
        .replace(/\{이름\}/g, patient.name || '고객');

      return {
        patientId: patientId,
        treatment: treatment,
        timing: schedule.timing,
        timingDays: schedule.timingDays,
        message: personalizedMessage,
        status: 'pending',
        scheduledAt: scheduledAt,
        lastVisit: baseDate,
        createdAt: now.toISOString(),
      };
    });

    // 6. 중복 체크 (같은 환자, 같은 치료, 같은 타이밍의 pending 메시지가 있는지)
    const existingMessages = await db.collection('recall_messages').find({
      patientId: patientId,
      treatment: treatment,
      status: 'pending',
    }).toArray();

    const existingTimings = new Set(existingMessages.map(m => m.timing));

    const newMessages = messagesToInsert.filter(m => !existingTimings.has(m.timing));

    if (newMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: '이미 동일한 리콜 메시지가 대기 중입니다.',
        generated: 0,
        skipped: messagesToInsert.length,
      });
    }

    // 7. 메시지 저장
    const result = await db.collection('recall_messages').insertMany(newMessages);

    console.log(`[Recall Generate] 환자 ${patient.name}(${patientId})에 대해 ${result.insertedCount}개 리콜 메시지 생성됨`);

    return NextResponse.json({
      success: true,
      message: `${result.insertedCount}개의 리콜 메시지가 생성되었습니다.`,
      generated: result.insertedCount,
      skipped: messagesToInsert.length - newMessages.length,
      data: newMessages.map((m, i) => ({
        id: result.insertedIds[i]?.toString(),
        timing: m.timing,
        scheduledAt: m.scheduledAt,
      })),
    });

  } catch (error) {
    console.error('[Recall Generate API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
