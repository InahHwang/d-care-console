// src/app/api/v2/consultants/route.ts
// 상담사 목록 조회 API (공개)

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { withCache } from '@/lib/cache';

// 상담사 목록 조회 (인증 불필요 - 드롭다운용)
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const consultants = await withCache(
      `consultants:${clinicId}`,
      10 * 60 * 1000, // 10분 TTL
      async () => {
        const { db } = await connectToDatabase();
        const users = await db.collection('users')
          .find(
            { clinicId, isActive: { $ne: false } },
            { projection: { name: 1, role: 1, department: 1 } }
          )
          .sort({ name: 1 })
          .toArray();

        return users.map((user) => ({
          id: user._id.toString(),
          name: user.name,
          role: user.role,
          department: user.department || '',
        }));
      },
    );

    return NextResponse.json({
      success: true,
      consultants,
    });
  } catch (error) {
    console.error('[Consultants API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
