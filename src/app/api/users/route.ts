// src/app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import bcrypt from 'bcryptjs';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createUserSchema } from '@/lib/validations/schemas';

// 마스터 권한 확인
function requireMasterRole(user: any) {
  if (user.role !== 'master') {
    throw new Error('마스터 관리자 권한이 필요합니다.');
  }
}

// 사용자 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const currentUser = verifyApiToken(request);
    if (!currentUser) return unauthorizedResponse();
    requireMasterRole(currentUser);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const includeInactive = searchParams.get('includeInactive') === 'true'; // 새로 추가

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // 검색 조건 구성
    const filter: any = {};
    
    // 기본적으로 활성 사용자만 조회 (includeInactive가 true인 경우 전체 조회)
    if (!includeInactive) {
      filter.isActive = { $ne: false }; // isActive가 false가 아닌 경우 (true이거나 없는 경우)
    }
    
    if (search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // 총 사용자 수 조회
    const total = await usersCollection.countDocuments(filter);

    // 페이지네이션을 적용한 사용자 목록 조회
    const users = await usersCollection
      .find(filter, { projection: { password: 0 } }) // 비밀번호 제외
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // id 필드 추가 (MongoDB _id를 id로 매핑)
    const formattedUsers = users.map((user: { _id: { toString: () => any; }; }) => ({
      ...user,
      id: user._id.toString()
    }));

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '사용자 목록 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}

// 새 사용자 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const currentUser = verifyApiToken(request);
    if (!currentUser) return unauthorizedResponse();
    requireMasterRole(currentUser);

    const body = await request.json();
    const validation = validateBody(createUserSchema, body);
    if (!validation.success) return validation.response;
    const { username, email, name, password, role, department } = validation.data;

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // 중복 사용자 확인
    const existingUser = await usersCollection.findOne({
      $or: [
        { username },
        { email }
      ]
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          success: false, 
          message: existingUser.username === username 
            ? '이미 존재하는 사용자명입니다.' 
            : '이미 존재하는 이메일입니다.' 
        },
        { status: 409 }
      );
    }

    // 비밀번호 해시화
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 새 사용자 생성 (같은 clinicId로 소속)
    const newUser = {
      username,
      email,
      name,
      password: hashedPassword,
      role,
      department: department || '',
      clinicId: currentUser.clinicId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser.id
    };

    const result = await usersCollection.insertOne(newUser);

    // 응답용 사용자 정보 (비밀번호 제외)
    const userResponse = {
      _id: result.insertedId.toString(),
      id: result.insertedId.toString(),
      username,
      email,
      name,
      role,
      department: department || '',
      isActive: true,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 생성되었습니다.',
      user: userResponse
    });

  } catch (error) {
    console.error('사용자 생성 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '사용자 생성에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}