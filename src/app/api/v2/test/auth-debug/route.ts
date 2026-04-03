// 디버그용 — verifyToken 실패 원인 확인
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { verifyToken } from '@/lib/auth';

const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  const result: Record<string, unknown> = {
    hasAuthHeader: !!authorization,
    headerPrefix: authorization?.substring(0, 15),
    jwtSecretExists: !!JWT_SECRET,
    jwtSecretLength: JWT_SECRET?.length || 0,
  };

  // 방법 1: lib/auth.ts의 verifyToken
  const libResult = verifyToken(request);
  result.libAuth = libResult.success
    ? { success: true, userId: libResult.user.id, clinicId: libResult.user.clinicId }
    : { success: false, error: libResult.error };

  // 방법 2: 직접 jwt.verify (users/route.ts 패턴)
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      result.directVerify = { success: true, userId: decoded.id, keys: Object.keys(decoded) };
    } catch (error: any) {
      result.directVerify = { success: false, error: error.message, name: error.name };
    }
  }

  return NextResponse.json(result);
}
