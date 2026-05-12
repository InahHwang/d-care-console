// src/types/marketingCost.ts
// 마케팅 비용 (광고비 집행 기록)

export type MarketingChannelCategory = 'online' | 'offline' | 'influencer' | 'other';

// 환자 referralSource와 매칭되는 채널 키
// referralSource: '유튜브' | '블로그' | '홈페이지' | '소개환자' | '제휴' | '기타'
// 추가 채널(네이버광고/인스타/당근/전단지 등)은 자유 입력으로 확장
export interface MarketingCostV2 {
  _id?: string;
  clinicId: string;
  year: number;
  month: number; // 1-12
  channel: string; // 자유 입력 (예: '네이버광고', '인스타', '블로그', '당근', '전단지')
  category: MarketingChannelCategory;
  amount: number; // 원
  memo?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
}

export interface CreateMarketingCostInput {
  year: number;
  month: number;
  channel: string;
  category: MarketingChannelCategory;
  amount: number;
  memo?: string;
}

export interface UpdateMarketingCostInput {
  channel?: string;
  category?: MarketingChannelCategory;
  amount?: number;
  memo?: string;
}
