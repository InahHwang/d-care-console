// src/app/api/v2/patients/[id]/consultations/route.ts
// 환자별 통합 상담 이력 API (전화 + 채팅)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 통합 상담 이력 타입
interface ConsultationItem {
  id: string;
  type: 'call' | 'chat' | 'manual';
  channel?: string;         // 채팅 채널 (kakao, naver, website)
  direction?: string;       // 통화 방향 (inbound, outbound)
  date: string;
  summary?: string;
  content?: string;         // 수동 입력 내용
  consultantName?: string;  // 상담자 (수동 입력용)
  manualType?: string;      // 수동 입력 유형 (phone, visit, other)
  source?: 'ai' | 'manual' | 'system';
  aiAnalysis?: {
    interest?: string;
    temperature?: string;
    summary?: string;
    followUp?: string;
  };
  duration?: number;        // 통화 시간 (초)
  status?: string;          // 통화 상태 (connected, missed)
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: patientId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'all' | 'call' | 'chat' | 'manual' | null;
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 환자 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // 환자 존재 확인
    const patient = await db.collection('patients_v2').findOne({
      _id: new ObjectId(patientId),
    });

    if (!patient) {
      return NextResponse.json(
        { success: false, error: '환자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const consultations: ConsultationItem[] = [];

    // 통화 기록 조회
    if (!type || type === 'all' || type === 'call') {
      const callLogs = await db
        .collection('callLogs_v2')
        .find({ patientId })
        .sort({ startedAt: -1 })
        .limit(limit)
        .toArray();

      for (const call of callLogs) {
        consultations.push({
          id: call._id.toString(),
          type: 'call',
          direction: call.direction,
          date: call.startedAt,
          summary: call.aiAnalysis?.summary,
          source: 'ai',
          aiAnalysis: call.aiAnalysis
            ? {
                interest: call.aiAnalysis.interest,
                temperature: call.aiAnalysis.temperature,
                summary: call.aiAnalysis.summary,
                followUp: call.aiAnalysis.followUp,
              }
            : undefined,
          duration: call.duration,
          status: call.status,
        });
      }
    }

    // 채팅 기록 조회
    if (!type || type === 'all' || type === 'chat') {
      const chats = await db
        .collection('channelChats_v2')
        .find({ patientId })
        .sort({ lastMessageAt: -1 })
        .limit(limit)
        .toArray();

      for (const chat of chats) {
        consultations.push({
          id: chat._id.toString(),
          type: 'chat',
          channel: chat.channel,
          date: chat.lastMessageAt || chat.createdAt,
          summary: chat.aiAnalysis?.summary,
          source: 'ai',
          aiAnalysis: chat.aiAnalysis
            ? {
                interest: chat.aiAnalysis.interest,
                temperature: chat.aiAnalysis.temperature,
                summary: chat.aiAnalysis.summary,
                followUp: chat.aiAnalysis.followUp,
              }
            : undefined,
        });
      }
    }

    // 수동 상담 이력 조회
    if (!type || type === 'all' || type === 'manual') {
      const manualConsultations = await db
        .collection('manualConsultations_v2')
        .find({ patientId })
        .sort({ date: -1 })
        .limit(limit)
        .toArray();

      for (const manual of manualConsultations) {
        consultations.push({
          id: manual._id.toString(),
          type: 'manual',
          manualType: manual.type,  // 'visit', 'phone', 'other' 등
          date: manual.date,
          content: manual.content,
          summary: manual.content,
          consultantName: manual.consultantName,
          source: manual.source || 'manual',  // 'consultation_result' 또는 'manual'
          status: manual.status,  // 🆕 내원상담 결과 (agreed/disagreed/pending)
        });
      }
    }

    // 날짜순 정렬 (최신순)
    consultations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // limit 적용
    const limitedConsultations = consultations.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: limitedConsultations,
      total: consultations.length,
      patient: {
        id: patient._id.toString(),
        name: patient.name,
        phone: patient.phone,
      },
    });
  } catch (error) {
    console.error('[통합 상담 이력] 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '상담 이력을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
