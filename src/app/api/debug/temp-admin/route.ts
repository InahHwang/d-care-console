// src/app/api/debug/temp-admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { tempPassword } = await request.json();
    
    // 임시 비밀번호 확인 (보안상 하드코딩된 임시 값)
    if (tempPassword !== 'temp-recovery-2025') {
      return NextResponse.json({ error: '임시 비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    const client = await connectDB;
    const db = client.db(); // 기본 데이터베이스 사용
    const usersCollection = db.collection('users');
    
    // 기존 관리자 계정 찾기
    const adminUser = await usersCollection.findOne({ role: 'admin' });
    
    if (!adminUser) {
      return NextResponse.json({ 
        error: '관리자 계정을 찾을 수 없습니다.',
        suggestion: '새 관리자 계정을 생성해야 합니다.'
      }, { status: 404 });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        userId: adminUser._id,
        username: adminUser.username,
        role: adminUser.role 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    // 응답에 토큰 설정
    const response = NextResponse.json({
      success: true,
      user: {
        id: adminUser._id,
        username: adminUser.username,
        role: adminUser.role
      },
      message: '임시 로그인 성공'
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400 // 24시간
    });

    return response;

  } catch (error: any) {
    console.error('Temp Admin Login Error:', error);
    return NextResponse.json({
      error: '임시 로그인 중 오류가 발생했습니다.',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

// 관리자 계정 정보 조회
export async function GET() {
  try {
    const client = await connectDB;
    const db = client.db(); // 기본 데이터베이스 사용
    const usersCollection = db.collection('users');
    
    const adminUsers = await usersCollection.find(
      { role: 'admin' },
      { projection: { username: 1, role: 1, createdAt: 1, lastLogin: 1 } }
    ).toArray();

    return NextResponse.json({
      adminUsers,
      count: adminUsers.length,
      hasAdmins: adminUsers.length > 0
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}