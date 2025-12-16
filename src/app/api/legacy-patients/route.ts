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

// GET: 전화번호 또는 이름으로 구환 정보 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const phoneNumber = searchParams.get('phone');
    const searchQuery = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '10');

    const client = await clientPromise;
    const db = client.db('d-care-db');
    const collection = db.collection('legacyPatients');

    // 이름/전화번호 검색 (search 파라미터)
    if (searchQuery) {
      const phoneDigits = searchQuery.replace(/\D/g, '');

      // 조건 배열 구성 (빈 문자열 regex 방지)
      const orConditions: any[] = [
        { name: { $regex: searchQuery, $options: 'i' } }
      ];

      // 전화번호 숫자가 있을 때만 phonePattern 검색 추가
      if (phoneDigits.length >= 2) {
        orConditions.push({ phonePattern: { $regex: phoneDigits } });
      }

      const query = { $or: orConditions };

      const legacyPatients = await collection
        .find(query)
        .limit(limit)
        .toArray();

      // 구환 데이터를 Patient 형식으로 변환
      const patients = legacyPatients.map(p => ({
        _id: `legacy_${p._id}`,  // 구환임을 표시하기 위해 prefix 추가
        name: p.name,
        phoneNumber: p.phonePattern ? `010-${p.phonePattern.slice(0,4)}-**${p.phonePattern.slice(4,6)}` : '',
        phonePattern: p.phonePattern,
        isLegacy: true
      }));

      return NextResponse.json({
        success: true,
        data: patients,
        total: patients.length
      });
    }

    // 전화번호로 단건 조회 (phone 파라미터)
    if (phoneNumber) {
      const phonePattern = extractPhonePattern(phoneNumber);

      if (!phonePattern) {
        return NextResponse.json(
          { found: false, message: '유효하지 않은 전화번호 형식입니다.' }
        );
      }

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
    }

    return NextResponse.json(
      { error: 'phone 또는 search 파라미터가 필요합니다.' },
      { status: 400 }
    );

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
