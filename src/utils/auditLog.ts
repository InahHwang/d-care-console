// src/utils/auditLog.ts
// 활동 로그 백엔드 유틸리티 — 상담사 활동 추적
// activityLogs_v2 컬렉션에 통합 기록

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/utils/mongodb';
import { AuditAction, AuditChange } from '@/types/v2';

const JWT_SECRET = process.env.JWT_SECRET as string;

const COLLECTION = 'activityLogs_v2';

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

// AuditAction('patient.update') → ActivityAction('patient_update') 변환
function auditActionToActivityAction(action: AuditAction): string {
  return action.replace('.', '_');
}

// collection('patients_v2') → target('patient') 변환
function collectionToTarget(collection: string): string {
  const map: Record<string, string> = {
    patients_v2: 'patient',
    callbacks_v2: 'callback',
    consultations_v2: 'patient',
    callLogs_v2: 'system',
  };
  return map[collection] || 'system';
}

// 변경사항을 읽기 쉬운 문자열로 변환
function changesToNotes(action: string, changes: AuditChange[]): string {
  if (changes.length === 0) return '';
  const fieldChanges = changes.map(c => {
    if (c.oldValue === null) return `${c.field}: ${c.newValue}`;
    return `${c.field}: ${c.oldValue} → ${c.newValue}`;
  });
  return fieldChanges.join(', ');
}

// 활동 로그 기록 (fire-and-forget) — activityLogs_v2 컬렉션에 통합
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
    changedBy?: string;
  }
) {
  void _writeActivityLog(request, action, collection, documentId, changes, options);
}

async function _writeActivityLog(
  request: NextRequest,
  action: AuditAction,
  collection: string,
  documentId: string,
  changes: AuditChange[],
  options?: {
    documentName?: string;
    reason?: string;
    user?: AuditUser | null;
    changedBy?: string;
  }
) {
  try {
    const user = options?.user ?? extractUserFromRequest(request);
    const { ipAddress, userAgent } = extractClientInfo(request);

    const finalUser = user || {
      userId: options?.changedBy || 'unknown',
      userName: options?.changedBy || 'unknown',
      userRole: 'staff',
    };

    const activityAction = auditActionToActivityAction(action);
    const target = collectionToTarget(collection);
    const notes = changesToNotes(activityAction, changes);

    const { db } = await connectToDatabase();
    await db.collection(COLLECTION).insertOne({
      userId: finalUser.userId,
      userName: finalUser.userName,
      userRole: finalUser.userRole,
      action: activityAction,
      target,
      targetId: documentId,
      targetName: options?.documentName || '',
      details: {
        notes: notes || undefined,
        reason: options?.reason,
        changes,
        source: 'backend_api',
      },
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ActivityLog] 활동 로그 기록 실패:', error);
  }
}
