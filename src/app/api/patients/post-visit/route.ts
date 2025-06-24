// 1. src/app/api/patients/post-visit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    // 내원확정된 환자들만 가져오기
    const postVisitPatients = await db.collection('patients')
      .find({ visitConfirmed: true })
      .toArray();
    
    // MongoDB의 ObjectId를 문자열로 변환
    const patients = postVisitPatients.map((patient: any) => ({
      ...patient,
      _id: patient._id.toString(),
      id: patient.id || patient._id.toString()
    }));
    
    console.log('내원 후 관리 환자 목록 조회:', patients.length, '명');
    
    return NextResponse.json(patients, { status: 200 });
  } catch (error) {
    console.error('내원 후 관리 환자 목록 조회 실패:', error);
    return NextResponse.json({ 
      error: '내원 후 관리 환자 목록을 불러오는데 실패했습니다.' 
    }, { status: 500 });
  }
}
