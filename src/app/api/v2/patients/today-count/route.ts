// src/app/api/v2/patients/today-count/route.ts
// 오늘(KST) 등록된 환자 수 — 사이드바 N 배지용
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyToken(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('patients_v2');
    const clinicId = auth.user.clinicId;

    // KST 기준 오늘 0시~24시를 UTC 범위로 계산
    // (KST = UTC+9, 따라서 KST 00:00 = UTC 전날 15:00)
    const todayKST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
    const startKST = new Date(`${todayKST}T00:00:00+09:00`);
    const endKST = new Date(`${todayKST}T23:59:59.999+09:00`);

    const count = await collection.countDocuments({
      clinicId,
      deletedAt: { $exists: false },
      createdAt: { $gte: startKST, $lte: endKST },
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('[today-count] error:', error);
    return NextResponse.json(
      { success: false, message: '오늘 등록 환자 수 조회 실패' },
      { status: 500 }
    );
  }
}
