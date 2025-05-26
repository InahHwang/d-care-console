import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 환경 변수 타입 단언으로 TypeScript 오류 해결
const JWT_SECRET = process.env.JWT_SECRET as string;

// 테스트용 임시 사용자 (실제 운영시에는 제거)
const TEST_USERS = [
  {
    _id: 'test_admin_001',
    email: 'admin@dental.com',
    password: 'admin123',
    name: '관리자',
    role: 'admin'
  },
  {
    _id: 'test_counselor_001', 
    email: 'counselor@dental.com',
    password: 'counselor123',
    name: '상담사',
    role: 'counselor'
  }
];

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    // 입력 유효성 검사
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '이메일과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    let user = null;

    // 1. 먼저 테스트 사용자 확인 (개발/테스트용)
    const testUser = TEST_USERS.find(u => u.email === email);
    if (testUser && testUser.password === password) {
      user = testUser;
    } else {
      // 2. 실제 데이터베이스에서 사용자 찾기
      try {
        const { db } = await connectToDatabase();
        const dbUser = await db.collection('users').findOne({ email });
        
        if (dbUser && bcrypt.compareSync(password, dbUser.password)) {
          user = dbUser;
        }
      } catch (dbError) {
        console.log('Database connection failed, using test users only');
      }
    }
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }
    
    // JWT_SECRET이 없는 경우 오류 처리
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    
    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role || 'user'
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // 사용자 정보 (비밀번호 제외)
    const userResponse = {
      id: user._id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      role: user.role || 'user'
    };
    
    return NextResponse.json({ 
      success: true, 
      token,
      user: userResponse,
      message: '로그인 성공'
    });
    
  } catch (error: unknown) {
    // 오류 타입 처리 개선
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

// 로그아웃 처리 (토큰 무효화)
export async function DELETE(request: NextRequest) {
  try {
    // 실제로는 토큰을 블랙리스트에 추가하거나 리프레시 토큰을 삭제
    return NextResponse.json({
      message: '로그아웃 성공'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}