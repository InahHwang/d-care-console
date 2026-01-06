// src/app/api/test/patients-v2/[id]/post-visit-status/route.ts
// 내원 후 상태 관리 API (5단계 분류)

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { PostVisitStatusInfo, PostVisitStatus } from '@/types/patientV2';

const TEST_COLLECTION = 'patients_v2_test';

// PUT: 내원 후 상태 변경
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      treatmentStartDate,
      nextVisitDate,
      depositPaid,
      treatmentNotes,
      reason,
      reasonDetail,
      nextCallbackDate,
      expectedDecisionDate,
      expectedStartDate,
      needsSpecialOffer,
      agreedDate,
      canRecontact,
      callbackNotes
    } = body;

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const patient = await collection.findOne({ _id: new ObjectId(id) });
    if (!patient) {
      return NextResponse.json({ success: false, error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // 내원 후 상태 정보 구성
    const postVisitStatusInfo: PostVisitStatusInfo = {
      status: status as PostVisitStatus,
      updatedAt: nowISO
    };

    // 상태별 필드 설정
    switch (status) {
      case '치료진행':
        postVisitStatusInfo.treatmentStartDate = treatmentStartDate;
        postVisitStatusInfo.nextVisitDate = nextVisitDate;
        postVisitStatusInfo.treatmentNotes = treatmentNotes;
        break;

      case '치료예정':
        postVisitStatusInfo.treatmentStartDate = treatmentStartDate; // 치료 예정일
        postVisitStatusInfo.nextVisitDate = nextVisitDate;
        postVisitStatusInfo.depositPaid = depositPaid;
        postVisitStatusInfo.treatmentNotes = treatmentNotes;
        break;

      case '결정대기':
        postVisitStatusInfo.reason = reason;
        postVisitStatusInfo.reasonDetail = reasonDetail;
        postVisitStatusInfo.nextCallbackDate = nextCallbackDate;
        postVisitStatusInfo.expectedDecisionDate = expectedDecisionDate;
        postVisitStatusInfo.callbackNotes = callbackNotes;
        break;

      case '장기보류':
        postVisitStatusInfo.reason = reason;
        postVisitStatusInfo.reasonDetail = reasonDetail;
        postVisitStatusInfo.nextCallbackDate = nextCallbackDate;
        postVisitStatusInfo.expectedStartDate = expectedStartDate;
        postVisitStatusInfo.needsSpecialOffer = needsSpecialOffer;
        postVisitStatusInfo.agreedDate = agreedDate || patient.postVisitStatusInfo?.agreedDate || nowISO.split('T')[0];
        postVisitStatusInfo.callbackNotes = callbackNotes;
        break;

      case '종결':
        postVisitStatusInfo.reason = reason;
        postVisitStatusInfo.reasonDetail = reasonDetail;
        postVisitStatusInfo.canRecontact = canRecontact;
        postVisitStatusInfo.callbackNotes = callbackNotes;
        break;
    }

    // 레거시 result 필드 호환성 업데이트
    let legacyResult = patient.result;
    if (status === '치료진행' || status === '치료예정') {
      legacyResult = '동의';
    } else if (status === '종결') {
      legacyResult = '미동의';
    } else if (status === '결정대기' || status === '장기보류') {
      legacyResult = '보류';
    }

    // 업데이트 실행
    await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          postVisitStatusInfo,
          result: legacyResult,
          resultReason: reason || null,
          resultReasonDetail: reasonDetail || '',
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
    console.error('내원 후 상태 변경 오류:', error);
    return NextResponse.json(
      { success: false, error: '내원 후 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
