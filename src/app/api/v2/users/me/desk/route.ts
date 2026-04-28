// src/app/api/v2/users/me/desk/route.ts
// 본인 데스크(전화번호) 설정/변경 API
// - 자동 환자 등록 시 incoming-call의 calledNumber로 user를 매핑하기 위함
// - 빈 문자열 = "자리 없음" (자동 매핑 비활성)

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';
import { isValidDeskNumber, NO_DESK_VALUE } from '@/constants/desks';

export const dynamic = 'force-dynamic';

const deskSchema = z.object({
  deskNumber: z.string(), // 빈 문자열 허용 (자리 없음)
});

export async function PUT(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const parsed = deskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const deskNumber = parsed.data.deskNumber.trim();
    if (!isValidDeskNumber(deskNumber)) {
      return NextResponse.json(
        { message: '유효하지 않은 데스크 번호입니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const updatedAt = new Date().toISOString();

    // user.id가 ObjectId 형식이 아닐 수도 있어 두 가지 모두 시도
    let result = null;
    try {
      result = await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(auth.user.id) },
        {
          $set: {
            currentDeskNumber: deskNumber,
            currentDeskUpdatedAt: updatedAt,
          },
        },
        { returnDocument: 'after' }
      );
    } catch {
      // ObjectId 변환 실패 시 string id로 재시도
      result = await usersCollection.findOneAndUpdate(
        { _id: auth.user.id as any },
        {
          $set: {
            currentDeskNumber: deskNumber,
            currentDeskUpdatedAt: updatedAt,
          },
        },
        { returnDocument: 'after' }
      );
    }

    if (!result) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        currentDeskNumber: deskNumber === NO_DESK_VALUE ? null : deskNumber,
        currentDeskUpdatedAt: updatedAt,
      },
    });
  } catch (error) {
    console.error('PUT /users/me/desk error:', error);
    return NextResponse.json(
      { message: '데스크 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 본인 현재 데스크 조회 (선택적 — 로그인 시 user 객체에 포함되므로 보통 안 씀)
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    let user = null;
    try {
      user = await usersCollection.findOne(
        { _id: new ObjectId(auth.user.id) },
        { projection: { currentDeskNumber: 1, currentDeskUpdatedAt: 1 } }
      );
    } catch {
      user = await usersCollection.findOne(
        { _id: auth.user.id as any },
        { projection: { currentDeskNumber: 1, currentDeskUpdatedAt: 1 } }
      );
    }

    if (!user) {
      return NextResponse.json({ message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        currentDeskNumber: user.currentDeskNumber || null,
        currentDeskUpdatedAt: user.currentDeskUpdatedAt || null,
      },
    });
  } catch (error) {
    console.error('GET /users/me/desk error:', error);
    return NextResponse.json(
      { message: '데스크 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
