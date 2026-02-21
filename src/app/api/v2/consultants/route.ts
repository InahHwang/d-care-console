// src/app/api/v2/consultants/route.ts
// 상담사 목록 조회 API (공개)

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

// 상담사 목록 조회 (인증 불필요 - 드롭다운용)
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // 활성 사용자만 조회 (이름만 반환)
    const users = await usersCollection
      .find(
        { clinicId, isActive: { $ne: false } },
        { projection: { name: 1, role: 1, department: 1 } }
      )
      .sort({ name: 1 })
      .toArray();

    // 이름과 역할만 반환
    const consultants = users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      department: user.department || '',
    }));

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
