// src/app/api/v2/consultations/route.ts
// 상담 결과 관리 API
// 전화상담(phone) / 내원상담(visit) 결과 기록

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import type { ConsultationV2, ConsultationType, ConsultationStatus } from '@/types/v2';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { createConsultationSchema, updateConsultationSchema } from '@/lib/validations/schemas';

// GET - 상담 이력 조회
export async function GET(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const date = searchParams.get('date'); // YYYY-MM-DD (일보고서용)
    const type = searchParams.get('type') as ConsultationType | null;
    const status = searchParams.get('status') as ConsultationStatus | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const { db } = await connectToDatabase();

    const filter: Record<string, unknown> = {};

    // 특정 환자의 상담 이력
    if (patientId) {
      filter.patientId = patientId;
    }

    // 특정 날짜의 상담 (일보고서용)
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      filter.$or = [
        { date: { $gte: startOfDay, $lte: endOfDay } },
        { date: { $gte: startOfDay.toISOString(), $lte: endOfDay.toISOString() } },
        { date: { $regex: `^${date}` } }
      ];
    }

    // 상담 유형 필터
    if (type) {
      filter.type = type;
    }

    // 상담 결과 필터
    if (status) {
      filter.status = status;
    }

    const consultations = await db.collection<ConsultationV2>('consultations_v2')
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: 'patients_v2',
            let: { patientId: { $toObjectId: '$patientId' } },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$patientId'] } } },
              { $project: { name: 1, phone: 1, gender: 1, age: 1, interest: 1, temperature: 1, status: 1 } }
            ],
            as: 'patient'
          }
        },
        { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } }
      ])
      .toArray();

    const totalCount = await db.collection('consultations_v2').countDocuments(filter);

    return NextResponse.json({
      success: true,
      data: {
        consultations: consultations.map(c => ({
          id: c._id?.toString(),
          patientId: c.patientId,
          patientName: c.patient?.name || '알 수 없음',
          patientPhone: c.patient?.phone || '',
          patientGender: c.patient?.gender,
          patientAge: c.patient?.age,
          type: c.type,
          status: c.status,
          treatment: c.treatment,
          originalAmount: c.originalAmount,
          discountRate: c.discountRate,
          discountAmount: c.discountAmount,
          finalAmount: c.finalAmount,
          discountReason: c.discountReason,
          disagreeReasons: c.disagreeReasons || [],
          correctionPlan: c.correctionPlan,
          appointmentDate: c.appointmentDate,
          callbackDate: c.callbackDate,
          consultantName: c.consultantName,
          inquiry: c.inquiry,
          memo: c.memo,
          aiSummary: c.aiSummary,
          aiGenerated: c.aiGenerated,        // AI 자동 생성 여부
          callLogId: c.callLogId,            // 연결된 통화 기록 ID
          editedAt: c.editedAt,              // 수정 시간
          editedBy: c.editedBy,              // 수정한 상담사
          date: c.date,
          createdAt: c.createdAt,
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Consultations API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 상담 결과 생성
export async function POST(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const body = await request.json();
    const validation = validateBody(createConsultationSchema, body);
    if (!validation.success) return validation.response;
    const {
      patientId,
      type,           // 'phone' | 'visit'
      status,         // 'agreed' | 'disagreed' | 'pending'
      treatment,
      originalAmount,
      discountRate,
      discountReason,
      disagreeReasons,
      correctionPlan,
      appointmentDate,
      callbackDate,
      consultantName,
      inquiry,
      memo,
    } = validation.data;

    const { db } = await connectToDatabase();
    const now = new Date();
    const nowISO = now.toISOString();

    // 금액 계산
    const amount = originalAmount || 0;
    const discount = discountRate || 0;
    const discountAmount = Math.round(amount * (discount / 100));
    const finalAmount = status === 'agreed' ? amount - discountAmount : 0;

    // 상담 기록 생성
    const newConsultation: Omit<ConsultationV2, '_id'> = {
      patientId,
      type: type as ConsultationType,
      status: status as ConsultationStatus,
      date: now,
      treatment: treatment || '',
      originalAmount: amount,
      discountRate: discount,
      discountAmount,
      finalAmount,
      discountReason: discountReason || undefined,
      disagreeReasons: status === 'disagreed' ? disagreeReasons : undefined,
      correctionPlan: status === 'disagreed' ? correctionPlan : undefined,
      appointmentDate: status === 'agreed' && appointmentDate ? new Date(appointmentDate) : undefined,
      callbackDate: (status === 'disagreed' || status === 'pending') && callbackDate
        ? new Date(callbackDate) : undefined,
      consultantName,
      inquiry: inquiry || undefined,
      memo: memo || undefined,
      createdAt: nowISO,
    };

    const result = await db.collection('consultations_v2').insertOne(newConsultation);

    // 환자 상태 업데이트
    const patientUpdate: Record<string, unknown> = {
      updatedAt: nowISO,
    };

    // 동의 시: 상태 변경 + 예약일 설정
    if (status === 'agreed') {
      // 전화상담 동의 → reserved (내원예약)
      // 내원상담 동의 → treatmentBooked (치료예약)
      const newStatus = type === 'phone' ? 'reserved' : 'treatmentBooked';
      patientUpdate.status = newStatus;
      patientUpdate.statusChangedAt = nowISO;

      if (appointmentDate) {
        patientUpdate.nextAction = type === 'phone' ? '내원예약' : '치료예약';
        patientUpdate.nextActionDate = appointmentDate;
      }

      // 금액 정보 업데이트
      if (amount > 0) {
        patientUpdate.estimatedAmount = amount;
      }
    }

    // 미동의/보류 시: 콜백 설정
    if ((status === 'disagreed' || status === 'pending') && callbackDate) {
      patientUpdate.nextAction = '콜백';
      patientUpdate.nextActionDate = callbackDate;

      // callbacks_v2에도 추가
      await db.collection('callbacks_v2').insertOne({
        patientId,
        type: 'callback',
        scheduledAt: new Date(callbackDate),
        status: 'pending',
        note: status === 'disagreed'
          ? `미동의: ${(disagreeReasons || []).join(', ')}`
          : '보류 - 재상담 필요',
        createdAt: nowISO,
      });
    }

    // 환자 정보 업데이트
    await db.collection('patients_v2').updateOne(
      { _id: new ObjectId(patientId) },
      { $set: patientUpdate }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId.toString(),
        ...newConsultation,
      },
    });
  } catch (error) {
    console.error('[Consultations API] POST 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - 상담 결과 수정
export async function PATCH(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const body = await request.json();
    const validation = validateBody(updateConsultationSchema, body);
    if (!validation.success) return validation.response;
    const { id, editedBy, ...updateData } = validation.data as Record<string, any>;

    const { db } = await connectToDatabase();
    const nowISO = new Date().toISOString();

    // 기존 데이터 조회 (금액 재계산 및 수정 추적용)
    const existing = await db.collection('consultations_v2').findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Consultation not found' },
        { status: 404 }
      );
    }

    // 금액 재계산 (필요시)
    if (updateData.originalAmount !== undefined || updateData.discountRate !== undefined) {
      const amount = updateData.originalAmount ?? existing.originalAmount;
      const discount = updateData.discountRate ?? existing.discountRate;
      updateData.discountAmount = Math.round(amount * (discount / 100));
      updateData.finalAmount = (updateData.status ?? existing.status) === 'agreed'
        ? amount - updateData.discountAmount
        : 0;
    }

    // 수정 추적: editedBy가 제공되면 수정 정보 기록
    const updateFields: Record<string, unknown> = {
      ...updateData,
      updatedAt: nowISO,
    };

    // AI 자동생성 기록이 수정되면 editedAt/editedBy 기록
    if (existing.aiGenerated && editedBy) {
      updateFields.editedAt = nowISO;
      updateFields.editedBy = editedBy;
    }

    const result = await db.collection('consultations_v2').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Consultations API] PATCH 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - 상담 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('consultations_v2').deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Consultation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Consultation deleted',
    });
  } catch (error) {
    console.error('[Consultations API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
