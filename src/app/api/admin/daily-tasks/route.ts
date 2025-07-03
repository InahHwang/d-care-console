// src/app/api/admin/daily-tasks/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getActivityLogsCollection, getPatientsCollection } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { startOfDay, endOfDay } from 'date-fns';

// 업무 관련 액션들을 정의
const TASK_ACTIONS = {
  // 콜백 관련
  'callback_complete': { name: '콜백 완료', category: 'callback' },
  'callback_create': { name: '콜백 등록', category: 'callback' },
  'callback_update': { name: '콜백 수정', category: 'callback' },
  'callback_cancel': { name: '콜백 취소', category: 'callback' },
  
  // 환자 관련
  'patient_update': { name: '환자 정보 수정', category: 'patient' },
  'patient_create': { name: '환자 등록', category: 'patient' },
  'patient_consultation': { name: '상담 진행', category: 'consultation' },
  'patient_reservation_complete': { name: '예약 완료', category: 'reservation' },
  'patient_visit_confirmation': { name: '방문 확인', category: 'visit' },
  'patient_post_visit_status': { name: '방문 후 상태 처리', category: 'visit' },
  
  // 메시지 관련
  'message_send': { name: '메시지 전송', category: 'message' },
};

interface DailyTaskSummary {
  date: string;
  userTasks: UserTaskSummary[];
  totalTasks: number;
  taskBreakdown: TaskBreakdown;
}

interface UserTaskSummary {
  userId: string;
  userName: string;
  tasks: ProcessedTask[];
  totalCount: number;
  taskCounts: {
    callbackComplete: number;
    callbackRegistered: number;
    scheduledCallHandled: number;
    patientUpdated: number;
    consultationCompleted: number;
  };
}

interface ProcessedTask {
  _id: string;
  taskType: string;
  taskTypeName: string;
  patientName: string;
  patientPhone: string;
  details: string;
  timestamp: string;
  originalAction: string;
}

interface TaskBreakdown {
  callbackComplete: number;
  callbackRegistered: number;
  scheduledCallHandled: number;
  patientUpdated: number;
  consultationCompleted: number;
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (error) {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 마스터 권한 확인
    if (decoded.role !== 'master') {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

    // MongoDB 연결
    await connectToDatabase();
    const activityLogsCollection = await getActivityLogsCollection();
    const patientsCollection = await getPatientsCollection();

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');

    // 선택된 날짜의 시작과 끝 시간 계산
    const startDate = startOfDay(new Date(date));
    const endDate = endOfDay(new Date(date));

    // 기본 쿼리 조건
    const matchConditions: any = {
      timestamp: {
        $gte: startDate,
        $lte: endDate
      },
      action: { $in: Object.keys(TASK_ACTIONS) }
    };

    // 사용자 필터링
    if (userId) {
      matchConditions.userId = userId;
    }

    // 활동 로그 조회
    const activityLogs = await activityLogsCollection.find(matchConditions)
      .sort({ timestamp: -1 })
      .toArray();

    // 환자 데이터 조회 (검색 및 상세 정보를 위해)
    const patientIds = activityLogs
      .filter(log => log.targetId && log.target === 'patient')
      .map(log => log.targetId);

    const patients = await patientsCollection.find({ 
      _id: { $in: patientIds.map(id => typeof id === 'string' ? id : id.toString()) } 
    }).toArray();

    const patientMap = new Map(patients.map(p => [p._id.toString(), p]));

    // 처리된 업무 데이터 변환
    const processedTasks: ProcessedTask[] = [];
    
    for (const log of activityLogs) {
      const taskInfo = TASK_ACTIONS[log.action as keyof typeof TASK_ACTIONS];
      if (!taskInfo) continue;

      let patientName = '알 수 없음';
      let patientPhone = '';
      let details = '';

      // 환자 정보 가져오기
      if (log.target === 'patient' && log.targetId) {
        const patient = patientMap.get(log.targetId.toString());
        if (patient) {
          patientName = patient.name || '알 수 없음';
          patientPhone = patient.phoneNumber || patient.phone || '';
        }
      }

      // 타겟 이름이 있으면 사용
      if (log.targetName) {
        patientName = log.targetName;
      }

      // 상세 정보 구성
      if (log.details) {
        if (log.details.notes) details = log.details.notes;
        else if (log.details.reason) details = log.details.reason;
        else if (log.details.changeDetails) details = log.details.changeDetails;
        else if (log.details.status) details = `상태: ${log.details.status}`;
        else if (log.details.message) details = log.details.message;
        else if (typeof log.details === 'string') details = log.details;
      }

      // 검색 필터링
      if (search) {
        const searchLower = search.toLowerCase();
        if (!patientName.toLowerCase().includes(searchLower) && 
            !patientPhone.includes(search) &&
            !details.toLowerCase().includes(searchLower)) {
          continue;
        }
      }

      processedTasks.push({
        _id: log._id.toString(),
        taskType: log.action,
        taskTypeName: taskInfo.name,
        patientName,
        patientPhone,
        details,
        timestamp: log.timestamp,
        originalAction: log.action
      });
    }

    // 사용자별로 그룹핑
    const userTasksMap = new Map<string, {
      userId: string;
      userName: string;
      tasks: ProcessedTask[];
      taskCounts: {
        callbackComplete: number;
        callbackRegistered: number;
        scheduledCallHandled: number;
        patientUpdated: number;
        consultationCompleted: number;
      };
    }>();

    processedTasks.forEach(task => {
      const log = activityLogs.find(l => l._id.toString() === task._id);
      if (!log) return;

      const userId = log.userId || 'unknown';
      const userName = log.userName || '알 수 없음';

      if (!userTasksMap.has(userId)) {
        userTasksMap.set(userId, {
          userId,
          userName,
          tasks: [],
          taskCounts: {
            callbackComplete: 0,
            callbackRegistered: 0,
            scheduledCallHandled: 0,
            patientUpdated: 0,
            consultationCompleted: 0
          }
        });
      }

      const userTask = userTasksMap.get(userId)!;
      userTask.tasks.push(task);

      // 업무 타입별 카운트
      switch (task.taskType) {
        case 'callback_complete':
          userTask.taskCounts.callbackComplete++;
          break;
        case 'callback_create':
          userTask.taskCounts.callbackRegistered++;
          break;
        case 'patient_update':
        case 'patient_create':
          userTask.taskCounts.patientUpdated++;
          break;
        case 'patient_consultation':
        case 'patient_reservation_complete':
          userTask.taskCounts.consultationCompleted++;
          break;
        case 'patient_visit_confirmation':
        case 'patient_post_visit_status':
          userTask.taskCounts.scheduledCallHandled++;
          break;
      }
    });

    // 사용자별 업무 데이터 변환
    const userTasks: UserTaskSummary[] = Array.from(userTasksMap.values()).map(userTask => ({
      userId: userTask.userId,
      userName: userTask.userName,
      tasks: userTask.tasks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      totalCount: userTask.tasks.length,
      taskCounts: userTask.taskCounts
    }));

    // 전체 업무 통계
    const taskBreakdown: TaskBreakdown = {
      callbackComplete: 0,
      callbackRegistered: 0,
      scheduledCallHandled: 0,
      patientUpdated: 0,
      consultationCompleted: 0
    };

    userTasks.forEach(userTask => {
      taskBreakdown.callbackComplete += userTask.taskCounts.callbackComplete;
      taskBreakdown.callbackRegistered += userTask.taskCounts.callbackRegistered;
      taskBreakdown.scheduledCallHandled += userTask.taskCounts.scheduledCallHandled;
      taskBreakdown.patientUpdated += userTask.taskCounts.patientUpdated;
      taskBreakdown.consultationCompleted += userTask.taskCounts.consultationCompleted;
    });

    const dailyTaskSummary: DailyTaskSummary = {
      date,
      userTasks: userTasks.sort((a, b) => b.totalCount - a.totalCount),
      totalTasks: processedTasks.length,
      taskBreakdown
    };

    return NextResponse.json({
      success: true,
      dailyTasks: [dailyTaskSummary]
    });

  } catch (error) {
    console.error('Daily tasks API error:', error);
    return NextResponse.json(
      { message: '일일 업무 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}