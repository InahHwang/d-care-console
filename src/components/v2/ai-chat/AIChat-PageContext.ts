// src/components/v2/ai-chat/AIChat-PageContext.ts
// 페이지 경로 → 한글 제목 매핑

const PAGE_TITLE_MAP: Record<string, string> = {
  '/v2': '대시보드',
  '/v2/dashboard': '대시보드',
  '/v2/patients': '환자 관리',
  '/v2/callbacks': '콜백 관리',
  '/v2/consultations': '상담 관리',
  '/v2/call-logs': '통화기록',
  '/v2/reports': '보고서',
  '/v2/channel-chats': '채널챗',
  '/v2/settings': '설정',
  '/v2/admin/audit': '감사 로그',
  '/v2/recall': '리콜 관리',
};

export function getPageTitle(pathname: string): string {
  // 정확한 매치 우선
  if (PAGE_TITLE_MAP[pathname]) return PAGE_TITLE_MAP[pathname];

  // 환자 상세 페이지
  if (pathname.startsWith('/v2/patients/')) return '환자 상세';

  // 부분 매치
  for (const [path, title] of Object.entries(PAGE_TITLE_MAP)) {
    if (pathname.startsWith(path)) return title;
  }

  return '디케어 콘솔';
}
