// src/app/api/activity-logs/[id]/route.ts 

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT 토큰 검증 및 사용자 정보 추출
async function verifyToken(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 필요합니다.');
  }

  const token = authorization.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    throw new Error('유효하지 않은 토큰입니다.');
  }
}

// 마스터 권한 확인
function requireMasterRole(user: any) {
  if (user.role !== 'master') {
    throw new Error('마스터 관리자 권한이 필요합니다.');
  }
}

// 개별 활동 로그 삭제 (DELETE) - 🔥 로깅 제외 버전
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await verifyToken(request);
    requireMasterRole(currentUser);

    const { db } = await connectToDatabase();
    const activityLogsCollection = db.collection('activityLogs');

    // ObjectId 유효성 검사
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 로그 ID입니다.' },
        { status: 400 }
      );
    }

    // 로그 존재 확인
    const log = await activityLogsCollection.findOne({ _id: new ObjectId(params.id) });
    
    if (!log) {
      return NextResponse.json(
        { success: false, message: '로그를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 🔥 로그 삭제 (삭제 액션 자체는 로깅하지 않음)
    const result = await activityLogsCollection.deleteOne({ _id: new ObjectId(params.id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: '로그 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 🔥 실제 총 개수 반환 (실시간 동기화용)
    const remainingCount = await activityLogsCollection.countDocuments();

    return NextResponse.json({
      success: true,
      message: '활동 로그가 성공적으로 삭제되었습니다.',
      remainingCount // 🔥 남은 로그 개수 반환
    });

  } catch (error) {
    console.error('활동 로그 삭제 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '활동 로그 삭제에 실패했습니다.';
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: error instanceof Error && error.message.includes('권한') ? 403 : 500 }
    );
  }
}