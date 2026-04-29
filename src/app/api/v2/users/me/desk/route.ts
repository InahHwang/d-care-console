// src/app/api/v2/users/me/desk/route.ts
// 본인 데스크(전화번호) 설정/변경 API
// - currentDeskNumber: 오늘 사용 중인 자리 (자동 매핑용)
// - defaultDeskNumber: 영구 저장 자리 (출근 시 자동 복원 기본값)
// - 빈 문자열 = "자리 없음" (자동 매핑 비활성)
// - 1자리=1사람 점유: 자리 변경 시 같은 currentDeskNumber 보유한 다른 사용자는 자동 해제

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

// user.id가 ObjectId 형식이거나 string일 수 있어 두 형태 모두 시도
function buildIdFilter(rawId: string): Array<Record<string, unknown>> {
  const filters: Array<Record<string, unknown>> = [];
  try {
    filters.push({ _id: new ObjectId(rawId) });
  } catch {
    // ObjectId 변환 실패는 무시 (string id 사용자)
  }
  filters.push({ _id: rawId as any });
  return filters;
}

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
    const idFilters = buildIdFilter(auth.user.id);

    // 1자리=1사람 점유 해제: 같은 currentDeskNumber 보유한 다른 사용자의 currentDeskNumber 제거
    // (defaultDeskNumber는 그대로 유지 — 다음 출근 때 본인 자리로 다시 복원되도록)
    if (deskNumber !== NO_DESK_VALUE) {
      await usersCollection.updateMany(
        {
          currentDeskNumber: deskNumber,
          $nor: idFilters,
        },
        {
          $unset: { currentDeskNumber: '' },
          $set: { currentDeskUpdatedAt: updatedAt },
        }
      );
    }

    // 본인 자리 업데이트: default + current 동시 set
    const update =
      deskNumber === NO_DESK_VALUE
        ? {
            $set: {
              defaultDeskNumber: '', // 의도적 자리 없음 (다음 로그인에 다이얼로그 안 뜸)
              currentDeskUpdatedAt: updatedAt,
            },
            $unset: { currentDeskNumber: '' },
          }
        : {
            $set: {
              currentDeskNumber: deskNumber,
              defaultDeskNumber: deskNumber,
              currentDeskUpdatedAt: updatedAt,
            },
          };

    let result = null;
    for (const filter of idFilters) {
      result = await usersCollection.findOneAndUpdate(filter, update, {
        returnDocument: 'after',
      });
      if (result) break;
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
        defaultDeskNumber: deskNumber,
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

// 본인 현재/기본 데스크 조회
export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const idFilters = buildIdFilter(auth.user.id);

    let user: any = null;
    for (const filter of idFilters) {
      user = await usersCollection.findOne(filter, {
        projection: {
          currentDeskNumber: 1,
          currentDeskUpdatedAt: 1,
          defaultDeskNumber: 1,
        },
      });
      if (user) break;
    }

    if (!user) {
      return NextResponse.json({ message: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        currentDeskNumber: user.currentDeskNumber || null,
        currentDeskUpdatedAt: user.currentDeskUpdatedAt || null,
        // defaultDeskNumber: 필드 부재 시 undefined로 응답 (신규 사용자 판정용)
        defaultDeskNumber:
          user.defaultDeskNumber === undefined ? undefined : user.defaultDeskNumber,
        hasDefault: user.defaultDeskNumber !== undefined,
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
