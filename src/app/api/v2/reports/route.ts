// src/app/api/v2/reports/route.ts
// V2 월별 보고서 CRUD - 목록 조회 + 보고서 생성

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/utils/mongodb';
import { calculateMonthlyStatsV2 } from '@/utils/monthlyReportV2Calculator';

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
// GET - 보고서 목록 조회
// ============================================

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const reports = await db
      .collection('reports_v2')
      .find(
        {},
        {
          projection: {
            _id: 1,
            yearMonth: 1,
            year: 1,
            month: 1,
            status: 1,
            createdByName: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        }
      )
      .sort({ yearMonth: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: reports.map((r) => ({
        ...r,
        _id: r._id.toString(),
      })),
    });
  } catch (error) {
    console.error('[Reports V2] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - 새 월별 보고서 생성
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { year, month } = body;

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 년/월입니다.' },
        { status: 400 }
      );
    }

    const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;

    const { db } = await connectToDatabase();

    // 중복 체크
    const existing = await db.collection('reports_v2').findOne({ yearMonth });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `${year}년 ${month}월 보고서가 이미 존재합니다.` },
        { status: 409 }
      );
    }

    console.log(`[Reports V2] ${yearMonth} 보고서 생성 시작`);

    // 통계 계산
    const stats = await calculateMonthlyStatsV2(db, year, month);

    const now = new Date().toISOString();
    const reportDoc = {
      yearMonth,
      year,
      month,
      status: 'draft' as const,
      stats,
      managerAnswers: {
        question1: '',
        question2: '',
        question3: '',
        question4: '',
      },
      directorFeedbacks: [],
      createdBy: user.id,
      createdByName: user.name || user.username,
      generatedDate: new Date().toLocaleDateString('ko-KR'),
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('reports_v2').insertOne(reportDoc);

    console.log(`[Reports V2] ${yearMonth} 보고서 생성 완료: ${result.insertedId}`);

    return NextResponse.json({
      success: true,
      data: {
        ...reportDoc,
        _id: result.insertedId.toString(),
      },
    });
  } catch (error) {
    console.error('[Reports V2] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
