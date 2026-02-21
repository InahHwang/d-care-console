// src/app/api/v2/invitations/route.ts
// 초대 관리 API (목록 조회, 생성, 삭제)

import { NextRequest, NextResponse } from 'next/server';
import { getInvitationsCollection, getUsersCollection } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import type { Invitation, CreateInvitationRequest, UserRole } from '@/types/invitation';

export const dynamic = 'force-dynamic';

// JWT 토큰 검증 헬퍼
async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as {
      id: string;
      username: string;
      name: string;
      role: string;
    };
    return decoded;
  } catch {
    return null;
  }
}

// 관리자 권한 체크 (admin 또는 레거시 master)
function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'master';
}

// GET: 초대 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const status = searchParams.get('status'); // pending | accepted | expired | cancelled

    const invitationsCollection = await getInvitationsCollection();

    // 필터 구성
    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }

    // 만료된 초대 상태 업데이트 (pending이면서 만료된 것)
    await invitationsCollection.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { status: 'expired' }
      }
    );

    // 초대 목록 조회
    const [invitations, totalCount] = await Promise.all([
      invitationsCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      invitationsCollection.countDocuments(filter)
    ]);

    // 통계
    const stats = await invitationsCollection.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const statsMap = stats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: invitations.map((inv) => ({
        id: inv._id.toString(),
        name: inv.name,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        status: inv.status,
        invitedBy: inv.invitedBy,
        invitedByName: inv.invitedByName,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        createdAt: inv.createdAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        pending: statsMap.pending || 0,
        accepted: statsMap.accepted || 0,
        expired: statsMap.expired || 0,
        cancelled: statsMap.cancelled || 0,
        total: totalCount,
      }
    });
  } catch (error) {
    console.error('[Invitations API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 초대 생성
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body: CreateInvitationRequest = await request.json();
    const { name, email, role } = body;

    // 입력값 검증
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!role || !['admin', 'manager', 'staff'].includes(role)) {
      return NextResponse.json(
        { success: false, error: '유효한 역할을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인 (이메일이 제공된 경우)
    if (email) {
      const usersCollection = await getUsersCollection();
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: '이미 등록된 이메일입니다.' },
          { status: 400 }
        );
      }

      // 대기 중인 초대가 있는지 확인
      const invitationsCollection = await getInvitationsCollection();
      const existingInvitation = await invitationsCollection.findOne({
        email,
        status: 'pending'
      });
      if (existingInvitation) {
        return NextResponse.json(
          { success: false, error: '이미 초대가 발송된 이메일입니다.' },
          { status: 400 }
        );
      }
    }

    const invitationsCollection = await getInvitationsCollection();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 후

    const invitation: Omit<Invitation, '_id'> = {
      name: name.trim(),
      email: email?.trim() || undefined,
      role: role as UserRole,
      token: uuidv4(),
      status: 'pending',
      expiresAt,
      invitedBy: user.id,
      invitedByName: user.name,
      createdAt: now,
    };

    const result = await invitationsCollection.insertOne(invitation);

    // 초대 링크 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/invite/${invitation.token}`;

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...invitation,
        inviteLink,
      },
      message: '초대가 생성되었습니다.',
    });
  } catch (error) {
    console.error('[Invitations API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 초대 취소
export async function DELETE(request: NextRequest) {
  try {
    // 인증 확인
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!isAdminRole(user.role)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효한 초대 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const invitationsCollection = await getInvitationsCollection();

    // 초대 찾기
    const invitation = await invitationsCollection.findOne({
      _id: new ObjectId(id)
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: '초대를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 수락된 초대는 취소 불가
    if (invitation.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: '이미 수락된 초대는 취소할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 초대 취소
    await invitationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'cancelled' } }
    );

    return NextResponse.json({
      success: true,
      message: '초대가 취소되었습니다.',
    });
  } catch (error) {
    console.error('[Invitations API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
