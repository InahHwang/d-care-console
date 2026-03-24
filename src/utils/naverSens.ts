// src/utils/naverSens.ts
// 네이버 클라우드 SENS SMS/LMS/MMS 발송 유틸리티
// CoolSMS 대체

import crypto from 'crypto';

const SENS_API_URL = 'https://sens.apigw.ntruss.com';

interface SensConfig {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  senderNumber: string;
}

interface SendMessageOptions {
  to: string;
  text: string;
  type?: 'SMS' | 'LMS' | 'MMS';
  subject?: string;
  imageId?: string;
}

interface SendMessageResult {
  success: boolean;
  requestId?: string;
  statusCode?: string;
  error?: string;
}

interface UploadFileResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

function getSensConfig(): SensConfig {
  return {
    accessKey: process.env.NAVER_SENS_ACCESS_KEY || '',
    secretKey: process.env.NAVER_SENS_SECRET_KEY || '',
    serviceId: process.env.NAVER_SENS_SERVICE_ID || '',
    senderNumber: process.env.NAVER_SENS_SENDER || '',
  };
}

// HMAC-SHA256 서명 생성 (네이버 클라우드 API 인증)
function makeSignature(method: string, url: string, timestamp: string, accessKey: string, secretKey: string): string {
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('base64');
}

// 설정 유효성 검사
export function isSensConfigured(): boolean {
  const config = getSensConfig();
  return !!(config.accessKey && config.secretKey && config.serviceId && config.senderNumber);
}

// SMS/LMS/MMS 발송
export async function sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
  const config = getSensConfig();

  if (!config.accessKey || !config.secretKey || !config.serviceId || !config.senderNumber) {
    return { success: false, error: 'SENS 설정이 올바르지 않습니다.' };
  }

  const uri = `/sms/v2/services/${config.serviceId}/messages`;
  const timestamp = Date.now().toString();
  const signature = makeSignature('POST', uri, timestamp, config.accessKey, config.secretKey);

  const body: any = {
    type: options.type || 'SMS',
    from: config.senderNumber,
    content: options.text,
    messages: [
      { to: options.to.replace(/-/g, '') },
    ],
  };

  if (options.subject) {
    body.subject = options.subject;
  }

  // MMS 이미지 첨부
  if (options.type === 'MMS' && options.imageId) {
    body.files = [{ fileId: options.imageId }];
  }

  try {
    const response = await fetch(`${SENS_API_URL}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': config.accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[SENS] ${options.type || 'SMS'} 발송 성공:`, result.requestId);
      return { success: true, requestId: result.requestId, statusCode: result.statusCode };
    }

    const errorText = await response.text();
    console.error(`[SENS] 발송 실패 (${response.status}):`, errorText);
    return { success: false, error: `SENS 발송 실패 (${response.status}): ${errorText}` };
  } catch (error: any) {
    console.error('[SENS] API 호출 오류:', error.message);
    return { success: false, error: error.message };
  }
}

// MMS 이미지 업로드
export async function uploadImage(imageBuffer: Buffer): Promise<UploadFileResult> {
  const config = getSensConfig();

  if (!config.accessKey || !config.secretKey || !config.serviceId) {
    return { success: false, error: 'SENS 설정이 올바르지 않습니다.' };
  }

  const uri = `/sms/v2/services/${config.serviceId}/files`;
  const timestamp = Date.now().toString();
  const signature = makeSignature('POST', uri, timestamp, config.accessKey, config.secretKey);

  // multipart/form-data 생성
  const boundary = `----SensBoundary${Date.now()}`;
  const bodyParts: Buffer[] = [];

  // File part
  bodyParts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
  ));
  bodyParts.push(imageBuffer);
  bodyParts.push(Buffer.from('\r\n'));

  // End boundary
  bodyParts.push(Buffer.from(`--${boundary}--\r\n`));

  const bodyBuffer = Buffer.concat(bodyParts);

  try {
    const response = await fetch(`${SENS_API_URL}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': config.accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: bodyBuffer,
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[SENS] 이미지 업로드 성공:', result.fileId);
      return { success: true, fileId: result.fileId };
    }

    const errorText = await response.text();
    console.error(`[SENS] 이미지 업로드 실패 (${response.status}):`, errorText);
    return { success: false, error: `이미지 업로드 실패 (${response.status})` };
  } catch (error: any) {
    console.error('[SENS] 이미지 업로드 오류:', error.message);
    return { success: false, error: error.message };
  }
}
