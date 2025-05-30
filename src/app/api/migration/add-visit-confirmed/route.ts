// src/app/api/migration/add-visit-confirmed/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    console.log('visitConfirmed 필드 추가 마이그레이션 시작...');
    
    // visitConfirmed 필드가 없는 환자들 찾기
    const patientsWithoutField = await db.collection('patients')
      .find({ visitConfirmed: { $exists: false } })
      .toArray();
    
    console.log(`visitConfirmed 필드가 없는 환자 수: ${patientsWithoutField.length}`);
    
    if (patientsWithoutField.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 환자에게 이미 visitConfirmed 필드가 존재합니다.',
        updatedCount: 0
      });
    }
    
    // visitConfirmed 필드를 false로 추가
    const result = await db.collection('patients').updateMany(
      { visitConfirmed: { $exists: false } },
      { 
        $set: { 
          visitConfirmed: false,
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    console.log(`마이그레이션 완료. 업데이트된 환자 수: ${result.modifiedCount}`);
    
    return NextResponse.json({
      success: true,
      message: `visitConfirmed 필드가 ${result.modifiedCount}명의 환자에게 추가되었습니다.`,
      updatedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
    
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '마이그레이션 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      }, 
      { status: 500 }
    );
  }
}