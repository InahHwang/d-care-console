// src/app/api/v2/ai-chat/route.ts
// AI 채팅 API — GPT-5.2 기반 치과 상담 어시스턴트

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';
import { PIIMasker } from '@/utils/piiMasker';
import { verifyToken } from '@/lib/auth';

// Vercel Function 타임아웃 설정 (GPT-5.2는 응답이 느릴 수 있음)
export const maxDuration = 120;

const MAX_CONTEXT_MESSAGES = 20;

// 시스템 프롬프트 생성
function buildSystemPrompt(pageContext: string, pageTitle: string, contextData?: Record<string, unknown>): string {
  let prompt = `당신은 치과 콜센터 관리 시스템(D-Care Console)의 AI 어시스턴트입니다.
상담사와 원장님이 업무 중 궁금한 것을 질문하면 전문적이고 실용적인 답변을 제공합니다.

## 역할
- 환자 관리, 상담 전략, 치과 치료 상식에 대한 조언
- 통화 데이터 해석 및 상담 개선 제안
- 업무 프로세스 안내 및 시스템 사용법 설명

## 현재 컨텍스트
- 사용자가 보고 있는 페이지: ${pageTitle} (${pageContext})`;

  // 데이터가 있으면 컨텍스트 추가
  if (contextData && Object.keys(contextData).length > 0) {
    prompt += `\n\n## 검색된 병원 데이터 (실제 DB 데이터)
아래는 사용자의 질문과 현재 페이지에 기반하여 자동으로 검색된 실제 데이터입니다.
질문에 답변할 때 이 데이터를 근거로 구체적이고 정확한 답변을 하세요.
데이터에 없는 내용은 추측하지 말고, "해당 데이터가 확인되지 않습니다"라고 안내하세요.

${JSON.stringify(contextData, null, 2)}`;
  }

  prompt += `

## 응답 가이드라인
1. 한국어로 답변하세요.
2. 치과 콜센터 업무에 맞는 실용적 조언을 제공하세요.
3. 환자 접근법, 화법, 상담 전략은 구체적으로 제시하세요.
4. 짧고 명확한 답변을 우선하되, 필요 시 상세히 설명하세요.
5. 환자 개인정보가 포함된 질문에도 업무 목적으로 답변하세요.
6. **제공된 데이터가 있으면 반드시 참고하여 구체적으로 답변하세요.**
   - 환자 데이터: 상태이력, 통화기록, AI요약, 메모 등을 종합 분석
   - 통계 데이터: 정확한 수치를 인용하여 답변
   - 콜백/일정: 구체적인 환자명, 시간 포함하여 안내
7. 시스템이 사용자 메시지를 분석하여 관련 데이터를 자동으로 DB에서 검색합니다.
   - "OOO 환자" → 해당 환자의 전체 정보 + 통화/상담 이력
   - "오늘 통화 몇 건?" → 오늘 통화 통계
   - "내일 콜백 누구?" → 내일 콜백 예정 환자 목록
   - "이번 달 동의율?" → 이번 달 상담 결과 통계
   - "보류 환자 몇 명?" → 상태별 환자 현황
8. 어느 페이지에서든 병원 전체 데이터에 대한 질문에 답변할 수 있습니다.`;

  return prompt;
}

// 메시지에서 환자 이름 후보 추출 (한글 2~4글자)
function extractPatientNames(message: string): string[] {
  const names: string[] = [];

  // 패턴 1: "OOO 환자" / "OOO 님" / "OOO씨" / "OOO한테"
  const suffixPattern = /([가-힣]{2,4})\s*(환자|님|씨|한테|에게|분|고객)/g;
  let match;
  while ((match = suffixPattern.exec(message)) !== null) {
    names.push(match[1]);
  }

  // 패턴 2: "환자 OOO" / "환자명 OOO"
  const prefixPattern = /(?:환자|환자명|고객|고객명)\s*[:：]?\s*([가-힣]{2,4})/g;
  while ((match = prefixPattern.exec(message)) !== null) {
    names.push(match[1]);
  }

  // 중복 제거
  return Array.from(new Set(names));
}

// DB에서 환자 검색 및 상세 데이터 조합
async function searchPatientsFromMessage(message: string, db: any): Promise<Record<string, unknown> | null> {
  const names = extractPatientNames(message);
  if (names.length === 0) return null;

  const patients = [];
  for (const name of names.slice(0, 3)) { // 최대 3명
    const patient = await db.collection('patients_v2').findOne(
      { name, deletedAt: { $exists: false } },
      {
        projection: {
          name: 1, phone: 1, status: 1, temperature: 1, interest: 1,
          source: 1, memo: 1, age: 1, region: 1, callCount: 1,
          tags: 1, createdAt: 1, lastContactAt: 1, statusChangedAt: 1,
          statusHistory: 1, callbackHistory: 1, closedReason: 1,
          estimatedAmount: 1, actualAmount: 1, nextAction: 1, nextActionDate: 1,
          'aiAnalysis.summary': 1, 'aiAnalysis.classification': 1, 'aiAnalysis.followUp': 1, 'aiAnalysis.interest': 1,
          recallEnabled: 1, recallBaseDate: 1,
        },
      }
    );

    if (patient) {
      // 최근 통화기록도 조회
      const callLogs = await db.collection('callLogs_v2')
        .find({ patientId: patient._id.toString() })
        .sort({ startedAt: -1 })
        .limit(5)
        .project({
          startedAt: 1, direction: 1, duration: 1,
          'aiAnalysis.summary': 1, 'aiAnalysis.consultationResult': 1,
        })
        .toArray();

      // 상담 기록 조회
      const consultations = await db.collection('consultations_v2')
        .find({ patientId: patient._id.toString() })
        .sort({ createdAt: -1 })
        .limit(5)
        .project({ status: 1, statusReason: 1, disagreeReasons: 1, note: 1, createdAt: 1 })
        .toArray();

      patients.push({
        환자명: patient.name,
        전화번호: patient.phone,
        상태: patient.status,
        온도: patient.temperature,
        관심치료: patient.aiAnalysis?.interest || patient.interest,
        유입경로: patient.source,
        나이: patient.age,
        지역: patient.region,
        메모: patient.memo,
        AI요약: patient.aiAnalysis?.summary,
        AI분류: patient.aiAnalysis?.classification,
        후속조치: patient.aiAnalysis?.followUp,
        다음액션: patient.nextAction,
        다음액션날짜: patient.nextActionDate,
        통화횟수: patient.callCount,
        태그: patient.tags,
        등록일: patient.createdAt,
        마지막연락: patient.lastContactAt,
        상태변경일: patient.statusChangedAt,
        종결사유: patient.closedReason,
        예상금액: patient.estimatedAmount,
        실제금액: patient.actualAmount,
        리콜설정: patient.recallEnabled,
        상태이력: (patient.statusHistory || []).slice(-5).map((h: any) =>
          `${h.from}→${h.to} (${h.changedAt}, ${h.changedByName || ''})`
        ),
        콜백이력: (patient.callbackHistory || []).slice(-3).map((h: any) =>
          `${h.reason}: ${h.note || ''} (${h.scheduledDate})`
        ),
        최근통화: callLogs.map((c: any) => ({
          날짜: c.startedAt,
          방향: c.direction,
          통화시간초: c.duration,
          AI요약: c.aiAnalysis?.summary,
          상담결과: c.aiAnalysis?.consultationResult?.status,
          미동의사유: c.aiAnalysis?.consultationResult?.disagreeReasons,
        })),
        최근상담: consultations.map((c: any) => ({
          상태: c.status,
          사유: c.statusReason,
          미동의사유: c.disagreeReasons,
          메모: c.note,
          날짜: c.createdAt,
        })),
      });
    }
  }

  if (patients.length === 0) return null;
  if (patients.length === 1) return { '검색된_환자': patients[0] };
  return { '검색된_환자목록': patients };
}

// 메시지 의도 감지 → 병원 데이터 자동 검색
async function searchClinicDataFromMessage(message: string, db: any, clinicId: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  const now = new Date();

  // 날짜 키워드 파싱
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStart = todayEnd;
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const isToday = /오늘|금일/.test(message);
  const isTomorrow = /내일/.test(message);
  const isThisWeek = /이번\s*주|금주/.test(message);
  const isThisMonth = /이번\s*달|이달|금월/.test(message);
  const isYesterday = /어제/.test(message);

  // 기간 결정
  let dateStart: Date | null = null;
  let dateEnd: Date | null = null;
  let dateLabel = '';
  if (isToday) { dateStart = todayStart; dateEnd = todayEnd; dateLabel = '오늘'; }
  else if (isTomorrow) { dateStart = tomorrowStart; dateEnd = tomorrowEnd; dateLabel = '내일'; }
  else if (isYesterday) {
    dateStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    dateEnd = todayStart; dateLabel = '어제';
  }
  else if (isThisWeek) { dateStart = weekStart; dateEnd = todayEnd; dateLabel = '이번 주'; }
  else if (isThisMonth) { dateStart = monthStart; dateEnd = todayEnd; dateLabel = '이번 달'; }

  // 1) 환자 이름 검색 (항상 실행)
  const patientData = await searchPatientsFromMessage(message, db);
  if (patientData) {
    Object.assign(result, patientData);
  }

  // 2) 통화/상담 통계 키워드
  const wantsCallStats = /통화|콜|전화/.test(message) && /몇|얼마|건수|통계|현황/.test(message);
  const wantsConsultStats = /상담|동의|미동의|보류|종결/.test(message) && /몇|얼마|건수|통계|현황|비율|율/.test(message);

  if (wantsCallStats && dateStart && dateEnd) {
    try {
      const callStats = await db.collection('callLogs_v2').aggregate([
        { $match: { clinicId, startedAt: { $gte: dateStart.toISOString(), $lt: dateEnd.toISOString() } } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] } },
          missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
          inbound: { $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] } },
          outbound: { $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] } },
          totalDuration: { $sum: '$duration' },
        }},
      ]).toArray();
      result[`${dateLabel}_통화통계`] = callStats[0] || { total: 0, connected: 0, missed: 0 };
    } catch (e) { console.error('[AI Chat] 통화 통계 오류:', e); }
  }

  if (wantsConsultStats && dateStart && dateEnd) {
    try {
      const consultStats = await db.collection('consultations_v2').aggregate([
        { $match: { clinicId, createdAt: { $gte: dateStart.toISOString(), $lt: dateEnd.toISOString() } } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' },
        }},
      ]).toArray();
      const statsMap: Record<string, any> = {};
      let total = 0;
      for (const s of consultStats) { statsMap[s._id] = { 건수: s.count, 금액: s.totalAmount }; total += s.count; }
      if (total > 0 && statsMap['agreed']) {
        statsMap['동의율'] = `${Math.round((statsMap['agreed'].건수 / total) * 100)}%`;
      }
      result[`${dateLabel}_상담통계`] = { 전체: total, ...statsMap };
    } catch (e) { console.error('[AI Chat] 상담 통계 오류:', e); }
  }

  // 3) 콜백 일정 키워드
  const wantsCallback = /콜백|예정|스케줄|일정/.test(message);
  if (wantsCallback && dateStart && dateEnd) {
    try {
      const callbacks = await db.collection('patients_v2')
        .find({
          clinicId,
          nextActionDate: { $gte: dateStart.toISOString(), $lt: dateEnd.toISOString() },
          status: { $nin: ['closed'] },
        })
        .project({ name: 1, phone: 1, status: 1, nextAction: 1, nextActionDate: 1, interest: 1, memo: 1 })
        .sort({ nextActionDate: 1 })
        .limit(20)
        .toArray();
      result[`${dateLabel}_콜백예정`] = callbacks.map((p: any) => ({
        환자명: p.name, 전화번호: p.phone, 상태: p.status,
        다음액션: p.nextAction, 예정일: p.nextActionDate,
        관심치료: p.interest, 메모: p.memo,
      }));
    } catch (e) { console.error('[AI Chat] 콜백 조회 오류:', e); }
  }

  // 4) 환자 상태별 현황
  const wantsPatientStatus = /환자/.test(message) && /몇\s*명|현황|목록|리스트/.test(message);
  const statusKeyword = message.match(/신규|상담중|보류|예약|종결|내원완료|치료예약/)?.[0];
  if (wantsPatientStatus) {
    try {
      const statusFilter: any = { clinicId, deletedAt: { $exists: false } };
      if (statusKeyword) {
        const statusMap: Record<string, string> = {
          '신규': 'new', '상담중': 'consulting', '보류': 'pending',
          '예약': 'reserved', '종결': 'closed', '내원완료': 'visited', '치료예약': 'treatmentBooked',
        };
        statusFilter.status = statusMap[statusKeyword] || statusKeyword;
      }
      const statusAgg = await db.collection('patients_v2').aggregate([
        { $match: statusFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray();
      const statusResult: Record<string, number> = {};
      let patientTotal = 0;
      for (const s of statusAgg) { statusResult[s._id || '미분류'] = s.count; patientTotal += s.count; }
      result['환자_상태별현황'] = { 전체: patientTotal, ...statusResult };

      // 특정 상태 환자 목록 (20명까지)
      if (statusKeyword && statusFilter.status) {
        const patients = await db.collection('patients_v2')
          .find(statusFilter)
          .project({ name: 1, phone: 1, status: 1, interest: 1, lastContactAt: 1, nextActionDate: 1 })
          .sort({ lastContactAt: -1 })
          .limit(20)
          .toArray();
        result[`${statusKeyword}_환자목록`] = patients.map((p: any) => ({
          환자명: p.name, 전화번호: p.phone, 관심치료: p.interest,
          마지막연락: p.lastContactAt, 다음일정: p.nextActionDate,
        }));
      }
    } catch (e) { console.error('[AI Chat] 환자 현황 오류:', e); }
  }

  // 5) 최근 통화 목록 (구체적 날짜 없이 "최근 통화" 요청)
  const wantsRecentCalls = /최근\s*통화|마지막\s*통화/.test(message) && !dateStart;
  if (wantsRecentCalls) {
    try {
      const recentCalls = await db.collection('callLogs_v2')
        .find({ clinicId })
        .sort({ startedAt: -1 })
        .limit(10)
        .project({ patientName: 1, direction: 1, startedAt: 1, duration: 1, status: 1, 'aiAnalysis.summary': 1 })
        .toArray();
      result['최근_통화목록'] = recentCalls.map((c: any) => ({
        환자명: c.patientName, 방향: c.direction, 시간: c.startedAt,
        통화시간초: c.duration, 상태: c.status, AI요약: c.aiAnalysis?.summary,
      }));
    } catch (e) { console.error('[AI Chat] 최근 통화 오류:', e); }
  }

  return result;
}

// 대화 제목 자동 생성 (첫 메시지 기반)
function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\n/g, ' ').trim();
  if (cleaned.length <= 30) return cleaned;
  return cleaned.substring(0, 27) + '...';
}

// GET: 대화 목록 조회
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const user = extractUserFromRequest(request);

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const targetUserId = searchParams.get('userId');

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;

    // 관리자는 다른 사용자의 대화도 조회 가능
    const isAdmin = auth.user.role === 'admin' || auth.user.role === 'master';

    let userIdFilter: any;

    if (isAdmin && targetUserId) {
      // 관리자가 특정 사용자의 대화 조회 시
      // 로그인 시 TEST_USERS(하드코딩)를 사용하는 경우 JWT id가 DB _id와 다를 수 있음
      // 가능한 모든 userId 후보를 수집하여 $in으로 검색
      const possibleIds: string[] = [targetUserId];
      try {
        if (ObjectId.isValid(targetUserId)) {
          const targetUser = await db.collection('users').findOne({ _id: new ObjectId(targetUserId) });
          if (targetUser) {
            possibleIds.push(targetUser._id.toString());
            if (targetUser.username) {
              // username 기반 하드코딩 사용자 ID 패턴 매칭
              // (TEST_USERS에서 id: "master_001" 같은 케이스)
              possibleIds.push(targetUser.username);
              // master role인 경우 "master_001" 패턴도 추가
              if (targetUser.role === 'master') {
                possibleIds.push('master_001');
              }
            }
          }
        }
      } catch (e) {
        console.error('[AI Chat] 사용자 조회 오류:', e);
      }

      // ai_chats_v2에 실제 어떤 userId가 저장되어 있는지도 역으로 확인
      // (userName으로 검색하여 실제 사용된 userId 발견)
      try {
        const targetUser = ObjectId.isValid(targetUserId)
          ? await db.collection('users').findOne({ _id: new ObjectId(targetUserId) })
          : null;
        if (targetUser?.name) {
          const chatByName = await db.collection('ai_chats_v2').findOne({ userName: targetUser.name });
          if (chatByName?.userId) {
            possibleIds.push(chatByName.userId);
          }
        }
      } catch (e) {
        // ignore
      }

      const uniqueIds = Array.from(new Set(possibleIds));
      userIdFilter = uniqueIds.length === 1
        ? { userId: uniqueIds[0] }
        : { userId: { $in: uniqueIds } };
    } else {
      userIdFilter = { userId: user?.userId || auth.user.id };
    }

    // clinicId가 없는 기존 데이터도 포함 (마이그레이션 누락 호환)
    const query = { $or: [{ clinicId }, { clinicId: { $exists: false } }], ...userIdFilter, isArchived: { $ne: true } };
    const total = await db.collection('ai_chats_v2').countDocuments(query);

    const conversations = await db.collection('ai_chats_v2')
      .find(query)
      .project({
        userId: 1,
        userName: 1,
        title: 1,
        pageContext: 1,
        pageTitle: 1,
        createdAt: 1,
        updatedAt: 1,
        'messages': { $slice: -1 },  // 마지막 메시지만
      })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      success: true,
      conversations: conversations.map(c => ({ ...c, _id: c._id.toString() })),
      total,
    });
  } catch (error) {
    console.error('[AI Chat] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'AI 대화 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 메시지 전송 및 AI 응답
export async function POST(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const user = extractUserFromRequest(request);

    const body = await request.json();
    const { conversationId, message, pageContext, pageTitle, contextData } = body;

    if (!message?.trim()) {
      return NextResponse.json({ success: false, error: '메시지를 입력해주세요.' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'AI 서비스가 설정되지 않았습니다.' }, { status: 500 });
    }

    const { db } = await connectToDatabase();
    const clinicId = auth.user.clinicId;
    const now = new Date().toISOString();

    // 새 메시지 객체
    const userMessage = {
      role: 'user' as const,
      content: message.trim(),
      timestamp: now,
      pageContext: pageContext || '',
    };

    let conversation;
    let isNewConversation = false;

    // 기존 대화 로드 또는 새 대화 생성
    const userId = user?.userId || auth.user.id;
    const userName = user?.userName || auth.user.name;

    if (conversationId) {
      conversation = await db.collection('ai_chats_v2').findOne({
        _id: new ObjectId(conversationId),
        userId,
      });
    }

    if (!conversation) {
      isNewConversation = true;
      const newConversation = {
        clinicId,
        userId,
        userName,
        title: generateTitle(message),
        pageContext: pageContext || '',
        pageTitle: pageTitle || '',
        messages: [],
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      };
      const result = await db.collection('ai_chats_v2').insertOne(newConversation);
      conversation = { ...newConversation, _id: result.insertedId };
    }

    // 메시지 기반 병원 데이터 자동 검색 (페이지 무관, 항상 실행)
    const searchedData = await searchClinicDataFromMessage(message, db, clinicId);
    // 페이지 컨텍스트 + 검색 데이터 병합
    const mergedContextData = {
      ...(contextData || {}),
      ...searchedData,
    };
    if (Object.keys(searchedData).length > 0) {
      console.log('[AI Chat] 자동 검색 데이터:', Object.keys(searchedData));
    }

    // PII 마스킹 — OpenAI에 개인정보 전송 방지
    const piiMasker = new PIIMasker();
    const maskedContextData = piiMasker.maskContextData(mergedContextData);

    // 시스템 프롬프트 생성 (마스킹된 데이터 사용)
    const systemPrompt = buildSystemPrompt(pageContext || '', pageTitle || '', maskedContextData);

    // 대화 이력에서 최근 N개만 사용
    const recentMessages = (conversation.messages || []).slice(-MAX_CONTEXT_MESSAGES);

    // OpenAI API 호출 (대화 이력과 사용자 메시지도 마스킹)
    const maskedRecentMessages = piiMasker.maskMessages(recentMessages);
    const maskedUserMessage = piiMasker.maskUserMessage(message.trim());

    const openaiMessages = [
      { role: 'developer', content: systemPrompt },
      ...maskedRecentMessages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: maskedUserMessage },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: openaiMessages,
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Chat] OpenAI API 오류:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: 'AI 응답 생성 중 오류가 발생했습니다.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    // AI 응답에서 마스킹된 값을 원본으로 복원
    const assistantContent = piiMasker.unmaskText(data.choices[0]?.message?.content || '');

    if (!assistantContent) {
      return NextResponse.json(
        { success: false, error: 'AI 응답이 비어있습니다.' },
        { status: 502 }
      );
    }

    const assistantMessage = {
      role: 'assistant' as const,
      content: assistantContent,
      timestamp: new Date().toISOString(),
    };

    // DB 업데이트 — 메시지 추가
    await db.collection('ai_chats_v2').updateOne(
      { _id: conversation._id },
      {
        $push: { messages: { $each: [userMessage, assistantMessage] } } as any,
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    return NextResponse.json({
      success: true,
      conversationId: conversation._id.toString(),
      message: assistantMessage,
      title: isNewConversation ? conversation.title : undefined,
    });
  } catch (error) {
    console.error('[AI Chat] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'AI 채팅 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 대화 삭제 (아카이브)
export async function DELETE(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const user = extractUserFromRequest(request);

    const { searchParams } = request.nextUrl;
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ success: false, error: 'conversationId가 필요합니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('ai_chats_v2').updateOne(
      { _id: new ObjectId(conversationId), userId: user?.userId || auth.user.id },
      { $set: { isArchived: true, updatedAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: '대화를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI Chat] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: '대화 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
