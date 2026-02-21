// src/app/api/v2/reports/[id]/route.ts
// V2 월별 보고서 개별 관리 - 조회, 수정, 삭제

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/utils/mongodb';
import { calculateMonthlyStatsV2 } from '@/utils/monthlyReportV2Calculator';
import { v4 as uuidv4 } from 'uuid';

// JWT 토큰 검증 헬퍼
function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as {
      id: string;
      username: string;
      name: string;
      role: string;
    };
  } catch {
    return null;
  }
}

// ============================================
// GET - 보고서 상세 조회
// ============================================

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 보고서 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const report = await db.collection('reports_v2').findOne({ _id: new ObjectId(id) });

    if (!report) {
      return NextResponse.json(
        { success: false, error: '보고서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        _id: report._id.toString(),
      },
    });
  } catch (error) {
    console.error('[Reports V2] GET [id] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - 보고서 업데이트
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 보고서 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const report = await db.collection('reports_v2').findOne({ _id: new ObjectId(id) });
    if (!report) {
      return NextResponse.json(
        { success: false, error: '보고서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = { updatedAt: now };

    // 1. 매니저 답변 저장
    if (body.managerAnswers !== undefined) {
      updateFields.managerAnswers = body.managerAnswers;
    }

    // 2. 상태 변경
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'submitted', 'approved'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 상태입니다.' },
          { status: 400 }
        );
      }
      updateFields.status = body.status;
    }

    // 3. 데이터 새로고침
    if (body.refreshStats === true) {
      console.log(`[Reports V2] ${report.yearMonth} 데이터 새로고침`);
      const stats = await calculateMonthlyStatsV2(db, report.year, report.month);
      // 기존 AI 인사이트가 있으면 보존
      if (report.stats?.aiInsights) {
        stats.aiInsights = report.stats.aiInsights;
      }
      updateFields.stats = stats;
    }

    // 3.5. AI 인사이트 생성
    if (body.generateAIInsights === true) {
      console.log(`[Reports V2] ${report.yearMonth} AI 인사이트 생성`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentStats = (updateFields.stats || report.stats) as any;

      try {
        const { generateAIInsights } = await import('@/utils/monthlyReportAIInsights');
        const aiResult = await generateAIInsights(currentStats);

        const aiInsightsData = {
          insights: aiResult.insights,
          generatedAt: aiResult.generatedAt,
          model: aiResult.model,
        };

        if (updateFields.stats) {
          (updateFields.stats as Record<string, unknown>).aiInsights = aiInsightsData;
        } else {
          updateFields['stats.aiInsights'] = aiInsightsData;
        }
      } catch (aiError) {
        console.error('[Reports V2] AI 인사이트 생성 실패:', aiError);
        // 실패해도 요청 자체는 성공 처리 (규칙 기반 인사이트 유지)
      }
    }

    // 4. 피드백 관리
    if (body.feedbackAction) {
      const feedbacks = [...(report.directorFeedbacks || [])];

      switch (body.feedbackAction) {
        case 'add': {
          if (!body.feedbackData?.content?.trim() || !body.feedbackData?.targetSection) {
            return NextResponse.json(
              { success: false, error: '피드백 내용과 대상 섹션이 필요합니다.' },
              { status: 400 }
            );
          }
          const newFeedback = {
            feedbackId: uuidv4(),
            content: body.feedbackData.content.trim(),
            targetSection: body.feedbackData.targetSection,
            createdBy: user.id,
            createdByName: user.name || user.username,
            createdAt: now,
          };
          feedbacks.push(newFeedback);
          break;
        }

        case 'update': {
          if (!body.feedbackId || !body.feedbackData?.content?.trim()) {
            return NextResponse.json(
              { success: false, error: '피드백 ID와 내용이 필요합니다.' },
              { status: 400 }
            );
          }
          const idx = feedbacks.findIndex((f: { feedbackId: string }) => f.feedbackId === body.feedbackId);
          if (idx === -1) {
            return NextResponse.json(
              { success: false, error: '피드백을 찾을 수 없습니다.' },
              { status: 404 }
            );
          }
          feedbacks[idx] = {
            ...feedbacks[idx],
            content: body.feedbackData.content.trim(),
            updatedAt: now,
          };
          break;
        }

        case 'delete': {
          if (!body.feedbackId) {
            return NextResponse.json(
              { success: false, error: '피드백 ID가 필요합니다.' },
              { status: 400 }
            );
          }
          const deleteIdx = feedbacks.findIndex((f: { feedbackId: string }) => f.feedbackId === body.feedbackId);
          if (deleteIdx === -1) {
            return NextResponse.json(
              { success: false, error: '피드백을 찾을 수 없습니다.' },
              { status: 404 }
            );
          }
          feedbacks.splice(deleteIdx, 1);
          break;
        }
      }

      updateFields.directorFeedbacks = feedbacks;
    }

    await db.collection('reports_v2').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    // 업데이트된 보고서 반환
    const updated = await db.collection('reports_v2').findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      data: updated ? { ...updated, _id: updated._id.toString() } : null,
    });
  } catch (error) {
    console.error('[Reports V2] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - 보고서 삭제
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 보고서 ID입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('reports_v2').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: '보고서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    console.log(`[Reports V2] 보고서 삭제: ${id} by ${user.name}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Reports V2] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
