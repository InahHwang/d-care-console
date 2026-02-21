// src/app/api/v2/cleanup/orphan-records/route.ts
// 고아 기록 정리 API - 환자가 삭제된 상담/통화 기록 정리

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// GET: 고아 기록 조회 (삭제 전 확인용)
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const orphanRecords: {
      consultations: { id: string; patientId: string; date: Date }[];
      manualConsultations: { id: string; patientId: string; date: Date }[];
      callLogs: { id: string; patientId: string; createdAt: Date }[];
    } = {
      consultations: [],
      manualConsultations: [],
      callLogs: [],
    };

    // 1. consultations_v2에서 고아 기록 찾기
    const consultations = await db.collection('consultations_v2').find({}).toArray();
    for (const c of consultations) {
      if (c.patientId) {
        try {
          const patient = await db.collection('patients_v2').findOne({
            _id: new ObjectId(c.patientId)
          });
          if (!patient) {
            orphanRecords.consultations.push({
              id: c._id.toString(),
              patientId: c.patientId,
              date: c.date,
            });
          }
        } catch {
          orphanRecords.consultations.push({
            id: c._id.toString(),
            patientId: c.patientId,
            date: c.date,
          });
        }
      }
    }

    // 2. manualConsultations_v2에서 고아 기록 찾기
    const manualConsultations = await db.collection('manualConsultations_v2').find({}).toArray();
    for (const m of manualConsultations) {
      if (m.patientId) {
        try {
          const patient = await db.collection('patients_v2').findOne({
            _id: new ObjectId(m.patientId)
          });
          if (!patient) {
            orphanRecords.manualConsultations.push({
              id: m._id.toString(),
              patientId: m.patientId,
              date: m.date,
            });
          }
        } catch {
          orphanRecords.manualConsultations.push({
            id: m._id.toString(),
            patientId: m.patientId,
            date: m.date,
          });
        }
      }
    }

    // 3. callLogs_v2에서 고아 기록 찾기 (patientId가 있는 것만)
    const callLogs = await db.collection('callLogs_v2').find({
      patientId: { $exists: true, $ne: null }
    }).toArray();
    for (const c of callLogs) {
      if (c.patientId) {
        try {
          const patient = await db.collection('patients_v2').findOne({
            _id: new ObjectId(c.patientId)
          });
          if (!patient) {
            orphanRecords.callLogs.push({
              id: c._id.toString(),
              patientId: c.patientId,
              createdAt: c.createdAt,
            });
          }
        } catch {
          orphanRecords.callLogs.push({
            id: c._id.toString(),
            patientId: c.patientId,
            createdAt: c.createdAt,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        consultations: orphanRecords.consultations.length,
        manualConsultations: orphanRecords.manualConsultations.length,
        callLogs: orphanRecords.callLogs.length,
        total: orphanRecords.consultations.length +
               orphanRecords.manualConsultations.length +
               orphanRecords.callLogs.length,
      },
      records: orphanRecords,
    });
  } catch (error) {
    console.error('[Cleanup API] 고아 기록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orphan records' },
      { status: 500 }
    );
  }
}

// DELETE: 고아 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    const deletedCounts = {
      consultations: 0,
      manualConsultations: 0,
      callLogs: 0,
    };

    // 1. consultations_v2에서 고아 기록 삭제
    const consultations = await db.collection('consultations_v2').find({}).toArray();
    for (const c of consultations) {
      if (c.patientId) {
        try {
          const patient = await db.collection('patients_v2').findOne({
            _id: new ObjectId(c.patientId)
          });
          if (!patient) {
            await db.collection('consultations_v2').deleteOne({ _id: c._id });
            deletedCounts.consultations++;
          }
        } catch {
          await db.collection('consultations_v2').deleteOne({ _id: c._id });
          deletedCounts.consultations++;
        }
      }
    }

    // 2. manualConsultations_v2에서 고아 기록 삭제
    const manualConsultations = await db.collection('manualConsultations_v2').find({}).toArray();
    for (const m of manualConsultations) {
      if (m.patientId) {
        try {
          const patient = await db.collection('patients_v2').findOne({
            _id: new ObjectId(m.patientId)
          });
          if (!patient) {
            await db.collection('manualConsultations_v2').deleteOne({ _id: m._id });
            deletedCounts.manualConsultations++;
          }
        } catch {
          await db.collection('manualConsultations_v2').deleteOne({ _id: m._id });
          deletedCounts.manualConsultations++;
        }
      }
    }

    // 3. callLogs_v2에서는 patientId만 해제 (통화 기록 자체는 유지)
    const callLogs = await db.collection('callLogs_v2').find({
      patientId: { $exists: true, $ne: null }
    }).toArray();
    for (const c of callLogs) {
      if (c.patientId) {
        try {
          const patient = await db.collection('patients_v2').findOne({
            _id: new ObjectId(c.patientId)
          });
          if (!patient) {
            await db.collection('callLogs_v2').updateOne(
              { _id: c._id },
              { $unset: { patientId: '' } }
            );
            deletedCounts.callLogs++;
          }
        } catch {
          await db.collection('callLogs_v2').updateOne(
            { _id: c._id },
            { $unset: { patientId: '' } }
          );
          deletedCounts.callLogs++;
        }
      }
    }

    console.log('[Cleanup API] 고아 기록 정리 완료:', deletedCounts);

    return NextResponse.json({
      success: true,
      message: '고아 기록이 정리되었습니다.',
      deleted: deletedCounts,
      total: deletedCounts.consultations +
             deletedCounts.manualConsultations +
             deletedCounts.callLogs,
    });
  } catch (error) {
    console.error('[Cleanup API] 고아 기록 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete orphan records' },
      { status: 500 }
    );
  }
}
