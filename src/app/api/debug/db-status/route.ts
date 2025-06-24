// src/app/api/debug/db-status/route.ts
import { NextResponse } from 'next/server';
import connectDB from '@/utils/mongodb';

export async function GET() {
  try {
    const client = await connectDB;
    const db = client.db(); // 기본 데이터베이스 사용
    
    // 기본 연결 정보
    const dbInfo = {
      status: 'connected',
      dbName: db.databaseName,
      mongoUri: process.env.MONGODB_URI?.replace(/\/\/.*:.*@/, '//***:***@'), // 보안상 마스킹
    };

    // 컬렉션 목록과 문서 수 확인
    const collections = await db.listCollections().toArray();
    const collectionStats = await Promise.all(
      collections.map(async (collection) => {
        const count = await db.collection(collection.name).countDocuments();
        return {
          name: collection.name,
          documentCount: count
        };
      })
    );

    // 사용자 정보 확인 (민감한 정보 제외)
    const usersCollection = db.collection('users');
    const userCount = await usersCollection.countDocuments();
    const adminUsers = await usersCollection.find(
      { role: 'admin' }, 
      { projection: { username: 1, role: 1, createdAt: 1, _id: 1 } }
    ).toArray();

    // 환자 정보 기본 통계
    const patientsCollection = db.collection('patients');
    const patientCount = await patientsCollection.countDocuments();
    const recentPatients = await patientsCollection.find(
      {}, 
      { 
        projection: { name: 1, phone: 1, createdAt: 1, _id: 1 },
        sort: { createdAt: -1 },
        limit: 5
      }
    ).toArray();

    return NextResponse.json({
      ...dbInfo,
      collections: collectionStats,
      stats: {
        totalUsers: userCount,
        totalPatients: patientCount,
        adminUsers: adminUsers.length
      },
      samples: {
        adminUsers: adminUsers,
        recentPatients: recentPatients
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('DB Status Check Error:', error);
    return NextResponse.json({
      status: 'error',
      error: error?.message || 'Unknown error occurred',
      mongoUri: process.env.MONGODB_URI?.replace(/\/\/.*:.*@/, '//***:***@'),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}