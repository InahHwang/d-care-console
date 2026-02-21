// src/app/api/debug/count-patients/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const { db } = await connectToDatabase();
    
    const totalPatients = await db.collection('patients').countDocuments();
    const totalUsers = await db.collection('users').countDocuments();
    
    // 사용자들 정보
    const users = await db.collection('users').find({}).toArray();
    
    return NextResponse.json({
      총환자수: totalPatients,
      총사용자수: totalUsers,
      사용자목록: users.map(u => ({
        username: u.username,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}