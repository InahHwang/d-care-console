// src/app/api/v2/call-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

interface CallLogQuery {
  direction?: string;
  'aiAnalysis.classification'?: string | { $in: string[] };
  startedAt?: { $gte?: Date; $lte?: Date };
  phone?: { $regex: string };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const direction = searchParams.get('direction'); // inbound, outbound
    const classification = searchParams.get('classification'); // 신규환자, 기존환자, etc
    const date = searchParams.get('date'); // YYYY-MM-DD
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search'); // 전화번호 검색
    const sortBy = searchParams.get('sortBy') || 'startedAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    const { db } = await connectToDatabase();
    const collection = db.collection('callLogs_v2');

    // 쿼리 빌드
    const query: CallLogQuery = {};

    if (direction) {
      query.direction = direction;
    }

    if (classification) {
      if (classification === '신환') {
        query['aiAnalysis.classification'] = '신환';
      } else if (classification === '구신환') {
        query['aiAnalysis.classification'] = '구신환';
      } else if (classification === '구환') {
        query['aiAnalysis.classification'] = '구환';
      } else if (classification === '부재중') {
        query['aiAnalysis.classification'] = '부재중';
      } else if (classification === '거래처') {
        query['aiAnalysis.classification'] = '거래처';
      } else if (classification === '스팸') {
        query['aiAnalysis.classification'] = '스팸';
      } else if (classification === '기타') {
        query['aiAnalysis.classification'] = '기타';
      }
    }

    // 날짜 필터
    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      query.startedAt = { $gte: targetDate, $lte: nextDay };
    } else if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) {
        query.startedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startedAt.$lte = new Date(endDate + 'T23:59:59.999Z');
      }
    }

    if (search) {
      query.phone = { $regex: search };
    }

    // 필요한 필드만 projection
    const projection = {
      _id: 1,
      startedAt: 1,
      direction: 1,
      duration: 1,
      phone: 1,
      patientId: 1,
      aiAnalysis: 1,
      aiStatus: 1,
      status: 1,
    };

    // 병렬 쿼리
    const [callLogs, totalCount, classificationStats] = await Promise.all([
      collection
        .find(query, { projection })
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query),
      // 분류별 통계 (오늘)
      collection.aggregate([
        {
          $match: {
            startedAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        },
        {
          $group: {
            _id: '$aiAnalysis.classification',
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
    ]);

    // 통계 정리
    const stats = {
      all: 0,
      sinwhan: 0,     // 신환
      gusinwhan: 0,   // 구신환
      guhwan: 0,      // 구환
      bujaejung: 0,   // 부재중
      georaecheo: 0,  // 거래처
      spam: 0,        // 스팸
      etc: 0,         // 기타
    };

    (classificationStats as Array<{ _id: string; count: number }>).forEach((s) => {
      stats.all += s.count;
      if (s._id === '신환') stats.sinwhan = s.count;
      else if (s._id === '구신환') stats.gusinwhan = s.count;
      else if (s._id === '구환') stats.guhwan = s.count;
      else if (s._id === '부재중') stats.bujaejung = s.count;
      else if (s._id === '거래처') stats.georaecheo = s.count;
      else if (s._id === '스팸') stats.spam = s.count;
      else if (s._id === '기타') stats.etc = s.count;
    });

    return NextResponse.json({
      callLogs: callLogs.map((log) => ({
        id: log._id.toString(),
        callTime: log.startedAt,
        callType: log.direction,
        duration: log.duration,
        phone: log.phone || '',
        callerName: log.aiAnalysis?.patientName || '',
        patientId: log.patientId || null,
        patientName: log.aiAnalysis?.patientName || '',
        classification: log.aiAnalysis?.classification || 'unknown',
        interest: log.aiAnalysis?.interest || '',
        summary: log.aiAnalysis?.summary || '',
        temperature: log.aiAnalysis?.temperature || 'unknown',
        status: log.aiStatus || 'completed', // pending, processing, completed
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}

// AI 분석 결과 수정 및 환자 연결
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { callLogId, classification, patientName, interest, temperature, summary, followUp, patientId } = body;

    if (!callLogId) {
      return NextResponse.json(
        { error: 'callLogId is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // 업데이트할 필드 구성
    const updateFields: Record<string, unknown> = {
      updatedAt: now,
    };

    // 삭제할 필드 구성
    const unsetFields: Record<string, unknown> = {};

    // 환자 연결/해제
    if (patientId === null) {
      // 명시적으로 null이면 연결 해제
      unsetFields.patientId = '';
    } else if (patientId) {
      // patientId가 있으면 연결
      updateFields.patientId = patientId;
    }

    // AI 분석 수정인 경우
    if (classification || patientName !== undefined || interest !== undefined || temperature || summary !== undefined || followUp) {
      updateFields['aiAnalysis.manuallyEdited'] = true;
      updateFields['aiAnalysis.editedAt'] = now;
    }

    if (classification) {
      updateFields['aiAnalysis.classification'] = classification;
    }
    if (patientName !== undefined) {
      updateFields['aiAnalysis.patientName'] = patientName;
    }
    if (interest !== undefined) {
      updateFields['aiAnalysis.interest'] = interest;
    }
    if (temperature) {
      updateFields['aiAnalysis.temperature'] = temperature;
    }
    if (summary !== undefined) {
      updateFields['aiAnalysis.summary'] = summary;
    }
    if (followUp) {
      updateFields['aiAnalysis.followUp'] = followUp;
    }

    // 업데이트 쿼리 구성
    const updateQuery: Record<string, unknown> = {
      $set: updateFields,
    };

    // unset 필드가 있으면 추가
    if (Object.keys(unsetFields).length > 0) {
      updateQuery.$unset = unsetFields;
    }

    const result = await db.collection('callLogs_v2').updateOne(
      { _id: new ObjectId(callLogId) },
      updateQuery
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Call log not found' },
        { status: 404 }
      );
    }

    // 수정된 데이터 반환
    const updatedLog = await db.collection('callLogs_v2').findOne(
      { _id: new ObjectId(callLogId) }
    );

    return NextResponse.json({
      success: true,
      callLog: {
        id: updatedLog?._id.toString(),
        classification: updatedLog?.aiAnalysis?.classification,
        patientName: updatedLog?.aiAnalysis?.patientName,
        interest: updatedLog?.aiAnalysis?.interest,
        temperature: updatedLog?.aiAnalysis?.temperature,
        summary: updatedLog?.aiAnalysis?.summary,
        followUp: updatedLog?.aiAnalysis?.followUp,
      },
    });
  } catch (error) {
    console.error('Error updating call log:', error);
    return NextResponse.json(
      { error: 'Failed to update call log' },
      { status: 500 }
    );
  }
}
