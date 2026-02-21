// src/app/api/kakao/send-report/route.ts
// 카카오 알림톡으로 일별 마감 리포트 발송

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import jwt from 'jsonwebtoken';

// Vercel 환경 감지
const isVercel = process.env.VERCEL === '1';

// CoolSMS SDK 임포트
let coolsmsService: any = null;
let sdkImportError: string | null = null;

try {
  if (isVercel) {
    const coolsmsModule = require('coolsms-node-sdk');
    coolsmsService = coolsmsModule.default || coolsmsModule;
  } else {
    coolsmsService = require('coolsms-node-sdk').default;
  }
  console.log('[KakaoReport] CoolSMS SDK 임포트 성공');
} catch (error: any) {
  sdkImportError = error.message;
  console.error('[KakaoReport] CoolSMS SDK 임포트 실패:', error.message);
}

// CoolSMS API 설정
const COOLSMS_CONFIG = {
  API_KEY: process.env.COOLSMS_API_KEY || '',
  API_SECRET: process.env.COOLSMS_API_SECRET || '',
  SENDER_NUMBER: process.env.COOLSMS_SENDER_NUMBER || '',
  KAKAO_PFID: process.env.KAKAO_PFID || '', // 카카오 채널 ID
};

// 리포트 토큰 생성 함수
function generateReportToken(date: string): string {
  const secret = process.env.JWT_SECRET || 'default-secret-key';
  // 7일 후 만료
  const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  return jwt.sign(
    { type: 'daily_report', date, createdAt: new Date().toISOString(), exp: expiresAt },
    secret
  );
}

// 알림톡 메시지 생성 함수
function createKakaoMessage(data: {
  clinicName: string;
  date: string;
  dayOfWeek: string;
  summary: {
    total: number;
    agreed: number;
    disagreed: number;
    pending: number;
    noAnswer: number;
    noConsultation: number;
    actualRevenue: number;
    expectedRevenue: number;
    totalDiscount: number;
    avgDiscountRate: number;
  };
  reportUrl: string;
}): string {
  const { clinicName, date, dayOfWeek, summary, reportUrl } = data;

  // 동의율 계산
  const agreedRate = summary.total > 0
    ? Math.round((summary.agreed / summary.total) * 100)
    : 0;

  let message = `[${clinicName}] 일일 리포트\n`;
  message += `${date} (${dayOfWeek})\n\n`;
  message += `■ 신규 상담: ${summary.total}건\n`;
  message += `├ 동의: ${summary.agreed}건 (${agreedRate}%)\n`;
  message += `├ 미동의: ${summary.disagreed}건\n`;
  message += `├ 보류: ${summary.pending}건\n`;
  if (summary.noAnswer > 0) {
    message += `├ 부재중: ${summary.noAnswer}건\n`;
  }
  if (summary.noConsultation > 0) {
    message += `├ 미입력: ${summary.noConsultation}건 ← 확인 필요\n`;
  }
  if (summary.actualRevenue > 0) {
    message += `\n■ 확정 매출: ${summary.actualRevenue.toLocaleString()}만원 (동의 ${summary.agreed}건)\n`;
  }
  if (summary.expectedRevenue > 0) {
    message += `■ 전체 정가: ${summary.expectedRevenue.toLocaleString()}만원`;
    if (summary.totalDiscount > 0) {
      message += ` → 할인가 ${(summary.expectedRevenue - summary.totalDiscount).toLocaleString()}만원`;
    }
    message += `\n`;
  }

  message += `\n▶ 상세 보기\n${reportUrl}`;

  return message;
}

// JWT 토큰 검증
function verifyToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || 'default-secret-key';
    return jwt.verify(token, secret) as any;
  } catch (error) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log('[KakaoReport] 알림톡 발송 요청');

  try {
    // 인증 확인
    const authToken = request.cookies.get('token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(authToken);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // SDK 확인
    if (sdkImportError) {
      return NextResponse.json(
        { success: false, error: `SMS SDK 오류: ${sdkImportError}` },
        { status: 500 }
      );
    }

    // 요청 데이터
    const body = await request.json();
    const { date, recipients, sendSms = true } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, error: '날짜가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: '수신자 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    // 리포트 데이터 조회
    const reportToken = generateReportToken(date);
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://d-care-console.vercel.app').trim();
    const reportUrl = `${baseUrl}/report/daily/${date}?token=${reportToken}`;

    // V2 리포트 API와 동일한 데이터 사용 (SSoT - 상세보기와 동일한 집계)
    const { db } = await connectToDatabase();

    let v2Summary: any;
    try {
      const reportApiUrl = `${baseUrl}/api/v2/reports/daily/${date}`;
      const reportRes = await fetch(reportApiUrl);
      const reportJson = await reportRes.json();

      if (!reportJson.success) {
        throw new Error(reportJson.error || '리포트 데이터 조회 실패');
      }
      v2Summary = reportJson.data.summary;
    } catch (fetchError: any) {
      console.error('[KakaoReport] V2 리포트 조회 실패:', fetchError.message);
      return NextResponse.json(
        { success: false, error: `리포트 데이터 조회 실패: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const total = v2Summary.total;
    const agreed = v2Summary.agreed;
    const disagreed = v2Summary.disagreed;
    const pending = v2Summary.pending;
    const noAnswer = v2Summary.noAnswer || 0;
    const noConsultation = v2Summary.noConsultation || 0;
    const expectedRevenue = v2Summary.expectedRevenue;
    const actualRevenue = v2Summary.actualRevenue;
    const totalDiscount = v2Summary.totalDiscount;
    const avgDiscountRate = v2Summary.avgDiscountRate;

    // 요일 계산
    const dateObj = new Date(date);
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
    const clinicName = process.env.CLINIC_NAME || '치과';

    // 메시지 생성
    const message = createKakaoMessage({
      clinicName,
      date,
      dayOfWeek,
      summary: {
        total: total,
        agreed,
        disagreed,
        pending,
        noAnswer,
        noConsultation,
        actualRevenue,
        expectedRevenue,
        totalDiscount,
        avgDiscountRate
      },
      reportUrl
    });

    console.log('[KakaoReport] 발송 메시지:', message);

    // 메시지 발송
    if (!sendSms) {
      // 테스트 모드: 발송하지 않고 미리보기만
      return NextResponse.json({
        success: true,
        preview: true,
        message,
        reportUrl,
        summary: {
          total: total,
          agreed,
          disagreed,
          pending,
          noAnswer,
          noConsultation,
          expectedRevenue,
          actualRevenue,
          totalDiscount
        }
      });
    }

    // 실제 발송
    if (!COOLSMS_CONFIG.API_KEY || !COOLSMS_CONFIG.API_SECRET || !COOLSMS_CONFIG.SENDER_NUMBER) {
      return NextResponse.json(
        { success: false, error: 'SMS API 설정이 되어있지 않습니다.' },
        { status: 500 }
      );
    }

    const messageService = new coolsmsService(COOLSMS_CONFIG.API_KEY, COOLSMS_CONFIG.API_SECRET);

    const results: { phone: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      const phone = recipient.phone || recipient;

      try {
        // 알림톡 또는 LMS 발송
        const messageOptions: any = {
          to: phone,
          from: COOLSMS_CONFIG.SENDER_NUMBER,
          text: message
        };

        // 카카오 채널 ID가 있으면 알림톡 시도
        if (COOLSMS_CONFIG.KAKAO_PFID) {
          messageOptions.kakaoOptions = {
            pfId: COOLSMS_CONFIG.KAKAO_PFID,
            templateId: process.env.KAKAO_TEMPLATE_ID || '', // 등록된 템플릿 ID
            disableSms: false // 알림톡 실패 시 SMS 대체 발송
          };
        }

        // 메시지 타입 결정 (길이에 따라)
        let byteLength = 0;
        for (let i = 0; i < message.length; i++) {
          byteLength += message.charAt(i).match(/[가-힣]/) ? 3 : 1;
        }
        messageOptions.type = byteLength > 90 ? 'LMS' : 'SMS';

        const result = await messageService.sendOne(messageOptions);
        console.log(`[KakaoReport] ${phone} 발송 성공:`, result);
        results.push({ phone, success: true });

      } catch (error: any) {
        console.error(`[KakaoReport] ${phone} 발송 실패:`, error.message);
        results.push({ phone, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    // 발송 기록 저장
    try {
      await db.collection('reportNotifications').insertOne({
        date,
        sentAt: new Date().toISOString(),
        recipients: results,
        successCount,
        failCount,
        reportUrl,
        summary: {
          total: total,
          agreed,
          disagreed,
          pending,
          noAnswer,
          noConsultation,
          expectedRevenue,
          actualRevenue
        },
        sentBy: decoded.userId || decoded.id || 'unknown'
      });
    } catch (logError) {
      console.warn('[KakaoReport] 발송 기록 저장 실패:', logError);
    }

    return NextResponse.json({
      success: true,
      results,
      successCount,
      failCount,
      reportUrl,
      message: `${successCount}건 발송 성공${failCount > 0 ? `, ${failCount}건 실패` : ''}`
    });

  } catch (error) {
    console.error('[KakaoReport] 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '알림톡 발송 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// GET: 발송 이력 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    // 인증 확인
    const authToken = request.cookies.get('token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();

    const query: any = {};
    if (date) {
      query.date = date;
    }

    const notifications = await db.collection('reportNotifications')
      .find(query)
      .sort({ sentAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    console.error('[KakaoReport] 이력 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
