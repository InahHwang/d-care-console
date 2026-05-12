// src/components/v2/marketing-analytics/Marketing-Analytics-Types.ts
// 공통 타입

export interface ChannelRow {
  channel: string;
  cost: number;
  newPatients: number;
  estimatedRevenue: number;
  actualRevenue: number;
  roas: number;
  actualRoas: number;
  cac: number;
}

export interface MonthlyAnalytics {
  year: number;
  month: number;
  totalCost: number;
  totalNewPatients: number;
  totalEstimatedRevenue: number;
  totalActualRevenue: number;
  roas: number;
  actualRoas: number;
  cac: number;
  channels: ChannelRow[];
}

export interface MarketingCost {
  _id: string;
  clinicId: string;
  year: number;
  month: number;
  channel: string;
  category: 'online' | 'offline' | 'influencer' | 'other';
  amount: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
}

export const CATEGORY_LABEL: Record<string, string> = {
  online: '온라인',
  offline: '오프라인',
  influencer: '인플루언서·제휴',
  other: '기타',
};

// 통화 포맷터: 1,234,000 → "123만 4천"
export function formatKRW(amount: number): string {
  if (amount === 0) return '0원';
  const eok = Math.floor(amount / 100000000);
  const man = Math.floor((amount % 100000000) / 10000);
  const won = amount % 10000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString()}만`);
  if (parts.length === 0 && won > 0) parts.push(`${won}원`);
  return parts.length > 0 ? parts.join(' ') : `${amount.toLocaleString()}원`;
}

export function formatKRWShort(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만`;
  return `${amount.toLocaleString()}`;
}
