// src/app/api/cron/daily-report-sms/route.ts
// 일별 보고서 SMS 발송 Cron API
// 매시 정각 실행, DB 설정(settings_v2.dailyReportSms)의 요일별 시간에 맞춰 발송
// 설정 없으면 기본 KST 19시에 발송 (하위호환)

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30초 타임아웃

// CoolSMS 설정
const COOLSMS_CONFIG = {
  API_KEY: process.env.COOLSMS_API_KEY || '',
  API_SECRET: process.env.COOLSMS_API_SECRET || '',
  SENDER_NUMBER: process.env.COOLSMS_SENDER_NUMBER || '',
};

// 수신자 번호 목록
const RECIPIENT_PHONES = ['01076735218', '01030511241'];

// 사이트 도메인 (프로덕션 도메인 우선 사용, 환경변수 줄바꿈 제거)
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL
  || process.env.NEXT_PUBLIC_BASE_URL
  || 'https://d-care-console.vercel.app').trim();

// Vercel 환경 감지
const isVercel = process.env.VERCEL === '1';

// CoolSMS SDK 동적 임포트
let coolsmsService: any = null;
try {
  if (isVercel) {
    const coolsmsModule = require('coolsms-node-sdk');
    coolsmsService = coolsmsModule.default || coolsmsModule;
  } else {
    coolsmsService = require('coolsms-node-sdk').default;
  }
} catch (error: any) {
  console.error('CoolSMS SDK 임포트 실패:', error.message);
}

// 오늘 날짜 가져오기 (YYYY-MM-DD)
function getTodayDate(): string {
  const now = new Date();
  // 한국 시간 기준
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime.toISOString().split('T')[0];
}

// 요일 가져오기
function getDayOfWeek(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// 현재 한국 시간(KST) 시각 가져오기
function getKSTHour(): number {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreaTime.getUTCHours();
}

// 현재 한국 시간 요일 키 (mon, tue, ...) 가져오기
function getKSTDayKey(): string {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return keys[koreaTime.getUTCDay()];
}

// 일별 보고서 요약 데이터 조회 (V2 reports API 호출 - SSoT)
async function getDailyReportSummary(date: string) {
  try {
    const reportApiUrl = `${SITE_URL}/api/v2/reports/daily/${date}`;
    console.log('V2 리포트 API 호출:', reportApiUrl);
    const reportRes = await fetch(reportApiUrl, { cache: 'no-store' });
    const reportJson = await reportRes.json();

    if (!reportJson.success) {
      console.error('V2 리포트 API 실패:', reportJson.error);
      return null;
    }

    const v2Summary = reportJson.data.summary;
    return {
      total: v2Summary.total,
      agreed: v2Summary.agreed,
      disagreed: v2Summary.disagreed,
      pending: v2Summary.pending,
      noAnswer: v2Summary.noAnswer || 0,
      noConsultation: v2Summary.noConsultation || 0,
      closed: v2Summary.closed || 0,
      actualRevenue: v2Summary.actualRevenue || 0,
      expectedRevenue: v2Summary.expectedRevenue || 0,
      totalDiscount: v2Summary.totalDiscount || 0,
      agreedRate: v2Summary.total > 0 ? Math.round((v2Summary.agreed / v2Summary.total) * 100) : 0,
    };
  } catch (error) {
    console.error('보고서 요약 조회 실패:', error);
    return null;
  }
}

// SMS 발송
async function sendSMS(phone: string, message: string) {
  if (!coolsmsService) {
    throw new Error('CoolSMS SDK가 로드되지 않았습니다.');
  }

  if (!COOLSMS_CONFIG.API_KEY || !COOLSMS_CONFIG.API_SECRET || !COOLSMS_CONFIG.SENDER_NUMBER) {
    throw new Error('CoolSMS 환경 변수가 설정되지 않았습니다.');
  }

  const messageService = new coolsmsService(
    COOLSMS_CONFIG.API_KEY,
    COOLSMS_CONFIG.API_SECRET
  );

  // 메시지 길이에 따라 SMS/LMS 결정
  const byteLength = Buffer.byteLength(message, 'utf8');
  const messageType = byteLength <= 90 ? 'SMS' : 'LMS';

  const result = await messageService.sendOne({
    to: phone.replace(/-/g, ''),
    from: COOLSMS_CONFIG.SENDER_NUMBER.replace(/-/g, ''),
    text: message,
    type: messageType,
  });

  return result;
}

// Vercel Cron 인증 확인
function verifyCronAuth(request: NextRequest): boolean {
  // 테스트 파라미터 확인 (수동 테스트용)
  const { searchParams } = new URL(request.url);
  const testKey = searchParams.get('key');
  if (testKey === 'dcare2026') {
    return true;
  }

  // Vercel Cron은 CRON_SECRET 헤더로 인증
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET이 설정되어 있으면 검증
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // 개발 환경에서는 허용
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Vercel Cron 요청 확인 (User-Agent로)
  const userAgent = request.headers.get('user-agent') || '';
  return userAgent.includes('vercel-cron');
}

export async function GET(request: NextRequest) {
  console.log('======= 일별 보고서 SMS 발송 Cron 시작 =======');
  console.log('실행 시간:', new Date().toISOString());

  // 인증 확인
  if (!verifyCronAuth(request)) {
    console.log('인증 실패: 권한 없음');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 수동 테스트용 파라미터
  const { searchParams } = new URL(request.url);
  const customPhone = searchParams.get('phone');
  const forceParam = searchParams.get('force') === 'true';
  const isManualTest = !!customPhone || forceParam;

  try {
    const { db } = await connectToDatabase();
    const today = getTodayDate();
    const dayOfWeek = getDayOfWeek(today);
    const kstHour = getKSTHour();
    const dayKey = getKSTDayKey();

    console.log(`오늘 날짜: ${today} (${dayOfWeek}), KST ${kstHour}시, 요일키: ${dayKey}`);

    // DB에서 SMS 설정 조회
    const settings = await db.collection('settings_v2').findOne({ clinicId: 'default' });
    const smsSettings = settings?.dailyReportSms;

    // 수신자 결정
    let recipients: string[];
    if (customPhone) {
      recipients = [customPhone];
    } else if (smsSettings?.recipients?.length > 0) {
      recipients = smsSettings.recipients;
    } else {
      recipients = RECIPIENT_PHONES; // fallback: 하드코딩된 기본 번호
    }

    // 스케줄 확인 (수동 테스트가 아닌 경우에만)
    if (!isManualTest) {
      if (smsSettings?.enabled === true && smsSettings.schedule) {
        // DB 설정 기반 스케줄 확인
        const todaySchedule = smsSettings.schedule[dayKey];

        if (!todaySchedule?.enabled) {
          console.log(`${dayKey}(${dayOfWeek}) 요일 발송 비활성화. Skip.`);
          return NextResponse.json({
            success: true,
            skipped: true,
            reason: `${dayOfWeek}요일 발송 비활성화`,
          });
        }

        const scheduledHour = parseInt(todaySchedule.time?.split(':')[0] || '19', 10);
        if (kstHour !== scheduledHour) {
          console.log(`현재 KST ${kstHour}시, 발송 예정: ${scheduledHour}시. Skip.`);
          return NextResponse.json({
            success: true,
            skipped: true,
            reason: `현재 ${kstHour}시, 발송 예정 ${scheduledHour}시`,
          });
        }
      } else {
        // 설정 없거나 비활성 → 기존 기본값 (KST 19시)
        if (kstHour !== 19) {
          console.log(`설정 없음/비활성, 기본값 KST 19시. 현재 ${kstHour}시. Skip.`);
          return NextResponse.json({
            success: true,
            skipped: true,
            reason: `기본 발송 시간(19시) 아님, 현재 ${kstHour}시`,
          });
        }
      }

      // 중복 발송 체크 (오늘 이미 성공적으로 발송했는지)
      const alreadySent = await db.collection('cron_logs').findOne({
        type: 'daily-report-sms',
        date: today,
        success: true,
      });

      if (alreadySent) {
        console.log(`오늘(${today}) 이미 발송 완료됨. Skip.`);
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: `오늘 이미 발송 완료`,
        });
      }
    }

    // 보고서 요약 조회
    const summary = await getDailyReportSummary(today);

    if (!summary) {
      console.log('보고서 요약 조회 실패');
      return NextResponse.json({
        success: false,
        error: '보고서 요약 조회 실패',
      });
    }

    // 모바일 보고서 링크
    const reportUrl = `${SITE_URL}/r/${today}`;

    // SMS 메시지 구성
    const clinicName = process.env.CLINIC_NAME || 'D-Care';
    let message = `[${clinicName}] ${today}(${dayOfWeek}) 일별 보고서\n\n`;
    message += `총 상담: ${summary.total}건\n`;
    message += `- 동의: ${summary.agreed}건 (${summary.agreedRate}%)\n`;
    message += `- 미동의: ${summary.disagreed}건\n`;
    message += `- 보류: ${summary.pending}건\n`;
    if (summary.noAnswer > 0) {
      message += `- 부재중: ${summary.noAnswer}건\n`;
    }
    if (summary.noConsultation > 0) {
      message += `- 미입력: ${summary.noConsultation}건 ← 확인 필요\n`;
    }
    if (summary.closed > 0) {
      message += `- 종결: ${summary.closed}건\n`;
    }
    if (summary.actualRevenue > 0) {
      message += `\n확정 매출: ${summary.actualRevenue.toLocaleString()}만원 (동의 ${summary.agreed}건)`;
    }
    if (summary.expectedRevenue > 0) {
      message += `\n전체 정가: ${summary.expectedRevenue.toLocaleString()}만원`;
      if (summary.totalDiscount > 0) {
        message += ` → 할인가 ${(summary.expectedRevenue - summary.totalDiscount).toLocaleString()}만원`;
      }
    }
    message += `\n\n상세 보기\n${reportUrl}`;

    console.log('발송 메시지:', message);
    console.log('수신자 목록:', recipients);

    // SMS 발송
    const results: { phone: string; success: boolean; result?: any; error?: string }[] = [];

    for (const phone of recipients) {
      try {
        const result = await sendSMS(phone, message);
        console.log(`SMS 발송 성공 (${phone}):`, result);
        results.push({ phone, success: true, result });
      } catch (err: any) {
        console.error(`SMS 발송 실패 (${phone}):`, err.message);
        results.push({ phone, success: false, error: err.message });
      }
    }

    // 발송 기록 저장
    await db.collection('cron_logs').insertOne({
      type: 'daily-report-sms',
      date: today,
      recipients: recipients,
      message,
      results,
      success: results.some(r => r.success),
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: results.some(r => r.success),
      message: `SMS 발송 완료 (${results.filter(r => r.success).length}/${recipients.length}건 성공)`,
      date: today,
      recipients: recipients,
      results,
      summary,
      reportUrl,
    });

  } catch (error: any) {
    console.error('Cron 실행 오류:', error);

    // 오류 기록 저장
    try {
      const { db } = await connectToDatabase();
      await db.collection('cron_logs').insertOne({
        type: 'daily-report-sms',
        date: getTodayDate(),
        recipients: RECIPIENT_PHONES,
        error: error.message,
        success: false,
        createdAt: new Date(),
      });
    } catch (logError) {
      console.error('오류 로그 저장 실패:', logError);
    }

    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// POST도 허용 (수동 테스트용)
export async function POST(request: NextRequest) {
  return GET(request);
}
