// src/app/v2/reports/components/MonthlyReport-Utils.ts
// V2 월별 보고서 공통 유틸리티

/** 금액을 한국어 단위(원/만원/억원)로 포맷 */
export function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    const value = parseFloat((amount / 100000000).toFixed(2));
    return `${value}억원`;
  }
  if (amount >= 10000) {
    return `${Math.round(amount / 10000).toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}
