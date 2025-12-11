// src/lib/phone.ts

export const CLINIC_DIDS = [
  process.env.NEXT_PUBLIC_CLINIC_MAIN ?? '0315672278',
  // 필요 시 추가: '031xxxxxxx', '02xxxxxxx' ...
];

export function toDigits(s?: string) {
  return (s ?? '').replace(/\D/g, '');
}

export function normalizeNumber(raw?: string) {
  let n = toDigits(raw);
  // +82 → 0 보정 (예: +82 10 → 010)
  if (n.startsWith('82')) n = '0' + n.slice(2);
  // 10자리 10xxxxxxx 형태 보정이 필요하면 아래 주석 해제
  // if (n.length === 10 && n.startsWith('10')) n = '0' + n;
  return n;
}

export function isClinicNumber(n?: string) {
  const num = normalizeNumber(n);
  return CLINIC_DIDS.includes(num);
}

export function extractCallerFromDN(DN1?: string, DN2?: string) {
  const a = normalizeNumber(DN1); // 외부번호일 가능성 높음
  const b = normalizeNumber(DN2); // 병원번호(DID)일 가능성
  const direction: 'IN' | 'OUT' = isClinicNumber(b) ? 'IN' : 'OUT';
  const caller = direction === 'IN' ? a : b;
  return { direction, caller, a, b };
}
