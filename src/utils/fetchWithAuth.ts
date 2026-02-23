// src/utils/fetchWithAuth.ts
// 인증 헤더가 포함된 fetch 래퍼 (V2 페이지용)

export function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: HeadersInit = {
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}
