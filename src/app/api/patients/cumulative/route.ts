// src/app/api/patients/cumulative/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    console.log('전체 누적 환자 데이터 조회 시작');
    
    const { db } = await connectToDatabase();
    const collection = db.collection('patients');
    
    // 전체 환자 데이터 조회 (종결된 환자 포함)
    const allPatients = await collection
      .find({}) // 모든 환자 조회
      .sort({ createdAt: -1 }) // 최신순 정렬
      .toArray();
    
    // ObjectId를 문자열로 변환
    const processedPatients = allPatients.map(patient => ({
      ...patient,
      _id: patient._id.toString()
    }));
    
    console.log(`전체 누적 환자 데이터 조회 완료: ${processedPatients.length}명`);
    
    return NextResponse.json({
      success: true,
      patients: processedPatients,
      totalCount: processedPatients.length,
      message: '전체 누적 환자 데이터 조회 성공'
    });
    
  } catch (error) {
    console.error('전체 누적 환자 데이터 조회 오류:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '전체 누적 환자 데이터를 불러오는데 실패했습니다.'
      },
      { status: 500 }
    );
  }
}