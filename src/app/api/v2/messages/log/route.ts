// src/app/api/v2/messages/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('messageLogs').deleteMany({});

    return NextResponse.json({
      success: true,
      message: '모든 메시지 로그가 삭제되었습니다.',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('메시지 로그 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const { db } = await connectToDatabase();

    const query: Record<string, any> = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = `${startDate}T00:00:00`;
      if (endDate) query.createdAt.$lte = `${endDate}T23:59:59`;
    }

    const logs = await db.collection('messageLogs')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('메시지 로그 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.patientId && !body.patientName) {
      return NextResponse.json(
        { success: false, message: '환자 정보(patientId 또는 patientName)는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!body.content && !body.template) {
      return NextResponse.json(
        { success: false, message: '메시지 내용(content 또는 template)은 필수입니다.' },
        { status: 400 }
      );
    }

    const {
      id, patientId, patientName, phoneNumber, content, messageType, status,
      template, category, totalCount, successCount, failedCount,
      messageId, imageUrl, rcsOptions, errorMessage, createdAt, templateName, operator
    } = body;

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
      timestamp: new Date().toISOString()
    };

    const { db } = await connectToDatabase();
    const result = await db.collection('messageLogs').insertOne(logEntry);

    return NextResponse.json({
      success: true,
      message: '로그가 저장되었습니다.',
      logId: result.insertedId,
      log: logEntry
    });
  } catch (error) {
    console.error('메시지 로그 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
