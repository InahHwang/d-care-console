// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 환경 변수 타입 단언으로 TypeScript 오류 해결
const JWT_SECRET = process.env.JWT_SECRET as string;

// request 타입 명시
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const { db } = await connectToDatabase();
    
    const user = await db.collection('users').findOne({ email });
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }
    
    // JWT_SECRET이 없는 경우 오류 처리
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    return NextResponse.json({ success: true, token });
  } catch (error: unknown) {
    // 오류 타입 처리 개선
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}