// src/app/api/legacy-patients/route.ts
// 구환 데이터 조회 API

import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

// 전화번호에서 패턴 추출 (가운데 4자리 + 뒤 2자리)
function extractPhonePattern(phoneNumber: string): string | null {
  // 숫자만 추출
  const digits = phoneNumber.replace(/\D/g, '');

  // 010XXXXXXXX 형태 (11자리)
  if (digits.length === 11 && digits.startsWith('010')) {
    // 4~7번째 자리 (가운데 4자리) + 8~9번째 자리 (뒤 2자리)
    return digits.substring(3, 7) + digits.substring(7, 9);
  }

  // 01XXXXXXXXX 형태 (10자리, 구형 번호)
  if (digits.length === 10 && digits.startsWith('01')) {
    return digits.substring(2, 6) + digits.substring(6, 8);
  }

  return null;
}

// GET: 전화번호로 구환 정보 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return NextResponse.json(
        { error: '전화번호가 필요합니다.' },
        { status: 400 }
      );
    }

    const phonePattern = extractPhonePattern(phoneNumber);

    if (!phonePattern) {
      return NextResponse.json(
        { found: false, message: '유효하지 않은 전화번호 형식입니다.' }
      );
    }

    const client = await clientPromise;
    const db = client.db('d-care-db');
    const collection = db.collection('legacyPatients');

    // 패턴으로 검색
    const legacyPatient = await collection.findOne({ phonePattern });

    if (legacyPatient) {
      return NextResponse.json({
        found: true,
        name: legacyPatient.name,
        phonePattern: legacyPatient.phonePattern,
        isLegacy: true
      });
    }

    return NextResponse.json({
      found: false,
      message: '구환 데이터에서 찾을 수 없습니다.'
    });

  } catch (error) {
    console.error('구환 조회 오류:', error);
    return NextResponse.json(
      { error: '구환 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 여러 전화번호 일괄 조회 (통화기록용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumbers } = body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      return NextResponse.json(
        { error: '전화번호 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('d-care-db');
    const collection = db.collection('legacyPatients');

    // 각 전화번호의 패턴 추출
    const patterns = phoneNumbers
      .map(phone => ({
        original: phone,
        pattern: extractPhonePattern(phone)
      }))
      .filter(p => p.pattern !== null);

    // 모든 패턴 한번에 조회
    const uniquePatterns = Array.from(new Set(patterns.map(p => p.pattern).filter((p): p is string => p !== null)));
    const legacyPatients = await collection
      .find({ phonePattern: { $in: uniquePatterns } })
      .toArray();

    // 패턴 -> 이름 매핑
    const patternToName: Record<string, string> = {};
    legacyPatients.forEach(p => {
      patternToName[p.phonePattern] = p.name;
    });

    // 결과 반환 (전화번호 -> 이름 매핑)
    const results: Record<string, { name: string; isLegacy: boolean } | null> = {};
    patterns.forEach(({ original, pattern }) => {
      if (pattern && patternToName[pattern]) {
        results[original] = {
          name: patternToName[pattern],
          isLegacy: true
        };
      } else {
        results[original] = null;
      }
    });

    return NextResponse.json({
      success: true,
      results,
      matchedCount: Object.values(results).filter(r => r !== null).length
    });

  } catch (error) {
    console.error('구환 일괄 조회 오류:', error);
    return NextResponse.json(
      { error: '구환 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
