// src/utils/auditLog.ts
// 감사 로그 유틸리티 — 상담사 활동 추적

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/utils/mongodb';
import { AuditAction, AuditChange } from '@/types/v2';

const JWT_SECRET = process.env.JWT_SECRET as string;

// JWT에서 사용자 정보 추출
interface AuditUser {
  userId: string;
  userName: string;
  userRole: string;
}

export function extractUserFromRequest(request: NextRequest): AuditUser | null {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.split(' ')[1];
    if (!JWT_SECRET) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      name?: string;
      username?: string;
      role?: string;
    };

    return {
      userId: decoded.id,
      userName: decoded.name || decoded.username || 'unknown',
      userRole: decoded.role || 'staff',
    };
  } catch {
    return null;
  }
}

// 클라이언트 정보 추출
function extractClientInfo(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || '';
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = xForwardedFor
    ? xForwardedFor.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';
  return { ipAddress, userAgent };
}

// 두 객체의 변경사항 비교 (1단계 깊이)
const SKIP_FIELDS = new Set(['_id', 'updatedAt', 'createdAt', 'statusHistory', 'callbackHistory', 'journeys']);

export function diffChanges(
  oldDoc: Record<string, unknown>,
  newFields: Record<string, unknown>
): AuditChange[] {
  const changes: AuditChange[] = [];

  for (const [key, newValue] of Object.entries(newFields)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (newValue === undefined) continue;

    const oldValue = oldDoc[key];

    // Date 비교 — 문자열로 통일
    const oldStr = oldValue instanceof Date ? oldValue.toISOString() : oldValue;
    const newStr = newValue instanceof Date ? newValue.toISOString() : newValue;

    if (JSON.stringify(oldStr) !== JSON.stringify(newStr)) {
      changes.push({
        field: key,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
      });
    }
  }

  return changes;
}

// 감사 로그 기록 (fire-and-forget)
export function logAudit(
  request: NextRequest,
  action: AuditAction,
  collection: string,
  documentId: string,
  changes: AuditChange[],
  options?: {
    documentName?: string;
    reason?: string;
    user?: AuditUser | null;
  }
) {
  // fire-and-forget — 에러가 나도 API 응답에 영향 없음
  void _writeAuditLog(request, action, collection, documentId, changes, options);
}

async function _writeAuditLog(
  request: NextRequest,
  action: AuditAction,
  collection: string,
  documentId: string,
  changes: AuditChange[],
  options?: {
    documentName?: string;
    reason?: string;
    user?: AuditUser | null;
  }
) {
  try {
    const user = options?.user ?? extractUserFromRequest(request);
    const { ipAddress, userAgent } = extractClientInfo(request);

    // JWT 없으면 changedBy 필드에서 fallback
    const finalUser = user || {
      userId: 'unknown',
      userName: 'unknown',
      userRole: 'unknown',
    };

    const { db } = await connectToDatabase();
    await db.collection('auditLogs_v2').insertOne({
      userId: finalUser.userId,
      userName: finalUser.userName,
      userRole: finalUser.userRole,
      action,
      collection,
      documentId,
      documentName: options?.documentName,
      changes,
      reason: options?.reason,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[AuditLog] 감사 로그 기록 실패:', error);
  }
}
