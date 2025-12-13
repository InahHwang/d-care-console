// src/app/api/patient/alert/route.ts
// 환자 알림 API - 에이전트용

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

interface PatientAlert {
  type: string;
  message: string;
  referralId?: string;
  priority?: 'high' | 'medium' | 'low';
}

// GET - 환자 알림 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chartNo = searchParams.get('chartNo');
    const patientId = searchParams.get('patientId');
    const phoneNumber = searchParams.get('phoneNumber');

    if (!chartNo && !patientId && !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'chartNo, patientId, or phoneNumber is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const alerts: PatientAlert[] = [];

    // 환자 찾기
    let patient = null;
    if (patientId) {
      try {
        patient = await db.collection('patients').findOne({ _id: new ObjectId(patientId) });
      } catch {
        // Invalid ObjectId format, try as string
        patient = await db.collection('patients').findOne({ _id: patientId as unknown as ObjectId });
      }
    } else if (chartNo) {
      patient = await db.collection('patients').findOne({ chartNo });
    } else if (phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      patient = await db.collection('patients').findOne({
        $or: [
          { phoneNumber: phoneNumber },
          { phoneNumber: normalizedPhone },
          { phoneNumber: { $regex: normalizedPhone.slice(-8) + '$' } }
        ]
      });
    }

    if (!patient) {
      return NextResponse.json({
        success: true,
        hasAlert: false,
        alerts: [],
        message: 'Patient not found'
      });
    }

    const patientIdStr = patient._id.toString();

    // 1. 소개 관련 알림 - 이 환자가 소개자인 경우
    const referralAlerts = await db.collection('referrals').find({
      referrerId: patientIdStr,
      thanksSent: false,
      nextVisitAlert: true
    }).toArray();

    for (const referral of referralAlerts) {
      alerts.push({
        type: 'referral_thanks',
        message: referral.alertMessage || `${referral.referredName} 환자 소개해주신 분입니다. 감사인사 전달해주세요.`,
        referralId: referral._id.toString(),
        priority: 'high'
      });
    }

    // 2. 추가 알림 타입들 (확장 가능)
    // - 생일 알림
    // - 정기검진 알림
    // - VIP 환자 알림 등

    // 생일 알림 (예시)
    if (patient.birthDate) {
      const today = new Date();
      const birthDate = new Date(patient.birthDate);
      if (today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate()) {
        alerts.push({
          type: 'birthday',
          message: `오늘 ${patient.name}님의 생일입니다!`,
          priority: 'medium'
        });
      }
    }

    // VIP 환자 알림 (예시)
    if (patient.isVIP || patient.grade === 'VIP') {
      alerts.push({
        type: 'vip',
        message: 'VIP 환자입니다. 특별한 응대 부탁드립니다.',
        priority: 'medium'
      });
    }

    return NextResponse.json({
      success: true,
      hasAlert: alerts.length > 0,
      alerts,
      patient: {
        id: patientIdStr,
        name: patient.name,
        chartNo: patient.chartNo,
        phoneNumber: patient.phoneNumber
      }
    });

  } catch (error) {
    console.error('[Patient Alert API] GET 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
