// src/app/api/test/patients-v2/[id]/teeth/route.ts
// 치아 번호 확정 API

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

const TEST_COLLECTION = 'patients_v2_test';

// PUT: 치아 번호 확정/수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { selectedTeeth, teethUnknown } = body;

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const patient = await collection.findOne({ _id: new ObjectId(id) });
    if (!patient) {
      return NextResponse.json({ success: false, error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // consultation 객체 업데이트
    const updatedConsultation = {
      ...patient.consultation,
      selectedTeeth: selectedTeeth || [],
      teethUnknown: teethUnknown ?? false
    };

    // 업데이트 실행
    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          consultation: updatedConsultation,
          updatedAt: nowISO
        }
      }
    );

    const updatedPatient = await collection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedPatient,
        _id: updatedPatient?._id.toString()
      }
    });

  } catch (error) {
    console.error('치아 번호 확정 오류:', error);
    return NextResponse.json(
      { success: false, error: '치아 번호 확정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
