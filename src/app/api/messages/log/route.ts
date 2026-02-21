// app/api/messages/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function DELETE(request: NextRequest) {
  try {
    console.log('메시지 로그 전체 삭제 요청');
    
    const { db } = await connectToDatabase();
    
    // messageLogs 컬렉션의 모든 문서 삭제
    const result = await db.collection('messageLogs').deleteMany({});
    
    console.log(`메시지 로그 삭제 완료: ${result.deletedCount}개 삭제됨`);
    
    return NextResponse.json({
      success: true,
      message: '모든 메시지 로그가 삭제되었습니다.',
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    console.error('메시지 로그 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '메시지 로그 삭제 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  console.log('GET 요청 수신: /api/messages/log');

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log('MongoDB 연결 시도...');
    const { db } = await connectToDatabase();
    console.log('MongoDB 연결 성공!');

    // 날짜 필터 쿼리 구성
    const query: Record<string, any> = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = `${startDate}T00:00:00`;
      }
      if (endDate) {
        query.createdAt.$lte = `${endDate}T23:59:59`;
      }
    }

    const logs = await db.collection('messageLogs')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    console.log(`조회된 로그 개수: ${logs.length}`);

    return NextResponse.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('메시지 로그 조회 중 오류 발생:', error);

    return NextResponse.json(
      {
        success: false,
        message: '로그 조회 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('POST 요청 수신: /api/messages/log');
  
  try {
    // 요청 데이터 파싱
    const body = await request.json();
    console.log('수신된 요청 데이터:', body);
    
    // 필수 필드 검증
    if (!body.patientId && !body.patientName) {
      return NextResponse.json(
        { 
          success: false, 
          message: '필수 필드가 누락되었습니다. 환자 정보(patientId 또는 patientName)는 필수입니다.' 
        },
        { status: 400 }
      );
    }
    
    if (!body.content && !body.template) {
      return NextResponse.json(
        { 
          success: false, 
          message: '필수 필드가 누락되었습니다. 메시지 내용(content 또는 template)은 필수입니다.' 
        },
        { status: 400 }
      );
    }
    
    const { 
      id,  // 로그 ID (클라이언트에서 생성된 경우)
      patientId,
      patientName,
      phoneNumber,
      content,
      messageType,
      status,
      // 추가 필드
      template, 
      category, 
      totalCount, 
      successCount, 
      failedCount,
      messageId,
      imageUrl,
      rcsOptions,
      errorMessage,
      createdAt,
      templateName,
      operator
    } = body;
    
    // 로그 객체 생성 - 모든 가능한 필드 포함
    const logEntry = {
      id: id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: createdAt || new Date().toISOString(),
      patientId: patientId || '',
      patientName: patientName || '알 수 없음',
      phoneNumber: phoneNumber || '',
      content: content || template || '',
      messageType: messageType || 'SMS',
      status: status || 'success',
      template: template || templateName || '',
      category: category || '',
      totalCount: totalCount || 1,
      successCount: successCount || (status === 'success' ? 1 : 0),
      failedCount: failedCount || (status === 'failed' ? 1 : 0),
      messageId: messageId || '',
      imageUrl: imageUrl || null,
      rcsOptions: rcsOptions || null,
      errorMessage: errorMessage || '',
      operator: operator || '시스템',
      timestamp: new Date().toISOString() // 백업 타임스탬프
    };
    
    // 콘솔에 로그 출력 (개발용)
    console.log('저장할 로그 데이터:', logEntry);
    
    try {
      // MongoDB에 저장
      console.log('MongoDB 연결 시도...');
      const { db } = await connectToDatabase();
      console.log('MongoDB 연결 성공!');
      
      const result = await db.collection('messageLogs').insertOne(logEntry);
      console.log('MongoDB 저장 성공! ID:', result.insertedId);
      
      // 성공 응답
      return NextResponse.json({
        success: true,
        message: '로그가 데이터베이스에 저장되었습니다.',
        logId: result.insertedId,
        log: logEntry // 저장된 로그 데이터 반환
      });
    } catch (dbError) {
      console.error('MongoDB 저장 오류:', dbError);
      
      // DB 오류 발생해도 로그 데이터 자체는 반환
      return NextResponse.json({
        success: false,
        message: 'DB 저장 실패했으나 로그 데이터는 생성됨',
        error: dbError instanceof Error ? dbError.message : '데이터베이스 오류',
        log: logEntry // 저장 시도한 로그 데이터
      }, { status: 500 });
    }
  } catch (error) {
    console.error('메시지 로그 저장 중 오류 발생:', error);
    
    // 오류 응답
    return NextResponse.json(
      { 
        success: false,
        message: '로그 저장 실패',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}