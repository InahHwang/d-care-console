// src/lib/auth/tokens.ts
// Refresh Token 유틸리티 — Access Token(15분) + Refresh Token(7일) 이중 구조

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { connectToDatabase } from '@/utils/mongodb';

const JWT_SECRET = process.env.JWT_SECRET as string;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface TokenPayload {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'master';
  clinicId: string;
}

/**
 * Access Token 생성 (JWT, 15분 만료)
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Refresh Token 생성 (랜덤 hex, DB 저장, 7일 만료)
 */
export async function generateRefreshToken(
  userId: string,
  clinicId: string
): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  const { db } = await connectToDatabase();
  await db.collection('refreshTokens').insertOne({
    token,
    userId,
    clinicId,
    expiresAt,
    createdAt: new Date(),
  });

  return token;
}

/**
 * Refresh Token 검증 (DB 조회, 만료 확인)
 */
export async function validateRefreshToken(
  token: string
): Promise<{ userId: string; clinicId: string } | null> {
  const { db } = await connectToDatabase();
  const record = await db.collection('refreshTokens').findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!record) return null;
  return { userId: record.userId, clinicId: record.clinicId };
}

/**
 * 특정 Refresh Token 폐기 (로그아웃 시)
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('refreshTokens').deleteOne({ token });
}

/**
 * 사용자의 모든 Refresh Token 폐기 (전체 세션 종료)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('refreshTokens').deleteMany({ userId });
}
