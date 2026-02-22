// src/app/api/v2/call-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { ObjectId } from 'mongodb';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';
import { validateBody } from '@/lib/validations/validate';
import { updateCallLogSchema } from '@/lib/validations/schemas';
import { createRouteLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// 신환/구환/구신환 등을 "환자"로 통일
function normalizeClassification(classification: string | undefined): string {
  if (!classification) return 'unknown';

  // 환자 관련 분류는 모두 "환자"로 통일
  const patientTypes = ['신환', '구환', '구신환', '신규환자', '기존환자', '재초진'];
  if (patientTypes.includes(classification)) {
    return '환자';
  }

  return classification;
}

interface CallLogQuery {
  direction?: string;
  'aiAnalysis.classification'?: string | { $in: string[] };
  startedAt?: { $gte?: Date; $lte?: Date };
  phone?: { $regex: string };
}

export async function GET(request: NextRequest) {
  const log = createRouteLogger('/api/v2/call-logs', 'GET');
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

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
    const query: CallLogQuery = { clinicId } as CallLogQuery;

    if (direction) {
      query.direction = direction;
    }

    if (classification) {
      if (classification === '환자') {
        query['aiAnalysis.classification'] = '환자';
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
      calledNumber: 1, // ★ 착신번호 (031 or 070)
      patientId: 1,
      aiAnalysis: 1,
      aiStatus: 1,
      status: 1,
      callbackType: 1, // 콜백/리콜/감사전화 태그
      callbackId: 1, // 연결된 콜백 ID
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
            clinicId,
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

    // patientId가 있는 통화의 실제 환자 이름 조회
    const patientIds = callLogs
      .filter(log => log.patientId && ObjectId.isValid(log.patientId))
      .map(log => new ObjectId(log.patientId));

    const patientNameMap: Record<string, string> = {};
    const existingPatientIds = new Set<string>(); // 실제 존재하는 환자 ID 추적
    if (patientIds.length > 0) {
      const patients = await db.collection('patients_v2')
        .find({ _id: { $in: patientIds } }, { projection: { name: 1 } })
        .toArray();
      patients.forEach(p => {
        const idStr = p._id.toString();
        patientNameMap[idStr] = p.name || '';
        existingPatientIds.add(idStr); // 존재하는 환자 ID 기록
      });
    }

    // 통계 정리
    const stats = {
      all: 0,
      patient: 0,     // 환자
      georaecheo: 0,  // 거래처
      spam: 0,        // 스팸
      etc: 0,         // 기타
      missed: 0,      // 부재중 (통화시간 0초)
    };

    (classificationStats as Array<{ _id: string; count: number }>).forEach((s) => {
      stats.all += s.count;
      if (s._id === '환자') stats.patient = s.count;
      else if (s._id === '거래처') stats.georaecheo = s.count;
      else if (s._id === '스팸') stats.spam = s.count;
      else if (s._id === '기타') stats.etc = s.count;
    });

    return NextResponse.json({
      callLogs: callLogs.map((log) => {
        // patientId가 있지만 환자가 삭제된 경우 null 처리 (orphaned patientId)
        const validPatientId = log.patientId && existingPatientIds.has(log.patientId)
          ? log.patientId
          : null;

        // patientId가 유효하면 실제 환자 이름 사용, 아니면 AI 분석 결과 사용
        const actualPatientName = validPatientId
          ? patientNameMap[validPatientId]
          : (log.aiAnalysis?.patientName || '');

        return {
          id: log._id.toString(),
          callTime: log.startedAt,
          callType: log.direction,
          duration: log.duration,
          phone: log.phone || '',
          calledNumber: log.calledNumber || '', // ★ 착신번호 (031 or 070)
          callerName: actualPatientName,
          patientId: validPatientId, // 삭제된 환자면 null 반환
          patientName: actualPatientName,
          classification: normalizeClassification(log.aiAnalysis?.classification),
          interest: log.aiAnalysis?.interest || '',
          summary: log.aiAnalysis?.summary || '',
          temperature: log.aiAnalysis?.temperature || 'unknown',
          status: log.aiStatus || 'completed', // pending, processing, completed
          callbackType: log.callbackType || null, // 'callback' | 'recall' | 'thanks' | null
          callbackId: log.callbackId || null,
        };
      }),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error) {
    log.error('Failed to fetch call logs', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch call logs' },
      { status: 500 }
    );
  }
}

// AI 분석 결과 수정 및 환자 연결
export async function PATCH(request: NextRequest) {
  const log = createRouteLogger('/api/v2/call-logs', 'PATCH');
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();
    const clinicId = authUser.clinicId;

    const body = await request.json();
    log.info('요청 수신', { clinicId, body });

    const validation = validateBody(updateCallLogSchema, body);
    if (!validation.success) return validation.response;
    const { callLogId, classification, patientName, interest, temperature, summary, followUp, patientId, callbackType, callbackId } = validation.data;

    const { db } = await connectToDatabase();
    log.info('DB 연결 성공', { clinicId });
    const now = new Date().toISOString();

    // 먼저 현재 통화기록 조회 (aiAnalysis가 null인지 확인)
    const currentCallLog = await db.collection('callLogs_v2').findOne(
      { _id: new ObjectId(callLogId) }
    );

    if (!currentCallLog) {
      return NextResponse.json(
        { error: 'Call log not found' },
        { status: 404 }
      );
    }

    // 업데이트할 필드 구성
    const updateFields: Record<string, unknown> = {
      updatedAt: now,
    };

    // 삭제할 필드 구성
    const unsetFields: Record<string, unknown> = {};

    // 콜백 태그 업데이트
    if (callbackType !== undefined) {
      if (callbackType === null) {
        // null이면 태그 제거
        unsetFields.callbackType = '';
        unsetFields.callbackId = '';
      } else {
        updateFields.callbackType = callbackType;
        if (callbackId) {
          updateFields.callbackId = callbackId;
        }
      }
    }

    // 환자 연결/해제
    if (patientId === null) {
      // 명시적으로 null이면 연결 해제 + 환자 삭제
      unsetFields.patientId = '';

      // 연결 해제 시 환자도 삭제
      if (currentCallLog?.patientId) {
        try {
          if (ObjectId.isValid(currentCallLog.patientId)) {
            // 환자 삭제
            await db.collection('patients_v2').deleteOne(
              { _id: new ObjectId(currentCallLog.patientId) }
            );
            console.log(`[CallLogs PATCH] 연결 해제로 환자 삭제됨: ${currentCallLog.patientId}`);

            // 같은 patientId를 가진 다른 통화기록들도 연결 해제
            const unlinkResult = await db.collection('callLogs_v2').updateMany(
              { patientId: currentCallLog.patientId, _id: { $ne: new ObjectId(callLogId) } },
              { $unset: { patientId: '' } }
            );
            console.log(`[CallLogs PATCH] 다른 통화기록 연결 해제: ${unlinkResult.modifiedCount}건`);
          }
        } catch (deleteError) {
          console.error('[CallLogs PATCH] 연결 해제 시 환자 삭제 실패:', deleteError);
        }
      }
    } else if (patientId) {
      // patientId가 있으면 연결
      updateFields.patientId = patientId;

      // 환자와 연결되는데 분류가 없거나 unknown이면 자동으로 '환자'로 변경
      const currentClassification = currentCallLog?.aiAnalysis?.classification;
      if (!currentClassification || currentClassification === 'unknown') {
        if (currentCallLog?.aiAnalysis === null || currentCallLog?.aiAnalysis === undefined) {
          // aiAnalysis가 없으면 새로 생성
          updateFields.aiAnalysis = {
            classification: '환자',
            manuallyEdited: true,
            editedAt: now,
          };
        } else {
          // aiAnalysis가 있으면 classification만 업데이트
          updateFields['aiAnalysis.classification'] = '환자';
          updateFields['aiAnalysis.manuallyEdited'] = true;
          updateFields['aiAnalysis.editedAt'] = now;
        }
        console.log(`[CallLogs PATCH] 환자 연결로 분류 자동 변경: unknown → 환자`);
      }
    }

    // AI 분석 수정인 경우 - aiAnalysis가 null이면 먼저 초기화
    const hasAiAnalysisUpdate = classification || patientName !== undefined || interest !== undefined || temperature || summary !== undefined || followUp;

    if (hasAiAnalysisUpdate) {
      // aiAnalysis가 null이면 빈 객체로 초기화
      if (currentCallLog.aiAnalysis === null || currentCallLog.aiAnalysis === undefined) {
        console.log('[CallLogs PATCH] aiAnalysis가 null, 초기화 필요');
        // 전체 aiAnalysis 객체를 새로 설정
        const newAiAnalysis: Record<string, unknown> = {
          manuallyEdited: true,
          editedAt: now,
        };
        if (classification) newAiAnalysis.classification = classification;
        if (patientName !== undefined) newAiAnalysis.patientName = patientName;
        if (interest !== undefined) newAiAnalysis.interest = interest;
        if (temperature) newAiAnalysis.temperature = temperature;
        if (summary !== undefined) newAiAnalysis.summary = summary;
        if (followUp) newAiAnalysis.followUp = followUp;

        updateFields.aiAnalysis = newAiAnalysis;
      } else {
        // aiAnalysis가 이미 있으면 개별 필드 업데이트
        updateFields['aiAnalysis.manuallyEdited'] = true;
        updateFields['aiAnalysis.editedAt'] = now;

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
      }
    }

    // 스팸/거래처로 분류 변경 시 환자 삭제 처리
    const NON_PATIENT_CLASSIFICATIONS = ['스팸', '거래처'];
    let deletedPatientId: string | null = null;

    if (classification && NON_PATIENT_CLASSIFICATIONS.includes(classification)) {
      // 이미 위에서 조회한 currentCallLog 사용
      if (currentCallLog?.patientId) {
        deletedPatientId = currentCallLog.patientId;

        // 환자 삭제 시도 (patients_v2에서)
        try {
          // ObjectId 형식 검증
          if (ObjectId.isValid(currentCallLog.patientId)) {
            await db.collection('patients_v2').deleteOne(
              { _id: new ObjectId(currentCallLog.patientId) }
            );
            console.log(`[CallLogs PATCH] 환자 삭제됨: ${currentCallLog.patientId} (분류: ${classification})`);

            // 같은 patientId를 가진 다른 통화기록들도 연결 해제
            const unlinkResult = await db.collection('callLogs_v2').updateMany(
              { patientId: currentCallLog.patientId, _id: { $ne: new ObjectId(callLogId) } },
              { $unset: { patientId: '' } }
            );
            console.log(`[CallLogs PATCH] 다른 통화기록 연결 해제: ${unlinkResult.modifiedCount}건 (분류 변경)`);
          }
        } catch (deleteError) {
          console.error('[CallLogs PATCH] 환자 삭제 실패:', deleteError);
        }

        // 통화기록에서 patientId 연결 해제
        unsetFields.patientId = '';
      }
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
      { _id: new ObjectId(callLogId), clinicId },
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
      deletedPatientId,
      callLog: {
        id: updatedLog?._id.toString(),
        patientId: updatedLog?.patientId || null,
        classification: updatedLog?.aiAnalysis?.classification,
        patientName: updatedLog?.aiAnalysis?.patientName,
        interest: updatedLog?.aiAnalysis?.interest,
        temperature: updatedLog?.aiAnalysis?.temperature,
        summary: updatedLog?.aiAnalysis?.summary,
        followUp: updatedLog?.aiAnalysis?.followUp,
        callbackType: updatedLog?.callbackType || null,
        callbackId: updatedLog?.callbackId || null,
      },
    });
  } catch (error) {
    log.error('Failed to update call log', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update call log' },
      { status: 500 }
    );
  }
}
