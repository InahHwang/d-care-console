// 1. src/app/api/patients/post-visit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    // 🔥 성능 최적화: 필요한 필드만 조회 (Projection)
    const projection = {
      _id: 1,
      id: 1,
      patientId: 1,
      name: 1,
      phoneNumber: 1,
      age: 1,
      gender: 1,
      status: 1,
      consultationType: 1,
      referralSource: 1,
      interestedServices: 1,
      region: 1,
      callInDate: 1,
      reservationDate: 1,
      visitConfirmed: 1,
      postVisitStatus: 1,
      isCompleted: 1,
      callbackHistory: 1,
      memo: 1,
      notes: 1,
      createdAt: 1,
      updatedAt: 1,
      createdBy: 1,
      createdByName: 1,
      lastModifiedBy: 1,
      lastModifiedByName: 1,
      lastModifiedAt: 1,
      postVisitConsultation: 1,
    };

    // 내원확정된 환자들만 가져오기 (Projection 적용)
    const postVisitPatients = await db.collection('patients')
      .find({ visitConfirmed: true }, { projection })
      .sort({ createdAt: -1 })
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
