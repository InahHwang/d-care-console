// src/app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

// 마스터 권한 확인
function requireMasterRole(user: any) {
  if (user.role !== 'master') {
    throw new Error('마스터 관리자 권한이 필요합니다.');
  }
}

// 사용자 정보 조회 (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = verifyApiToken(request);
    if (!currentUser) return unauthorizedResponse();

    // 본인 정보 조회이거나 마스터 권한인 경우에만 허용
    if (currentUser.id !== params.id && currentUser.role !== 'master') {
      return NextResponse.json(
        { success: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // ObjectId로 변환 시도, 실패하면 문자열 ID로 검색
    let user;
    try {
      user = await usersCollection.findOne(
        { _id: new ObjectId(params.id) },
        { projection: { password: 0 } }
      );
    } catch {
      user = await usersCollection.findOne(
        { id: params.id },
        { projection: { password: 0 } }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // id 필드 추가
    const userResponse = {
      ...user,
      id: user._id.toString()
    };

    return NextResponse.json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    console.error('사용자 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '사용자 조회에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}

// 사용자 정보 수정 (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = verifyApiToken(request);
    if (!currentUser) return unauthorizedResponse();

    // 본인 정보 수정이거나 마스터 권한인 경우에만 허용
    const isOwnProfile = currentUser.id === params.id;
    const isMaster = currentUser.role === 'master';
    
    if (!isOwnProfile && !isMaster) {
      return NextResponse.json(
        { success: false, message: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { username, email, name, password, role, department, isActive } = await request.json();

    // 입력 유효성 검사
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (department !== undefined) updateData.department = department;

    // 비밀번호 변경
    if (password) {
      if (password.length < 4) {
        return NextResponse.json(
          { success: false, message: '비밀번호는 최소 4자 이상이어야 합니다.' },
          { status: 400 }
        );
      }
      updateData.password = bcrypt.hashSync(password, 10);
    }

    // 마스터만 role과 isActive 변경 가능
    if (isMaster) {
      if (role !== undefined) {
        if (!['master', 'staff'].includes(role)) {
          return NextResponse.json(
            { success: false, message: '유효하지 않은 역할입니다.' },
            { status: 400 }
          );
        }
        updateData.role = role;
      }
      if (isActive !== undefined) updateData.isActive = isActive;
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // 중복 확인 (자신 제외)
    if (username || email) {
      const duplicateFilter: any = {
        _id: { $ne: new ObjectId(params.id) }
      };
      
      if (username || email) {
        duplicateFilter.$or = [];
        if (username) duplicateFilter.$or.push({ username });
        if (email) duplicateFilter.$or.push({ email });
      }

      const existingUser = await usersCollection.findOne(duplicateFilter);
      
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
    }

    // 사용자 정보 업데이트
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 업데이트된 사용자 정보 조회
    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(params.id) },
      { projection: { password: 0 } }
    );

    const userResponse = {
      ...updatedUser,
      id: updatedUser?._id.toString()
    };

    return NextResponse.json({
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      user: userResponse
    });

  } catch (error) {
    console.error('사용자 수정 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '사용자 수정에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}

// 사용자 삭제 (DELETE) - 소프트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = verifyApiToken(request);
    if (!currentUser) return unauthorizedResponse();
    requireMasterRole(currentUser);

    // 자기 자신은 삭제할 수 없음
    if (currentUser.id === params.id) {
      return NextResponse.json(
        { success: false, message: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // 사용자 존재 확인
    const user = await usersCollection.findOne({ _id: new ObjectId(params.id) });
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 하드 삭제 (실제 데이터베이스에서 제거)
    await usersCollection.deleteOne({ _id: new ObjectId(params.id) });

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '사용자 삭제에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}