// src/app/api/test/patients-v2/[id]/consultation/route.ts
// 내원 상담 정보 등록/수정 API

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PostVisitConsultationV2 } from '@/types/patientV2';

const TEST_COLLECTION = 'patients_v2_test';

// PUT: 내원 상담 정보 등록/수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      regularPrice,
      discountPrice,
      discountReason,
      diagnosisNotes,
      treatmentRecommendation,
      patientResponse,
      followUpPlan,
      doctorName
    } = body;

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const patient = await collection.findOne({ _id: new ObjectId(id) });
    if (!patient) {
      return NextResponse.json({ success: false, error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const dateStr = nowISO.split('T')[0];

    // 할인율 계산
    const regular = regularPrice || 0;
    const discount = discountPrice || regular;
    const discountRate = regular > 0 ? Math.round((1 - discount / regular) * 100) : 0;

    // 내원 상담 정보 구성
    const postVisitConsultation: PostVisitConsultationV2 = {
      visitDate: patient.firstVisitDate || dateStr,
      doctorName: doctorName || '',
      diagnosisNotes: diagnosisNotes || '',
      treatmentRecommendation: treatmentRecommendation || '',
      estimateInfo: {
        regularPrice: regular,
        discountPrice: discount,
        discountRate,
        discountReason: discountReason || '',
        treatmentPlan: treatmentRecommendation || '',
        estimateDate: dateStr
      },
      patientResponse: patientResponse || '',
      followUpPlan: followUpPlan || ''
    };

    // 업데이트 실행
    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          postVisitConsultation,
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
    console.error('내원 상담 정보 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: '내원 상담 정보 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
