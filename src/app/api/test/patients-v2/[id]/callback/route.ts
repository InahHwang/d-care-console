// src/app/api/test/patients-v2/[id]/callback/route.ts
// 콜백 기록 등록 API

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { CallbackRecord, PatientPhase, PatientStatus } from '@/types/patientV2';

const TEST_COLLECTION = 'patients_v2_test';

function verifyToken(token: string) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.');
    }
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (error) {
    return jwt.decode(token) as any;
  }
}

function getTokenFromRequest(request: NextRequest): string | null {
  return request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('token')?.value ||
    request.headers.get('cookie')?.split('token=')[1]?.split(';')[0] ||
    null;
}

// POST: 콜백 기록 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 테스트 API - 인증 생략
    const { id } = await params;
    const body = await request.json();
    const { type, result, notes, nextCallbackDate } = body;

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    // 기존 환자 조회
    const patient = await collection.findOne({ _id: new ObjectId(id) });
    if (!patient) {
      return NextResponse.json({ success: false, error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const dateStr = nowISO.split('T')[0];
    const timeStr = nowISO.split('T')[1].substring(0, 5);

    // 콜백 타입 결정 (preVisit or postVisit)
    const callbackType = type || (patient.visitConfirmed ? 'postVisit' : 'preVisit');
    const callbackField = callbackType === 'postVisit' ? 'postVisitCallbacks' : 'preVisitCallbacks';
    const existingCallbacks = patient[callbackField] || [];

    // 새 콜백 기록
    const newCallback: CallbackRecord = {
      attempt: existingCallbacks.length + 1,
      date: dateStr,
      time: timeStr,
      result: result,
      notes: notes || '',
      counselorId: 'test-user',
      createdAt: nowISO
    };

    // 상태 업데이트 결정
    let newPhase: PatientPhase = patient.phase;
    let newStatus: PatientStatus | null = patient.currentStatus;
    let statusHistoryEntry = null;

    switch (result) {
      case '부재중':
        newStatus = '부재중';
        break;
      case '콜백재요청':
        newStatus = callbackType === 'postVisit' ? '재콜백필요' : '콜백필요';
        break;
      case '예약확정':
        newPhase = '예약확정';
        newStatus = null;
        break;
      case '예약취소':
        newPhase = '전화상담';
        newStatus = '예약취소';
        break;
      case '치료동의':
        newPhase = '종결';
        newStatus = null;
        break;
      case '치료거부':
        newPhase = '종결';
        newStatus = null;
        break;
      case '보류':
        if (callbackType === 'postVisit') {
          newStatus = '재콜백필요';
        } else {
          newStatus = '잠재고객';
        }
        break;
      case '통화완료':
        // 통화완료는 상태 변경 없음, 메모만 기록
        break;
    }

    // 상태가 변경되었으면 이력 추가
    if (newPhase !== patient.phase || newStatus !== patient.currentStatus) {
      statusHistoryEntry = {
        date: dateStr,
        time: timeStr,
        fromPhase: patient.phase,
        toPhase: newPhase,
        fromStatus: patient.currentStatus,
        toStatus: newStatus,
        changedBy: 'test-user',
        note: `${existingCallbacks.length + 1}차 콜백: ${result}`
      };
    }

    // 업데이트 쿼리 구성
    const updateQuery: any = {
      $push: { [callbackField]: newCallback },
      $set: {
        phase: newPhase,
        currentStatus: newStatus,
        updatedAt: nowISO
      }
    };

    // 결과에 따른 추가 처리
    if (result === '치료동의') {
      updateQuery.$set.result = '동의';
    } else if (result === '치료거부') {
      updateQuery.$set.result = '미동의';
    }

    // 다음 콜백 예정일 설정
    if (nextCallbackDate) {
      updateQuery.$set.nextCallbackDate = nextCallbackDate;
    }

    // 상태 이력 추가
    if (statusHistoryEntry) {
      updateQuery.$push.statusHistory = statusHistoryEntry;
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      updateQuery
    );

    // 업데이트된 환자 조회
    const updatedPatient = await collection.findOne({ _id: new ObjectId(id) });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedPatient,
        _id: updatedPatient?._id.toString()
      },
      callback: newCallback
    });

  } catch (error) {
    console.error('콜백 등록 오류:', error);
    return NextResponse.json(
      { success: false, error: '콜백 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
