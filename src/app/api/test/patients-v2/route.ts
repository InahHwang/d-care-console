// src/app/api/test/patients-v2/route.ts
// 테스트용 환자 API (v2 구조)

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { PatientV2, PatientPhase, PatientStatus, CallbackRecord } from '@/types/patientV2';

const TEST_COLLECTION = 'patients_v2_test';

// JWT 검증
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

// 인증 확인
function getTokenFromRequest(request: NextRequest): string | null {
  return request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('token')?.value ||
    request.headers.get('cookie')?.split('token=')[1]?.split(';')[0] ||
    null;
}

// GET: 환자 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 테스트 API - 인증 생략
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // consultation, visit, all
    const phase = searchParams.get('phase');
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const sortBy = searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);
    const usersCollection = db.collection('users');

    // 사용자 맵 생성
    const users = await usersCollection.find({}).toArray();
    const userMap = new Map<string, string>();
    users.forEach(user => {
      userMap.set(user._id.toString(), user.name || user.username || '');
    });

    // 쿼리 조건 구성
    const query: any = { isDeleted: { $ne: true } };

    // consultation_all: 모든 환자 (내원확인 포함, 상담관리용)
    // consultation: 내원확인 안된 환자만
    // visit: 내원확인된 환자만
    if (type === 'consultation') {
      query.visitConfirmed = false;
    } else if (type === 'consultation_all') {
      // visitConfirmed 필터 없음 - 모든 환자 조회
    } else if (type === 'visit') {
      query.visitConfirmed = true;
    }

    if (phase) {
      query.phase = phase;
    }

    if (status) {
      query.currentStatus = status;
    }

    if (date) {
      query.$or = [
        { callInDate: date },
        { firstVisitDate: date },
        { 'preVisitCallbacks.date': date },
        { 'postVisitCallbacks.date': date }
      ];
    }

    // 검색 (이름 또는 전화번호)
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex }
      ];
    }

    // 총 개수 조회
    const totalCount = await collection.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // 정렬 및 페이지네이션
    const sortOption: any = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * limit;

    const patients = await collection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    // 사용자 이름 매핑
    const patientsWithNames = patients.map(patient => ({
      ...patient,
      _id: patient._id.toString(),
      assignedToName: userMap.get(patient.assignedTo) || patient.assignedTo,
      preVisitCallbacks: (patient.preVisitCallbacks || []).map((cb: CallbackRecord) => ({
        ...cb,
        counselorName: userMap.get(cb.counselorId) || cb.counselorId
      })),
      postVisitCallbacks: (patient.postVisitCallbacks || []).map((cb: CallbackRecord) => ({
        ...cb,
        counselorName: userMap.get(cb.counselorId) || cb.counselorId
      }))
    }));

    return NextResponse.json({
      success: true,
      data: patientsWithNames,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('환자 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '환자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 환자 등록
export async function POST(request: NextRequest) {
  try {
    // 테스트 API - 인증 생략
    const body = await request.json();
    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const now = new Date().toISOString();

    const newPatient: Omit<PatientV2, '_id'> = {
      // 기본 정보
      name: body.name || '',
      phone: body.phone || '',
      gender: body.gender || '',
      age: body.age || null,
      address: body.address || '',

      // 유입 정보
      callInDate: body.callInDate || now.split('T')[0],
      source: body.source || '',
      consultationType: body.consultationType || '인바운드',

      // 관리 영역
      visitConfirmed: false,
      firstVisitDate: null,

      // 상태
      phase: '전화상담',
      currentStatus: '신규',
      result: null,
      resultReason: null,
      resultReasonDetail: '',

      // 담당자
      assignedTo: body.assignedTo || 'test-user',
      createdBy: 'test-user',

      // 상담 정보
      // 치아가 선택되지 않았으면 자동으로 teethUnknown: true 설정
      consultation: {
        selectedTeeth: body.selectedTeeth || [],
        teethUnknown: body.teethUnknown !== undefined
          ? body.teethUnknown
          : (body.selectedTeeth && body.selectedTeeth.length > 0 ? false : true),
        interestedServices: body.interestedServices || [],
        consultationNotes: body.consultationNotes || '',
        estimatedAmount: body.estimatedAmount || 0,
        consultationDate: now.split('T')[0]
      },

      // 예약 정보
      reservation: null,

      // 콜백 기록
      preVisitCallbacks: [],
      postVisitCallbacks: [],

      // 내원 상담
      postVisitConsultation: null,

      // 내원 후 상태 관리
      postVisitStatusInfo: null,

      // 상태 이력
      statusHistory: [{
        date: now.split('T')[0],
        time: now.split('T')[1].substring(0, 5),
        fromPhase: '전화상담',
        toPhase: '전화상담',
        fromStatus: null,
        toStatus: '신규',
        changedBy: 'test-user',
        note: '환자 등록'
      }],

      // 메타
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    };

    const result = await collection.insertOne(newPatient);

    return NextResponse.json({
      success: true,
      data: { ...newPatient, _id: result.insertedId.toString() }
    });

  } catch (error) {
    console.error('환자 등록 오류:', error);
    return NextResponse.json(
      { success: false, error: '환자 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 환자 정보 수정
export async function PUT(request: NextRequest) {
  try {
    // 테스트 API - 인증 생략
    const body = await request.json();
    const { _id, ...updateData } = body;

    if (!_id) {
      return NextResponse.json({ success: false, error: '환자 ID가 필요합니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    const now = new Date().toISOString();
    updateData.updatedAt = now;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ success: false, error: '환자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { ...result, _id: result._id.toString() }
    });

  } catch (error) {
    console.error('환자 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: '환자 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 환자 삭제 (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    // 테스트 API - 인증 생략
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '환자 ID가 필요합니다.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection(TEST_COLLECTION);

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isDeleted: true, updatedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('환자 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: '환자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
