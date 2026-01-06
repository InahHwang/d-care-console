// src/app/api/test/patients-v2/[id]/status/route.ts
// 상태 변경 API (phase, status, 내원확인 등)

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { PatientPhase, PatientStatus, PatientResult, ResultReason } from '@/types/patientV2';

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

// PUT: 상태 변경
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 테스트 API - 인증 생략
    const { id } = await params;
    const body = await request.json();
    const {
      action,           // 'confirmVisit', 'confirmReservation', 'cancelReservation', 'complete'
      phase,
      currentStatus,
      result,
      resultReason,
      resultReasonDetail,
      reservation,
      note
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
    const timeStr = nowISO.split('T')[1].substring(0, 5);

    const updateData: any = { updatedAt: nowISO };
    let statusHistoryEntry: any = null;

    switch (action) {
      case 'confirmReservation':
        // 예약 확정
        updateData.phase = '예약확정';
        updateData.currentStatus = null;
        updateData.reservation = {
          date: reservation?.date || '',
          time: reservation?.time || '',
          type: reservation?.type || '초진',
          notes: reservation?.notes || '',
          confirmedAt: nowISO,
          confirmedBy: 'test-user'
        };
        statusHistoryEntry = {
          date: dateStr,
          time: timeStr,
          fromPhase: patient.phase,
          toPhase: '예약확정',
          fromStatus: patient.currentStatus,
          toStatus: null,
          changedBy: 'test-user',
          note: note || '예약 확정'
        };
        break;

      case 'cancelReservation':
        // 예약 취소
        updateData.phase = '전화상담';
        updateData.currentStatus = '예약취소';
        updateData.reservation = null;
        statusHistoryEntry = {
          date: dateStr,
          time: timeStr,
          fromPhase: patient.phase,
          toPhase: '전화상담',
          fromStatus: patient.currentStatus,
          toStatus: '예약취소',
          changedBy: 'test-user',
          note: note || '예약 취소'
        };
        break;

      case 'confirmVisit':
        // 내원 확인 → 내원관리로 전환
        updateData.phase = '내원완료';
        updateData.currentStatus = null;
        updateData.visitConfirmed = true;
        updateData.firstVisitDate = patient.firstVisitDate || dateStr;
        statusHistoryEntry = {
          date: dateStr,
          time: timeStr,
          fromPhase: patient.phase,
          toPhase: '내원완료',
          fromStatus: patient.currentStatus,
          toStatus: null,
          changedBy: 'test-user',
          note: note || '내원 확인'
        };
        break;

      case 'noShow':
        // 노쇼 처리
        updateData.phase = '전화상담';
        updateData.currentStatus = '노쇼';
        statusHistoryEntry = {
          date: dateStr,
          time: timeStr,
          fromPhase: patient.phase,
          toPhase: '전화상담',
          fromStatus: patient.currentStatus,
          toStatus: '노쇼',
          changedBy: 'test-user',
          note: note || '노쇼 처리'
        };
        break;

      case 'complete':
        // 종결 처리
        updateData.phase = '종결';
        updateData.currentStatus = null;
        updateData.result = result as PatientResult;
        updateData.resultReason = resultReason as ResultReason || null;
        updateData.resultReasonDetail = resultReasonDetail || '';
        statusHistoryEntry = {
          date: dateStr,
          time: timeStr,
          fromPhase: patient.phase,
          toPhase: '종결',
          fromStatus: patient.currentStatus,
          toStatus: null,
          changedBy: 'test-user',
          note: note || `종결: ${result}${resultReason ? ` (${resultReason})` : ''}`
        };
        break;

      case 'reopen':
        // 종결 취소 (재오픈)
        updateData.phase = patient.visitConfirmed ? '내원완료' : '전화상담';
        updateData.currentStatus = patient.visitConfirmed ? '재콜백필요' : '콜백필요';
        updateData.result = null;
        updateData.resultReason = null;
        updateData.resultReasonDetail = '';
        statusHistoryEntry = {
          date: dateStr,
          time: timeStr,
          fromPhase: patient.phase,
          toPhase: updateData.phase,
          fromStatus: patient.currentStatus,
          toStatus: updateData.currentStatus,
          changedBy: 'test-user',
          note: note || '종결 취소'
        };
        break;

      default:
        // 수동 상태 변경
        if (phase) updateData.phase = phase as PatientPhase;
        if (currentStatus !== undefined) updateData.currentStatus = currentStatus as PatientStatus;
        if (result !== undefined) updateData.result = result as PatientResult;
        if (resultReason !== undefined) updateData.resultReason = resultReason as ResultReason;
        if (resultReasonDetail !== undefined) updateData.resultReasonDetail = resultReasonDetail;

        if (phase || currentStatus !== undefined) {
          statusHistoryEntry = {
            date: dateStr,
            time: timeStr,
            fromPhase: patient.phase,
            toPhase: phase || patient.phase,
            fromStatus: patient.currentStatus,
            toStatus: currentStatus !== undefined ? currentStatus : patient.currentStatus,
            changedBy: 'test-user',
            note: note || '상태 변경'
          };
        }
    }

    // 업데이트 실행
    const updateQuery: any = { $set: updateData };
    if (statusHistoryEntry) {
      updateQuery.$push = { statusHistory: statusHistoryEntry };
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      updateQuery
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
    console.error('상태 변경 오류:', error);
    return NextResponse.json(
      { success: false, error: '상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
