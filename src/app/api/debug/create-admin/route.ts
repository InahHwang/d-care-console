// src/app/api/debug/create-admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/utils/mongodb';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    const { tempPassword, adminUsername = 'admin', adminPassword = 'admin2025!' } = await request.json();
    
    // 임시 비밀번호 확인
    if (tempPassword !== 'temp-recovery-2025') {
      return NextResponse.json({ error: '임시 비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    const client = await connectDB;
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // 기존 관리자 계정 확인
    const existingAdmin = await usersCollection.findOne({ role: 'admin' });
    
    if (existingAdmin) {
      return NextResponse.json({ 
        message: '관리자 계정이 이미 존재합니다.',
        admin: {
          id: existingAdmin._id,
          username: existingAdmin.username,
          role: existingAdmin.role,
          createdAt: existingAdmin.createdAt
        }
      });
    }

    // 새 관리자 계정 생성
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const newAdmin = {
      username: adminUsername,
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
      lastLogin: null,
      isActive: true
    };

    const result = await usersCollection.insertOne(newAdmin);

    return NextResponse.json({
      success: true,
      message: '관리자 계정이 생성되었습니다.',
      admin: {
        id: result.insertedId,
        username: adminUsername,
        role: 'admin',
        createdAt: newAdmin.createdAt
      },
      credentials: {
        username: adminUsername,
        password: adminPassword,
        note: '이 정보를 안전한 곳에 저장하세요.'
      }
    });

  } catch (error: any) {
    console.error('Create Admin Error:', error);
    return NextResponse.json({
      error: '관리자 계정 생성 중 오류가 발생했습니다.',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

// 기존 사용자 목록 조회
export async function GET() {
  try {
    const client = await connectDB;
    const db = client.db();
    const usersCollection = db.collection('users');
    
    const users = await usersCollection.find(
      {},
      { 
        projection: { 
          username: 1, 
          role: 1, 
          createdAt: 1, 
          lastLogin: 1, 
          isActive: 1,
          password: 0 // 비밀번호는 제외
        } 
      }
    ).toArray();

    const userStats = {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      managers: users.filter(u => u.role === 'manager').length,
      users: users.filter(u => u.role === 'user').length,
      active: users.filter(u => u.isActive !== false).length
    };

    return NextResponse.json({
      users,
      stats: userStats,
      hasAdmin: userStats.admins > 0
    });

  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed to fetch users'
    }, { status: 500 });
  }
}