// src/app/api/memos/route.ts

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

// GET: 사용자의 메모 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 마스터 권한 확인
    if (user.role !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    const memosCollection = db.collection('memos');

    // 사용자의 메모 목록 조회 (생성일 순으로 정렬)
    const memos = await memosCollection
      .find({ userId: user._id })
      .sort({ createdAt: -1 })
      .toArray();

    // MongoDB ObjectId를 문자열로 변환
    const formattedMemos = memos.map(memo => ({
      ...memo,
      _id: memo._id.toString(),
      id: memo._id.toString(),
    }));

    return NextResponse.json({ 
      success: true, 
      memos: formattedMemos 
    });

  } catch (error) {
    console.error('메모 조회 오류:', error);
    return NextResponse.json(
      { error: '메모를 불러오는데 실패했습니다.' }, 
      { status: 500 }
    );
  }
}

// POST: 새 메모 생성
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 마스터 권한 확인
    if (user.role !== 'master') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, position, color } = body;

    const { db } = await connectToDatabase();
    const memosCollection = db.collection('memos');

    // 기본값 설정
    const newMemo = {
      title: title || '새 메모',
      content: content || '',
      position: position || { x: 100, y: 100 },
      size: { width: 300, height: 200 },
      color: color || '#fef3c7',
      isMinimized: false,
      zIndex: 1001,
      userId: user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await memosCollection.insertOne(newMemo);

    const createdMemo = {
      ...newMemo,
      _id: result.insertedId.toString(),
      id: result.insertedId.toString(),
    };

    return NextResponse.json({ 
      success: true, 
      memo: createdMemo 
    }, { status: 201 });

  } catch (error) {
    console.error('메모 생성 오류:', error);
    return NextResponse.json(
      { error: '메모 생성에 실패했습니다.' }, 
      { status: 500 }
    );
  }
}