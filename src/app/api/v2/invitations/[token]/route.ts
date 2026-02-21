// src/app/api/v2/invitations/[token]/route.ts
// 초대 토큰 검증 및 수락 API

import { NextRequest, NextResponse } from 'next/server';
import { getInvitationsCollection, getUsersCollection } from '@/utils/mongodb';
import bcrypt from 'bcryptjs';
import type { AcceptInvitationRequest } from '@/types/invitation';

export const dynamic = 'force-dynamic';

// GET: 초대 토큰 검증
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, valid: false, error: '초대 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    const invitationsCollection = await getInvitationsCollection();

    // 초대 찾기
    const invitation = await invitationsCollection.findOne({ token });

    if (!invitation) {
      return NextResponse.json({
        success: true,
        valid: false,
        error: '유효하지 않은 초대 링크입니다.',
      });
    }

    // 상태 확인
    if (invitation.status === 'accepted') {
      return NextResponse.json({
        success: true,
        valid: false,
        error: '이미 사용된 초대 링크입니다.',
      });
    }

    if (invitation.status === 'cancelled') {
      return NextResponse.json({
        success: true,
        valid: false,
        error: '취소된 초대 링크입니다.',
      });
    }

    // 만료 확인
    const expiresAt = new Date(invitation.expiresAt);
    if (expiresAt < new Date()) {
      // 상태 업데이트
      await invitationsCollection.updateOne(
        { token },
        { $set: { status: 'expired' } }
      );

      return NextResponse.json({
        success: true,
        valid: false,
        error: '만료된 초대 링크입니다. 관리자에게 새 초대를 요청하세요.',
      });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      invitation: {
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        invitedByName: invitation.invitedByName,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('[Invitation Token API] GET 오류:', error);
    return NextResponse.json(
      { success: false, valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 초대 수락 (회원가입)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body: AcceptInvitationRequest = await request.json();
    const { username, password, name: newName } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: '초대 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // 입력값 검증
    if (!username || !username.trim()) {
      return NextResponse.json(
        { success: false, error: '아이디를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { success: false, error: '아이디는 3자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 6자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const invitationsCollection = await getInvitationsCollection();
    const usersCollection = await getUsersCollection();

    // 초대 찾기
    const invitation = await invitationsCollection.findOne({ token });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 초대 링크입니다.' },
        { status: 400 }
      );
    }

    // 상태 확인
    if (invitation.status !== 'pending') {
      const errorMessages: Record<string, string> = {
        accepted: '이미 사용된 초대 링크입니다.',
        cancelled: '취소된 초대 링크입니다.',
        expired: '만료된 초대 링크입니다.',
      };
      return NextResponse.json(
        { success: false, error: errorMessages[invitation.status] || '유효하지 않은 초대입니다.' },
        { status: 400 }
      );
    }

    // 만료 확인
    const expiresAt = new Date(invitation.expiresAt);
    if (expiresAt < new Date()) {
      await invitationsCollection.updateOne(
        { token },
        { $set: { status: 'expired' } }
      );
      return NextResponse.json(
        { success: false, error: '만료된 초대 링크입니다. 관리자에게 새 초대를 요청하세요.' },
        { status: 400 }
      );
    }

    // 아이디 중복 확인
    const existingUsername = await usersCollection.findOne({
      username: username.trim()
    });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 아이디입니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인 (초대에 이메일이 있는 경우)
    if (invitation.email) {
      const existingEmail = await usersCollection.findOne({
        email: invitation.email
      });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: '이미 등록된 이메일입니다.' },
          { status: 400 }
        );
      }
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    // 사용자 생성
    const newUser = {
      username: username.trim(),
      email: invitation.email || `${username.trim()}@placeholder.local`,
      name: newName?.trim() || invitation.name,
      password: hashedPassword,
      role: invitation.role,
      isActive: true,
      department: '',
      createdAt: now,
      updatedAt: now,
      createdBy: invitation.invitedBy,
    };

    const result = await usersCollection.insertOne(newUser);

    // 초대 상태 업데이트
    await invitationsCollection.updateOne(
      { token },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedUserId: result.insertedId.toString(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 로그인해주세요.',
      userId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error('[Invitation Token API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
