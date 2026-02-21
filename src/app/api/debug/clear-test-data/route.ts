// src/app/api/debug/clear-test-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function DELETE(request: NextRequest) {
  try {
    // 개발 환경에서만 실행되도록 체크
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { 
          error: '개발 환경에서만 사용 가능합니다.',
          environment: process.env.NODE_ENV 
        },
        { status: 403 }
      );
    }

    // 추가 보안: 특정 헤더나 토큰 체크 (선택사항)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes('debug-clear')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log('🗑️ 테스트 데이터 삭제 시작...');
    
    const { db } = await connectToDatabase();
    
    // 삭제할 컬렉션들과 삭제 결과를 저장할 객체
    const deleteResults: Record<string, number> = {};
    
    // 1. 환자 데이터 삭제
    console.log('환자 데이터 삭제 중...');
    const patientsResult = await db.collection('patients').deleteMany({});
    deleteResults.patients = patientsResult.deletedCount;
    
    // 2. 활동 로그 삭제
    console.log('활동 로그 삭제 중...');
    const activityLogsResult = await db.collection('activityLogs').deleteMany({});
    deleteResults.activityLogs = activityLogsResult.deletedCount;
    
    // 3. 메시지 로그 삭제
    console.log('메시지 로그 삭제 중...');
    const messageLogsResult = await db.collection('messageLogs').deleteMany({});
    deleteResults.messageLogs = messageLogsResult.deletedCount;
    
    // 4. 리포트 삭제
    console.log('리포트 삭제 중...');
    const reportsResult = await db.collection('reports').deleteMany({});
    deleteResults.reports = reportsResult.deletedCount;
    
    // 5. 콜백 관련 데이터 삭제 (있다면)
    console.log('콜백 데이터 삭제 중...');
    const callbacksResult = await db.collection('callbacks').deleteMany({});
    deleteResults.callbacks = callbacksResult.deletedCount;
    
    // 6. 상담 관련 데이터 삭제 (있다면)
    console.log('상담 데이터 삭제 중...');
    const consultationsResult = await db.collection('consultations').deleteMany({});
    deleteResults.consultations = consultationsResult.deletedCount;

    // 7. 이벤트 타겟 데이터 삭제 (있다면)
    console.log('이벤트 타겟 데이터 삭제 중...');
    const eventTargetsResult = await db.collection('eventTargets').deleteMany({});
    deleteResults.eventTargets = eventTargetsResult.deletedCount;

    const totalDeleted = Object.values(deleteResults).reduce((sum, count) => sum + count, 0);
    
    console.log('✅ 테스트 데이터 삭제 완료!', deleteResults);
    
    return NextResponse.json({
      success: true,
      message: '테스트 데이터가 성공적으로 삭제되었습니다.',
      timestamp: new Date().toISOString(),
      deleted: deleteResults,
      totalDeleted
    });

  } catch (error) {
    console.error('❌ 데이터 삭제 오류:', error);
    return NextResponse.json(
      {
        error: '데이터 삭제 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

// GET 요청으로 현재 데이터 개수 확인
export async function GET() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: '개발 환경에서만 사용 가능합니다.' },
        { status: 403 }
      );
    }

    const { db } = await connectToDatabase();
    
    const counts = {
      patients: await db.collection('patients').countDocuments(),
      activityLogs: await db.collection('activityLogs').countDocuments(),
      messageLogs: await db.collection('messageLogs').countDocuments(),
      reports: await db.collection('reports').countDocuments(),
      callbacks: await db.collection('callbacks').countDocuments(),
      consultations: await db.collection('consultations').countDocuments(),
      eventTargets: await db.collection('eventTargets').countDocuments(),
    };

    return NextResponse.json({
      message: '현재 데이터 개수',
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0)
    });

  } catch (error) {
    console.error('데이터 개수 확인 오류:', error);
    return NextResponse.json(
      { error: '데이터 개수 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}