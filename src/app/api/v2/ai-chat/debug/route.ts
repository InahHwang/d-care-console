// 임시 디버그 엔드포인트 — 배포 후 삭제 예정
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { extractUserFromRequest } from '@/utils/auditLog';

export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'no auth' }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    // ai_chats_v2의 모든 문서 userId 확인
    const allChats = await db.collection('ai_chats_v2')
      .find({})
      .project({ userId: 1, userName: 1, title: 1, isArchived: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    // 현재 로그인 사용자 JWT 정보
    const currentJwtUser = {
      userId: user.userId,
      userName: user.userName,
      userRole: user.userRole,
    };

    // users 컬렉션의 사용자 id 필드 확인
    const users = await db.collection('users')
      .find({})
      .project({ _id: 1, id: 1, username: 1, name: 1, role: 1 })
      .toArray();

    const usersFormatted = users.map(u => ({
      _id: u._id.toString(),
      customId: u.id || null,
      username: u.username,
      name: u.name,
      role: u.role,
    }));

    return NextResponse.json({
      currentJwtUser,
      totalChats: allChats.length,
      chats: allChats.map(c => ({
        _id: c._id.toString(),
        userId: c.userId,
        userName: c.userName,
        title: c.title,
        isArchived: c.isArchived,
        createdAt: c.createdAt,
      })),
      users: usersFormatted,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
