// src/app/api/v2/callbacks/route.ts
// 콜백/리콜 관리 API
// patients_v2의 nextActionDate와 callbacks_v2 모두 조회

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { CallbackV2, CallbackType, CallbackStatus } from '@/types/v2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const status = searchParams.get('status') as CallbackStatus | null;
    const type = searchParams.get('type') as CallbackType | null;
    const patientId = searchParams.get('patientId'); // 특정 환자의 콜백만 조회
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const { db } = await connectToDatabase();

    // 1. callbacks_v2 컬렉션에서 조회
    const callbackFilter: Record<string, unknown> = {};
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      callbackFilter.scheduledAt = { $gte: startOfDay, $lte: endOfDay };
    }
    if (status) callbackFilter.status = status;
    if (type) callbackFilter.type = type;
    if (patientId) callbackFilter.patientId = patientId;

    const callbacksFromCollection = await db.collection<CallbackV2>('callbacks_v2')
      .aggregate([
        { $match: callbackFilter },
        { $sort: { scheduledAt: 1 } },
        {
          $lookup: {
            from: 'patients_v2',
            let: { patientId: { $toObjectId: '$patientId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$patientId'] } } },
              { $project: { name: 1, phone: 1, interest: 1, temperature: 1, status: 1 } }
            ],
            as: 'patient'
          }
        },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } }
      ])
      .toArray();

    // 2. patients_v2의 nextActionDate에서 조회 (기존 데이터 호환)
    const patientFilter: Record<string, unknown> = {
      nextActionDate: { $exists: true, $ne: null }
    };

    // patientId로 필터링 (특정 환자만 조회)
    if (patientId) {
      try {
        patientFilter._id = new ObjectId(patientId);
      } catch {
        // ObjectId 변환 실패 시 빈 결과 반환
        patientFilter._id = null;
      }
    }

    if (date) {
      // 날짜 문자열 또는 Date 객체 모두 처리
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      patientFilter.$or = [
        // Date 객체로 저장된 경우
        { nextActionDate: { $gte: startOfDay, $lte: endOfDay } },
        // ISO 문자열로 저장된 경우
        { nextActionDate: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        // YYYY-MM-DD 형식으로 저장된 경우
        { nextActionDate: { $regex: `^${date}` } }
      ];
      delete patientFilter.nextActionDate;
    }

    // 이미 callbacks_v2에 있는 환자는 제외 (중복 방지)
    const existingPatientIds = callbacksFromCollection.map(cb => cb.patientId);
    if (existingPatientIds.length > 0) {
      patientFilter._id = { $nin: existingPatientIds.map(id => {
        try { return new ObjectId(id); } catch { return id; }
      }) };
    }

    const patientsWithNextAction = await db.collection('patients_v2')
      .find(patientFilter)
      .project({ name: 1, phone: 1, interest: 1, temperature: 1, status: 1, nextAction: 1, nextActionDate: 1 })
      .sort({ nextActionDate: 1 })
      .toArray();

    // 3. 두 데이터 소스 병합
    const callbacksFromPatients = patientsWithNextAction.map(patient => ({
      _id: patient._id,
      patientId: patient._id.toString(),
      patient: {
        name: patient.name,
        phone: patient.phone,
        interest: patient.interest,
        temperature: patient.temperature,
        status: patient.status,
      },
      type: (patient.nextAction === '리콜' ? 'recall' :
             patient.nextAction === '감사전화' ? 'thanks' : 'callback') as CallbackType,
      scheduledAt: patient.nextActionDate,
      status: 'pending' as CallbackStatus,
      note: patient.nextAction,
      source: 'patient', // 데이터 출처 표시
    }));

    // type 필터 적용
    let filteredPatientsCallbacks = callbacksFromPatients;
    if (type) {
      filteredPatientsCallbacks = callbacksFromPatients.filter(cb => cb.type === type);
    }

    // 전체 병합 및 정렬
    const allCallbacks = [...callbacksFromCollection, ...filteredPatientsCallbacks]
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    // 페이지네이션 적용
    const paginatedCallbacks = allCallbacks.slice((page - 1) * limit, page * limit);
    const totalCount = allCallbacks.length;

    // 4. 오늘 통계 (두 소스 합산)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];

    // callbacks_v2 통계
    const [callbackStats] = await db.collection('callbacks_v2').aggregate([
      {
        $match: {
          scheduledAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
          callback: { $sum: { $cond: [{ $eq: ['$type', 'callback'] }, 1, 0] } },
          recall: { $sum: { $cond: [{ $eq: ['$type', 'recall'] }, 1, 0] } },
          thanks: { $sum: { $cond: [{ $eq: ['$type', 'thanks'] }, 1, 0] } },
        }
      }
    ]).toArray();

    // patients_v2 통계 (오늘 nextActionDate인 환자)
    const patientTodayCount = await db.collection('patients_v2').countDocuments({
      $or: [
        { nextActionDate: { $gte: today, $lt: tomorrow } },
        { nextActionDate: { $gte: today.toISOString(), $lt: tomorrow.toISOString() } },
        { nextActionDate: { $regex: `^${todayStr}` } }
      ]
    });

    const baseStats = callbackStats || { total: 0, pending: 0, completed: 0, missed: 0, callback: 0, recall: 0, thanks: 0 };

    return NextResponse.json({
      success: true,
      data: {
        callbacks: paginatedCallbacks.map((cb) => ({
          id: cb._id?.toString(),
          patientId: cb.patientId,
          patientName: cb.patient?.name || '알 수 없음',
          patientPhone: cb.patient?.phone || '',
          patientInterest: cb.patient?.interest || '',
          patientTemperature: cb.patient?.temperature || 'warm',
          patientStatus: cb.patient?.status || 'consulting',
          type: cb.type,
          scheduledAt: cb.scheduledAt,
          status: cb.status,
          note: cb.note,
          completedAt: (cb as CallbackV2).completedAt,
          source: (cb as any).source || 'callbacks_v2',
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        todayStats: {
          total: baseStats.total + patientTodayCount,
          pending: baseStats.pending + patientTodayCount,
          completed: baseStats.completed,
          missed: baseStats.missed,
          callback: baseStats.callback + patientTodayCount, // 기본적으로 콜백으로 간주
          recall: baseStats.recall,
          thanks: baseStats.thanks,
        },
      },
    });
  } catch (error) {
    console.error('[Callbacks API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 콜백 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, type, scheduledAt, note } = body;

    if (!patientId || !type || !scheduledAt) {
      return NextResponse.json(
        { success: false, error: 'patientId, type, scheduledAt are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    const newCallback = {
      patientId,
      type: type as CallbackType,
      scheduledAt: new Date(scheduledAt),
      status: 'pending' as CallbackStatus,
      note,
      createdAt: now,
    };

    const result = await db.collection('callbacks_v2').insertOne(newCallback);

    // 환자의 nextAction 업데이트
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      {
        $set: {
          nextAction: type === 'callback' ? '콜백' : type === 'recall' ? '리콜' : '감사전화',
          nextActionDate: scheduledAt,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newCallback,
      },
    });
  } catch (error) {
    console.error('[Callbacks API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 콜백 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, note, source } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'id and status are required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 1. 먼저 callbacks_v2에서 찾기
    let result = await db.collection('callbacks_v2').findOne({ _id: new ObjectId(id) });

    if (result) {
      // callbacks_v2에 있는 경우 - 기존 로직
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: now,
      };

      if (status === 'completed') {
        updateData.completedAt = now;
      }

      if (note !== undefined) {
        updateData.note = note;
      }

      result = await db.collection('callbacks_v2').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // 2. callbacks_v2에 없으면 patients_v2의 nextActionDate 기반 콜백일 수 있음
    // id가 실제로 patientId인 경우
    const patient = await db.collection('patients_v2').findOne({ _id: new ObjectId(id) });

    if (patient && patient.nextActionDate) {
      // 환자 기반 콜백 완료 처리
      if (status === 'completed') {
        // callbacks_v2에 완료 레코드 생성
        const newCallback = {
          patientId: id,
          type: patient.nextAction === '리콜' ? 'recall' :
                patient.nextAction === '감사전화' ? 'thanks' : 'callback',
          scheduledAt: new Date(patient.nextActionDate),
          status: 'completed' as CallbackStatus,
          note: note || patient.nextAction,
          completedAt: now,
          createdAt: now,
        };

        const insertResult = await db.collection('callbacks_v2').insertOne(newCallback);

        // 환자의 nextActionDate 클리어
        await db.collection('patients_v2').updateOne(
          { _id: new ObjectId(id) },
          {
            $unset: { nextActionDate: '', nextAction: '' },
            $set: { updatedAt: now },
          }
        );

        return NextResponse.json({
          success: true,
          data: {
            _id: insertResult.insertedId,
            ...newCallback,
          },
        });
      } else if (status === 'missed') {
        // 미연결 처리 - callbacks_v2에 레코드 생성
        const newCallback = {
          patientId: id,
          type: patient.nextAction === '리콜' ? 'recall' :
                patient.nextAction === '감사전화' ? 'thanks' : 'callback',
          scheduledAt: new Date(patient.nextActionDate),
          status: 'missed' as CallbackStatus,
          note: note || patient.nextAction,
          createdAt: now,
        };

        const insertResult = await db.collection('callbacks_v2').insertOne(newCallback);

        return NextResponse.json({
          success: true,
          data: {
            _id: insertResult.insertedId,
            ...newCallback,
          },
        });
      }
    }

    // 3. 둘 다 아닌 경우
    return NextResponse.json(
      { success: false, error: 'Callback not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Callbacks API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 콜백 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('callbacks_v2').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Callback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Callback deleted',
    });
  } catch (error) {
    console.error('[Callbacks API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
