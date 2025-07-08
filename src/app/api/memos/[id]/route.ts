// src/app/api/memos/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

interface JWTPayload {
  _id: string;
  role: string;
}

// 인증 토큰 검증
async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

// PUT: 메모 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 마스터 권한 확인
    if (user.role !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();

    // ObjectId 유효성 검사
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: '유효하지 않은 메모 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const memosCollection = db.collection('memos');

    // 메모 존재 및 소유권 확인
    const existingMemo = await memosCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    });

    if (!existingMemo) {
      return NextResponse.json({ error: '메모를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 업데이트할 필드들
    const updateFields: any = {
      updatedAt: new Date().toISOString(),
    };

    // 허용된 필드만 업데이트
    const allowedFields = ['title', 'content', 'position', 'size', 'color', 'isMinimized', 'zIndex'];
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    });

    // 메모 업데이트
    const result = await memosCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: '메모 업데이트에 실패했습니다.' }, { status: 400 });
    }

    // 업데이트된 메모 조회
    const updatedMemo = await memosCollection.findOne({ _id: new ObjectId(id) });

    const formattedMemo = {
      ...updatedMemo,
      _id: updatedMemo!._id.toString(),
      id: updatedMemo!._id.toString(),
    };

    return NextResponse.json({ 
      success: true, 
      memo: formattedMemo 
    });

  } catch (error) {
    console.error('메모 수정 오류:', error);
    return NextResponse.json(
      { error: '메모 수정에 실패했습니다.' }, 
      { status: 500 }
    );
  }
}

// DELETE: 메모 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 마스터 권한 확인
    if (user.role !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { id } = params;

    // ObjectId 유효성 검사
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: '유효하지 않은 메모 ID입니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const memosCollection = db.collection('memos');

    // 메모 존재 및 소유권 확인
    const existingMemo = await memosCollection.findOne({
      _id: new ObjectId(id),
      userId: user._id
    });

    if (!existingMemo) {
      return NextResponse.json({ error: '메모를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 메모 삭제
    const result = await memosCollection.deleteOne({
      _id: new ObjectId(id),
      userId: user._id
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '메모 삭제에 실패했습니다.' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '메모가 삭제되었습니다.' 
    });

  } catch (error) {
    console.error('메모 삭제 오류:', error);
    return NextResponse.json(
      { error: '메모 삭제에 실패했습니다.' }, 
      { status: 500 }
    );
  }
}