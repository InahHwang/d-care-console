// src/app/api/v2/ai-chat/route.ts
// AI 채팅 API — GPT-5.2 기반 치과 상담 어시스턴트

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getClinicId } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

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

  // 환자 데이터가 있으면 상세 컨텍스트 추가
  if (contextData && Object.keys(contextData).length > 0) {
    prompt += `\n\n## 현재 보고 있는 환자 데이터 (실제 DB 데이터)
아래는 사용자가 현재 보고 있는 환자의 실제 정보입니다.
질문에 답변할 때 이 데이터를 근거로 구체적이고 맞춤화된 답변을 하세요.

${JSON.stringify(contextData, null, 2)}`;
  }

  prompt += `

## 응답 가이드라인
1. 한국어로 답변하세요.
2. 치과 콜센터 업무에 맞는 실용적 조언을 제공하세요.
3. 환자 접근법, 화법, 상담 전략은 구체적으로 제시하세요.
4. 짧고 명확한 답변을 우선하되, 필요 시 상세히 설명하세요.
5. 환자 개인정보가 포함된 질문에도 업무 목적으로 답변하세요.
6. **환자 데이터가 제공된 경우, 반드시 해당 환자의 실제 상태/이력/메모를 참고하여 구체적으로 답변하세요.**
   - 일반론이 아닌, 이 환자에 맞는 맞춤 전략을 제시하세요.
   - 상태이력, 통화기록, AI요약, 메모 등을 종합적으로 분석하세요.
   - 종결 환자라면 종결 사유와 이력을 분석해 재활성화 가능성을 판단하세요.
7. 사용자가 "OOO 환자"처럼 이름을 언급하면, 시스템이 자동으로 DB에서 해당 환자를 검색해서 데이터를 제공합니다.
   - 검색된 데이터가 있으면 "검색된_환자" 항목에 실제 DB 데이터가 포함되어 있습니다.
   - 이 데이터를 기반으로 구체적인 답변을 하세요.`;

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

// 대화 제목 자동 생성 (첫 메시지 기반)
function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\n/g, ' ').trim();
  if (cleaned.length <= 30) return cleaned;
  return cleaned.substring(0, 27) + '...';
}

// GET: 대화 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const targetUserId = searchParams.get('userId');

    const { db } = await connectToDatabase();
    const clinicId = getClinicId();

    // 관리자는 다른 사용자의 대화도 조회 가능
    const isAdmin = user.userRole === 'admin' || user.userRole === 'master';

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
      userIdFilter = { userId: user.userId };
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
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

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
    const clinicId = getClinicId();
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
    if (conversationId) {
      conversation = await db.collection('ai_chats_v2').findOne({
        _id: new ObjectId(conversationId),
        userId: user.userId,
      });
    }

    if (!conversation) {
      isNewConversation = true;
      const newConversation = {
        clinicId,
        userId: user.userId,
        userName: user.userName,
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

    // 메시지에서 환자 이름 감지 → DB 자동 검색
    let enrichedContextData = contextData;
    if (!contextData || Object.keys(contextData).length === 0) {
      const searchedData = await searchPatientsFromMessage(message, db);
      if (searchedData) {
        enrichedContextData = searchedData;
        console.log('[AI Chat] 메시지에서 환자 자동 검색:', Object.keys(searchedData));
      }
    }

    // 시스템 프롬프트 생성 (환자 데이터 포함)
    const systemPrompt = buildSystemPrompt(pageContext || '', pageTitle || '', enrichedContextData);

    // 대화 이력에서 최근 N개만 사용
    const recentMessages = (conversation.messages || []).slice(-MAX_CONTEXT_MESSAGES);

    // OpenAI API 호출
    const openaiMessages = [
      { role: 'developer', content: systemPrompt },
      ...recentMessages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
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
    const assistantContent = data.choices[0]?.message?.content;

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
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ success: false, error: 'conversationId가 필요합니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('ai_chats_v2').updateOne(
      { _id: new ObjectId(conversationId), userId: user.userId },
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
