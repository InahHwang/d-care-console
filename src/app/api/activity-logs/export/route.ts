// src/app/api/activity-logs/export/route.ts (새로 생성)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT 토큰 검증 및 사용자 정보 추출
async function verifyToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 필요합니다.');
  }

  const token = authorization.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    throw new Error('유효하지 않은 토큰입니다.');
  }
}

// 액션 한글 변환
function getActionDisplayName(action: string): string {
  const actionMap: Record<string, string> = {
    'login': '로그인',
    'logout': '로그아웃',
    'patient_create': '환자 등록',
    'patient_update': '환자 수정',
    'patient_delete': '환자 삭제',
    'patient_view': '환자 조회',
    'patient_complete': '환자 완료',
    'patient_complete_cancel': '환자 완료 취소',
    'callback_create': '콜백 등록',
    'callback_update': '콜백 수정',
    'callback_delete': '콜백 삭제',
    'callback_complete': '콜백 완료',
    'callback_cancel': '콜백 취소',
    'callback_reschedule': '콜백 재예약',
    'patient_status_change': '환자 상태 변경',
    'visit_confirmation_toggle': '방문 확정 토글',
    'message_send': '메시지 전송',
    'message_template_used': '메시지 템플릿 사용',
    'message_log_view': '메시지 로그 조회',
    'event_target_create': '이벤트 타겟 생성',
    'event_target_update': '이벤트 타겟 수정',
    'event_target_delete': '이벤트 타겟 삭제',
    'user_create': '사용자 생성',
    'user_update': '사용자 수정',
    'user_delete': '사용자 삭제',
  };
  return actionMap[action] || action;
}

// 타겟 한글 변환
function getTargetDisplayName(target: string): string {
  const targetMap: Record<string, string> = {
    'patient': '환자',
    'callback': '콜백',
    'message': '메시지',
    'event_target': '이벤트 타겟',
    'user': '사용자',
    'system': '시스템'
  };
  return targetMap[target] || target;
}

// CSV 문자열 이스케이프
function escapeCSV(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 활동 로그 내보내기 (GET)
export async function GET(request: NextRequest) {
  try {
    const currentUser = await verifyToken(request);
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const target = searchParams.get('target');
    const targetId = searchParams.get('targetId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const searchTerm = searchParams.get('searchTerm');
    const format = searchParams.get('format') || 'csv'; // csv 또는 xlsx

    const { db } = await connectToDatabase();
    const logsCollection = db.collection('activityLogs');

    // 필터 구성 (기존 로직과 동일)
    const filter: any = {};

    // 일반 사용자는 본인의 로그만 조회 가능
    if (currentUser.role !== 'master') {
      filter.userId = currentUser.id;
    } else if (userId) {
      filter.userId = userId;
    }

    if (action) filter.action = action;
    if (target) filter.target = target;
    if (targetId) filter.targetId = targetId;

    // 날짜 범위 필터
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate).toISOString();
      if (endDate) filter.timestamp.$lte = new Date(endDate).toISOString();
    }

    // 검색어 필터
    if (searchTerm) {
      filter.$or = [
        { userName: { $regex: searchTerm, $options: 'i' } },
        { action: { $regex: searchTerm, $options: 'i' } },
        { target: { $regex: searchTerm, $options: 'i' } },
        { 'details.patientName': { $regex: searchTerm, $options: 'i' } },
        { 'details.notes': { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // 모든 로그 조회 (내보내기이므로 페이지네이션 없음)
    const logs = await logsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(10000) // 최대 10,000개로 제한
      .toArray();

    // CSV 형식으로 변환
    if (format === 'csv') {
      const csvHeaders = [
        '날짜/시간',
        '사용자명',
        '사용자 권한',
        '액션',
        '대상 유형',
        '대상명',
        '세부 정보',
        'IP 주소'
      ];

      const csvRows = logs.map((log: { timestamp: string | number | Date; userName: any; userRole: string; action: string; target: string; targetName: any; targetId: any; details: { notes: any; reason: any; changeDetails: any; }; ipAddress: any; }) => [
        new Date(log.timestamp).toLocaleString('ko-KR'),
        escapeCSV(log.userName),
        escapeCSV(log.userRole === 'master' ? '마스터 관리자' : '일반 담당자'),
        escapeCSV(getActionDisplayName(log.action)),
        escapeCSV(getTargetDisplayName(log.target)),
        escapeCSV(log.targetName || log.targetId),
        escapeCSV(log.details?.notes || log.details?.reason || log.details?.changeDetails || ''),
        escapeCSV(log.ipAddress || '')
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row: any[]) => row.join(','))
      ].join('\n');

      // UTF-8 BOM 추가 (엑셀에서 한글 깨짐 방지)
      const bom = '\uFEFF';
      const csvWithBom = bom + csvContent;

      return new NextResponse(csvWithBom, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="activity-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON 형식으로 반환 (기본)
    return NextResponse.json({
      success: true,
      logs: logs.map((log: { _id: { toString: () => any; }; }) => ({
        ...log,
        _id: log._id.toString()
      })),
      total: logs.length,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('활동 로그 내보내기 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '활동 로그 내보내기에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}