// src/constants/desks.ts
// 치과 데스크(전화기 자리) 정의
// 각 데스크는 외부 직통 전화번호와 1:1 매핑됨
// 자동 환자 등록 시 calledNumber로 어느 데스크인지 → 누가 받았는지 식별

export interface DeskOption {
  number: string;   // 정규화된 번호 (숫자만, 예: "0315672278") - DB 저장용
  display: string;  // 표시용 포맷 (예: "031-567-2278")
}

// 향후 settings_v2로 이전 가능 (멀티테넌시)
export const DESK_OPTIONS: DeskOption[] = [
  { number: '0315672278', display: '031-567-2278' },
  { number: '07047414202', display: '070-4741-4202' },
  { number: '07047414201', display: '070-4741-4201' },
];

export const NO_DESK_VALUE = ''; // 자리 없이 시작 (자동 매핑 비활성)

export function isValidDeskNumber(num: string): boolean {
  if (num === NO_DESK_VALUE) return true;
  return DESK_OPTIONS.some(d => d.number === num);
}

export function getDeskDisplay(num?: string): string {
  if (!num) return '자리 없음';
  const desk = DESK_OPTIONS.find(d => d.number === num);
  return desk?.display ?? num;
}
