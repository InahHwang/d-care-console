// src/app/api/v2/migrate/deletion-requests-index/route.ts
// [삭제 승인 워크플로우] deletionRequests_v2 인덱스 생성
// 1회성 실행 — 운영 환경에서 GET 호출로 실행
//
// 조회 패턴:
//  - 대시보드 승인 목록: { clinicId, status } 정렬 requestedAt
//  - 환자 상세 배지:    { clinicId, patientId, status }
//  - 중복 요청 방지:    { clinicId, patientId, type, status }

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

const COLLECTION = 'deletionRequests_v2';

const INDEXES: Array<{ index: Record<string, 1 | -1>; name: string }> = [
  { index: { clinicId: 1, status: 1, requestedAt: -1 }, name: 'idx_clinic_status_requested' },
  { index: { clinicId: 1, patientId: 1, status: 1 }, name: 'idx_clinic_patient_status' },
];

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const results: Array<{ name: string; status: string }> = [];
    for (const idx of INDEXES) {
      try {
        await db.collection(COLLECTION).createIndex(idx.index, { name: idx.name });
        results.push({ name: idx.name, status: 'created' });
      } catch (err) {
        // 이미 존재(85)는 무시
        const code = (err as { code?: number })?.code;
        results.push({ name: idx.name, status: code === 85 ? 'exists' : 'error' });
      }
    }

    return NextResponse.json({ success: true, collection: COLLECTION, indexes: results });
  } catch (error) {
    console.error('[Migration deletion-requests-index] 오류:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
