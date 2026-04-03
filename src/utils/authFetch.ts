// src/utils/authFetch.ts
// fetch() 래퍼 — Authorization 헤더 자동 첨부
// 기존 fetch()와 동일한 시그니처. drop-in replacement.

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Authorization 헤더가 없으면 localStorage에서 토큰 가져와서 추가
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(input, { ...init, headers });
}
