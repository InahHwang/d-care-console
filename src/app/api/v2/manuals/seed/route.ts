// src/app/api/v2/manuals/seed/route.ts
// 기본 FAQ 매뉴얼 시드 데이터 API

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/utils/mongodb';
import { DEFAULT_MANUAL_CATEGORIES } from '@/types/v2/manual';
import { verifyApiToken, unauthorizedResponse } from '@/utils/apiAuth';

const MANUALS_COLLECTION = 'manuals_v2';
const CATEGORIES_COLLECTION = 'manual_categories_v2';

// 카테고리별 기본 FAQ 데이터
const DEFAULT_MANUALS = [
  // ============ 임플란트 ============
  {
    categoryName: '임플란트',
    title: '임플란트 비용 문의',
    keywords: ['임플란트', '비용', '가격', '얼마'],
    script: `임플란트 비용 안내드리겠습니다.

저희 치과에서는 국산 임플란트와 수입 임플란트를 사용하고 있습니다.

• 국산 임플란트: 100~120만원
• 수입 임플란트(오스템, 스트라우만 등): 130~180만원

비용은 환자분의 잇몸뼈 상태, 추가 시술 필요 여부(뼈이식 등)에 따라 달라질 수 있어서, 정확한 비용은 내원하셔서 검진 후 안내드리고 있습니다.

상담 예약 도와드릴까요?`,
    shortScript: '임플란트는 국산 100~120만원, 수입 130~180만원입니다. 정확한 비용은 검진 후 안내드려요. 상담 예약 도와드릴까요?',
  },
  {
    categoryName: '임플란트',
    title: '임플란트 치료 기간',
    keywords: ['임플란트', '기간', '시간', '얼마나'],
    script: `임플란트 치료 기간 안내드리겠습니다.

일반적으로 임플란트는 총 3~6개월 정도 소요됩니다.

1단계: 임플란트 식립 수술 (당일)
2단계: 치유 기간 (하악 2~3개월, 상악 4~6개월)
3단계: 보철물 제작 및 장착 (2~3주)

뼈이식이 필요한 경우 추가로 3~6개월이 더 소요될 수 있습니다.

환자분 상태에 따라 기간이 달라질 수 있어서, 정확한 일정은 검진 후 안내드립니다.`,
    shortScript: '임플란트는 보통 3~6개월 소요됩니다. 식립 후 하악 2~3개월, 상악 4~6개월 치유 기간이 필요해요.',
  },
  {
    categoryName: '임플란트',
    title: '임플란트 통증/부작용 문의',
    keywords: ['임플란트', '아파', '통증', '부작용', '무서워'],
    script: `임플란트 수술에 대해 걱정되시는군요. 충분히 이해합니다.

수술 중: 국소마취를 하기 때문에 통증은 거의 없습니다.
수술 후: 마취가 풀리면 약간의 통증과 붓기가 있을 수 있지만, 처방해드리는 진통제로 충분히 조절 가능합니다. 보통 2~3일 후 많이 호전됩니다.

저희 치과에서는 CT 촬영을 통해 정밀 진단 후 안전하게 진행하고 있으며, 수술 경험이 풍부한 원장님이 직접 진행하십니다.

혹시 다른 궁금하신 점 있으시면 말씀해 주세요.`,
    shortScript: '수술 중에는 마취로 통증이 없고, 수술 후 약간의 붓기는 진통제로 조절됩니다. 2~3일이면 많이 나아져요.',
  },

  // ============ 교정 ============
  {
    categoryName: '교정',
    title: '교정 비용 문의',
    keywords: ['교정', '비용', '가격', '얼마'],
    script: `치아 교정 비용 안내드리겠습니다.

• 메탈 교정: 250~350만원
• 세라믹 교정: 300~400만원
• 투명 교정(인비절라인): 400~600만원
• 설측 교정: 500~700만원

교정 기간은 보통 1년 6개월~2년 정도이며, 환자분의 치아 상태에 따라 달라집니다.

무이자 할부도 가능하니, 정확한 상담을 위해 내원 예약 도와드릴까요?`,
    shortScript: '교정은 메탈 250만원~, 세라믹 300만원~, 투명교정 400만원~ 입니다. 무이자 할부 가능해요!',
  },
  {
    categoryName: '교정',
    title: '교정 기간 문의',
    keywords: ['교정', '기간', '얼마나', '시간'],
    script: `치아 교정 기간은 환자분의 치아 상태에 따라 다르지만,

• 일반적인 경우: 1년 6개월 ~ 2년
• 간단한 부분 교정: 6개월 ~ 1년
• 복잡한 경우: 2년 ~ 3년

정확한 기간은 검진 후 안내드릴 수 있습니다.
교정 상담은 무료로 진행하고 있으니, 편하신 시간에 예약하시면 자세히 안내드리겠습니다.`,
    shortScript: '교정은 보통 1년 6개월~2년 정도 소요됩니다. 무료 상담으로 정확한 기간 안내받으실 수 있어요.',
  },
  {
    categoryName: '교정',
    title: '성인 교정 가능 여부',
    keywords: ['성인', '교정', '나이', '늦은'],
    script: `네, 성인도 교정 치료가 가능합니다!

요즘은 30~40대, 심지어 50대 이상 분들도 많이 교정하세요. 나이에 상관없이 치아와 잇몸이 건강하면 교정 치료가 가능합니다.

오히려 성인 교정은 본인 의지가 확실해서 더 좋은 결과를 보이기도 합니다.

성인분들은 심미적으로 티가 덜 나는 투명 교정이나 설측 교정을 많이 선호하십니다.

무료 상담 예약 도와드릴까요?`,
    shortScript: '성인도 교정 가능합니다! 30~50대 분들도 많이 하세요. 투명교정이나 설측교정으로 티 안나게 할 수 있어요.',
  },

  // ============ 일반진료 ============
  {
    categoryName: '일반진료',
    title: '충치 치료 비용',
    keywords: ['충치', '비용', '가격', '때우는'],
    script: `충치 치료 비용 안내드리겠습니다.

충치 크기와 위치에 따라 치료 방법이 달라집니다.

• 레진 충전(작은 충치): 5~15만원
• 인레이(중간 충치): 15~30만원
• 크라운(큰 충치/신경치료 후): 30~60만원

건강보험 적용 여부에 따라 본인부담금이 달라지며, 정확한 비용은 검진 후 안내드립니다.

혹시 지금 불편하신 증상이 있으시면 빠른 시일 내 내원하시는 것이 좋습니다.`,
    shortScript: '충치 치료는 레진 5~15만원, 인레이 15~30만원, 크라운 30~60만원입니다. 보험 적용 여부에 따라 달라져요.',
  },
  {
    categoryName: '일반진료',
    title: '스케일링 비용/건보 적용',
    keywords: ['스케일링', '비용', '보험', '건보', '1년'],
    script: `스케일링 비용 안내드리겠습니다.

만 19세 이상 성인은 연 1회 건강보험이 적용됩니다.
• 건강보험 적용 시: 약 15,000~16,000원
• 비보험(연 2회 이상): 약 5~7만원

마지막 스케일링 받으신 지 1년이 지났다면 보험 적용 가능하세요!

예약 도와드릴까요?`,
    shortScript: '스케일링은 연 1회 건강보험 적용으로 약 1만5천원입니다. 마지막 스케일링 후 1년 지났으면 보험 가능해요!',
  },

  // ============ 비용안내 ============
  {
    categoryName: '비용안내',
    title: '치료비 카드/할부 결제',
    keywords: ['카드', '할부', '결제', '분할'],
    script: `결제 방법 안내드리겠습니다.

저희 치과에서는 다양한 결제 방법을 지원합니다.

• 현금, 계좌이체
• 신용카드 (모든 카드사)
• 무이자 할부: 2~6개월 (카드사별 상이)
• 치과 자체 분할 납부 상담 가능

고액 치료의 경우 분할 납부에 대해 별도 상담도 가능하시니, 부담 없이 말씀해 주세요.`,
    shortScript: '카드 무이자 2~6개월 가능하고, 분할납부 상담도 가능합니다. 편하게 말씀해주세요!',
  },
  {
    categoryName: '비용안내',
    title: '의료비 세액공제 안내',
    keywords: ['세금', '공제', '연말정산', '현금영수증'],
    script: `치과 치료비도 의료비 세액공제 대상입니다!

연말정산 시 의료비 공제를 받으실 수 있으며, 현금영수증 발급도 가능합니다.

• 신용카드/체크카드: 자동으로 의료비 지출 내역 반영
• 현금 결제: 현금영수증 발급 요청하시면 됩니다

영수증 발급이나 추가 서류가 필요하시면 말씀해 주세요.`,
    shortScript: '치과비도 연말정산 의료비 공제 가능해요! 현금영수증 발급도 됩니다.',
  },

  // ============ 예약/일정 ============
  {
    categoryName: '예약/일정',
    title: '진료 예약 안내',
    keywords: ['예약', '시간', '언제', '가능'],
    script: `진료 예약 안내드리겠습니다.

저희 치과 진료 시간은 다음과 같습니다.
• 평일: 오전 10시 ~ 오후 7시
• 토요일: 오전 10시 ~ 오후 2시
• 점심시간: 오후 1시 ~ 2시
• 일요일/공휴일: 휴진

원하시는 날짜와 시간대 말씀해 주시면 예약 가능 여부 확인해 드리겠습니다.`,
    shortScript: '평일 10시~19시, 토요일 10시~14시 진료합니다. 원하시는 날짜와 시간 알려주세요!',
  },
  {
    categoryName: '예약/일정',
    title: '예약 변경/취소',
    keywords: ['예약', '변경', '취소', '연기', '미루'],
    script: `예약 변경/취소 안내드리겠습니다.

예약 변경이나 취소는 가능하시지만, 다른 환자분들을 위해 최소 하루 전에 연락 주시면 감사하겠습니다.

현재 예약하신 날짜를 확인해 드릴까요? 아니면 바로 변경하실 날짜를 말씀해 주시겠어요?`,
    shortScript: '예약 변경/취소는 하루 전까지 연락 주시면 됩니다. 변경하실 날짜 말씀해주세요!',
  },
  {
    categoryName: '예약/일정',
    title: '첫 방문 안내',
    keywords: ['첫', '방문', '처음', '뭐', '준비'],
    script: `첫 방문 안내드리겠습니다.

첫 방문 시 준비물:
• 신분증(의료보험 적용을 위해)
• 복용 중인 약이 있으시면 약 봉투나 목록

첫 방문 시 진행 과정:
1. 문진표 작성 (5분)
2. 파노라마 X-ray 촬영
3. 원장님 상담 및 치료 계획 안내
4. 간단한 치료는 당일 진행 가능

대략 30분~1시간 정도 소요되며, 시간 여유 있게 오시면 됩니다.`,
    shortScript: '첫 방문 시 신분증 지참해주세요. 문진표 작성, X-ray 촬영, 상담 순서로 진행됩니다. 약 30분~1시간 소요돼요.',
  },

  // ============ 불만대응 ============
  {
    categoryName: '불만대응',
    title: '치료 후 통증 호소',
    keywords: ['아파', '통증', '치료', '후', '불편'],
    script: `치료 후 불편하시군요. 먼저 사과드립니다.

어떤 치료를 받으셨는지, 언제부터 어떻게 아프신지 자세히 말씀해 주시겠어요?

• 치료 받으신 날짜:
• 어떤 치료:
• 통증 부위:
• 통증 정도(1~10):

확인 후 빠른 시일 내 재진료 일정 잡아드리겠습니다. 급하시면 오늘이라도 내원해 주세요.`,
    shortScript: '치료 후 불편하시군요. 죄송합니다. 어떤 치료를 언제 받으셨는지 말씀해주시면 빠르게 확인해드릴게요.',
  },
  {
    categoryName: '불만대응',
    title: '대기 시간 불만',
    keywords: ['대기', '기다려', '오래', '시간', '늦어'],
    script: `오래 기다리게 해드려서 정말 죄송합니다.

저희 치과에서도 대기 시간을 줄이기 위해 노력하고 있지만, 응급 환자나 치료가 예상보다 길어지는 경우가 있어 양해 부탁드립니다.

다음 예약 시에는 대기 시간이 적은 시간대(오전 첫 진료, 점심 직후)로 안내해 드릴까요?

불편을 드려 다시 한번 사과드립니다.`,
    shortScript: '기다리시게 해서 죄송합니다. 다음엔 대기 적은 시간대로 예약 도와드릴게요. 양해 부탁드립니다.',
  },
  {
    categoryName: '불만대응',
    title: '치료 비용 관련 불만',
    keywords: ['비용', '비싸', '왜', '이렇게', '바가지'],
    script: `비용에 대해 의문이 드셨군요. 충분히 이해합니다.

저희 치과는 대한치과의사협회 권장 수가를 준수하고 있으며, 치료 전 항상 예상 비용을 안내드리고 있습니다.

혹시 예상하신 금액과 다른 부분이 있으셨나요? 정확한 치료 내역과 비용 내역을 다시 한번 안내해 드릴까요?

담당 직원이나 원장님께 직접 상담을 요청드릴 수도 있습니다.`,
    shortScript: '비용이 부담되셨군요. 치료 내역과 비용 상세히 다시 안내드릴게요. 원장님 상담도 가능합니다.',
  },

  // ============ 기타 ============
  {
    categoryName: '기타',
    title: '주차 안내',
    keywords: ['주차', '차', '파킹', '어디'],
    script: `주차 안내드리겠습니다.

저희 치과 건물 지하 주차장 이용 가능합니다.
• 위치: 건물 지하 1층
• 진료 시 주차 2시간 무료
• 2시간 초과 시 추가 요금 발생

건물 입구에서 주차권 뽑으시고, 접수할 때 주차권 주시면 무료 처리해 드립니다.`,
    shortScript: '건물 지하주차장 이용 가능하고, 진료 시 2시간 무료예요. 주차권 접수대에서 처리해드려요.',
  },
  {
    categoryName: '기타',
    title: '치과 위치/오시는 길',
    keywords: ['위치', '어디', '주소', '찾아', '가는'],
    script: `오시는 길 안내드리겠습니다.

주소: [치과 주소 입력]

대중교통:
• 지하철: OO역 O번 출구에서 도보 5분
• 버스: OOO번, OOO번 'OO정류장' 하차

자가용: 건물 지하주차장 이용 (진료 시 2시간 무료)

찾으시기 어려우시면 전화 주세요. 상세히 안내드리겠습니다.`,
    shortScript: '[치과 주소]입니다. OO역 O번 출구 도보 5분이에요. 주차는 지하주차장 2시간 무료입니다.',
  },
];

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { db } = await connectToDatabase();
    const clinicId = authUser.clinicId;
    const now = new Date().toISOString();

    // 1. 카테고리 확인/생성
    let categories = await db
      .collection(CATEGORIES_COLLECTION)
      .find({ clinicId })
      .toArray();

    if (categories.length === 0) {
      const defaultCategories = DEFAULT_MANUAL_CATEGORIES.map((cat) => ({
        clinicId,
        name: cat.name,
        order: cat.order,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));

      await db.collection(CATEGORIES_COLLECTION).insertMany(defaultCategories);
      categories = await db
        .collection(CATEGORIES_COLLECTION)
        .find({ clinicId })
        .toArray();
    }

    // 카테고리명 -> ID 맵
    const categoryMap = new Map(
      categories.map((c) => [c.name, c._id.toString()])
    );

    // 2. 기존 매뉴얼 개수 확인
    const existingCount = await db
      .collection(MANUALS_COLLECTION)
      .countDocuments({ clinicId });

    if (existingCount > 0) {
      return NextResponse.json({
        success: false,
        error: '이미 매뉴얼 데이터가 존재합니다. 초기화가 필요하면 기존 데이터를 삭제 후 다시 시도해주세요.',
        existingCount,
      });
    }

    // 3. 매뉴얼 생성
    const manualsToInsert = DEFAULT_MANUALS.map((manual, index) => {
      const categoryId = categoryMap.get(manual.categoryName);
      if (!categoryId) {
        throw new Error(`카테고리를 찾을 수 없습니다: ${manual.categoryName}`);
      }

      return {
        clinicId,
        categoryId,
        title: manual.title,
        keywords: manual.keywords,
        script: manual.script,
        shortScript: manual.shortScript || '',
        isActive: true,
        order: index + 1,
        createdAt: now,
        updatedAt: now,
      };
    });

    await db.collection(MANUALS_COLLECTION).insertMany(manualsToInsert);

    return NextResponse.json({
      success: true,
      message: `${manualsToInsert.length}개의 기본 FAQ 매뉴얼이 생성되었습니다.`,
      count: manualsToInsert.length,
      categories: Array.from(categoryMap.keys()),
    });
  } catch (error) {
    console.error('[Manuals Seed API] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 시드 데이터 삭제 (개발용)
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  try {
    const authUser = verifyApiToken(request);
    if (!authUser) return unauthorizedResponse();

    const { db } = await connectToDatabase();
    const clinicId = authUser.clinicId;

    const result = await db
      .collection(MANUALS_COLLECTION)
      .deleteMany({ clinicId });

    return NextResponse.json({
      success: true,
      message: `${result.deletedCount}개의 매뉴얼이 삭제되었습니다.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[Manuals Seed API] DELETE 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
