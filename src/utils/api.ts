// src/utils/api.ts
import axios from 'axios';

// 환경에 따른 기본 URL 설정
const baseURL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 인증 토큰 설정 (JWT 사용 시)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;