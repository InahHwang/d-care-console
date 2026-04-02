// src/app/api/v2/activity-logs/export/route.ts
// 활동 로그 CSV 내보내기 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

const COLLECTION = 'activityLogs_v2';

const ACTION_LABELS: Record<string, string> = {
  login: '로그인',
  logout: '로그아웃',
  patient_create: '환자 등록',
  patient_update: '환자 수정',
  patient_delete: '환자 삭제',
  patient_view: '환자 조회',
  patient_complete: '환자 종결',
  patient_complete_cancel: '종결 취소',
  patient_status_change: '환자 상태 변경',
  visit_confirmation_toggle: '내원 확정',
  consultation_update: '상담 수정',
  callback_create: '콜백 등록',
  callback_update: '콜백 수정',
  callback_complete: '콜백 완료',
  callback_cancel: '콜백 취소',
  callback_delete: '콜백 삭제',
  callback_reschedule: '콜백 일정변경',
  message_send: '메시지 전송',
  message_template_used: '템플릿 사용',
  event_target_create: '이벤트 타겟 등록',
  event_target_update: '이벤트 타겟 수정',
  event_target_delete: '이벤트 타겟 삭제',
  user_create: '사용자 생성',
  user_update: '사용자 수정',
  user_delete: '사용자 삭제',
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {};
    if (userId) filter.userId = userId;
    if (action) filter.action = action;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) (filter.timestamp as Record<string, unknown>).$gte = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (filter.timestamp as Record<string, unknown>).$lte = end.toISOString();
      }
    }

    const logs = await db.collection(COLLECTION)
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(10000)
      .toArray();

    // BOM + CSV 헤더
    const BOM = '\uFEFF';
    const header = '시간,사용자,역할,액션,대상,대상명,상세내용\n';
    const rows = logs.map(log => {
      const actionLabel = ACTION_LABELS[log.action] || log.action;
      const notes = (log.details?.notes || log.details?.changeDetails || '').replace(/"/g, '""');
      const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString('ko-KR') : '';
      return `"${timestamp}","${log.userName || ''}","${log.userRole || ''}","${actionLabel}","${log.target || ''}","${log.targetName || ''}","${notes}"`;
    }).join('\n');

    const csv = BOM + header + rows;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="activity-logs.csv"`,
      },
    });
  } catch (error) {
    console.error('[ActivityLogs] Export 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
