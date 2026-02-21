// src/utils/api.ts
import axios from 'axios';

// 환경별 기본 URL 설정
const getBaseURL = () => {
  // 브라우저 환경에서만 실행
  if (typeof window !== 'undefined') {
    // 프로덕션: 현재 도메인 사용
    if (window.location.hostname !== 'localhost') {
      return `${window.location.protocol}//${window.location.host}/api`;
    }
  }
  
  // 개발 환경 또는 서버사이드: 상대 경로 사용
  return process.env.NEXT_PUBLIC_API_URL || '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  // 타임아웃 설정 (Vercel 환경 고려)
  timeout: 30000, // 30초
});

// 요청 인터셉터
api.interceptors.request.use(
  (config) => {
    // 인증 토큰 설정 (JWT 사용 시)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    // 디버깅 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 API 요청:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ API 요청 인터셉터 에러:', error);
    return Promise.reject(error);
  }
);

// Refresh Token 자동 갱신 상태 관리
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (token) prom.resolve(token);
    else prom.reject(error);
  });
  failedQueue = [];
};

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API 응답:', {
        status: response.status,
        url: response.config.url,
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 401 에러 + 아직 재시도하지 않은 요청 → Refresh Token으로 갱신 시도
    if (error.response?.status === 401 && !originalRequest._retry) {
      // refresh 엔드포인트 자체가 실패한 경우는 재시도하지 않음
      if (originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 추가하고 대기
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = typeof window !== 'undefined'
          ? localStorage.getItem('refreshToken')
          : null;

        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/auth/refresh', { refreshToken });

        if (data.success && data.token) {
          localStorage.setItem('token', data.token);
          if (data.refreshToken) {
            localStorage.setItem('refreshToken', data.refreshToken);
          }

          api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
          processQueue(null, data.token);

          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          return api(originalRequest);
        } else {
          throw new Error('Refresh failed');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 기타 에러 로깅
    if (process.env.NODE_ENV === 'development') {
      console.error('💥 API 에러:', {
        message: error.message,
        status: error.response?.status,
        url: error.config?.url,
      });
    }

    // Vercel 타임아웃 에러 처리
    if (error.code === 'FUNCTION_INVOCATION_TIMEOUT') {
      error.message = '서버 응답 시간 초과. 잠시 후 다시 시도해주세요.';
    }

    return Promise.reject(error);
  }
);

// 메시지 발송 전용 API 함수
export const sendMessage = async (messageData: {
  patients?: Array<{
    id: string;
    name: string;
    phoneNumber: string;
  }>;
  phoneNumber?: string;
  patientName?: string;
  content: string;
  messageType: 'SMS' | 'LMS' | 'MMS' | 'RCS';
  imageUrl?: string;
}) => {
  try {
    const response = await api.post('/messages/send', messageData);
    return response.data;
  } catch (error: any) {
    // 에러 메시지 개선
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('메시지 발송 중 오류가 발생했습니다.');
    }
  }
};

// 이미지 업로드 전용 API 함수
export const uploadImage = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // 이미지 업로드는 시간이 더 걸릴 수 있음
      timeout: 60000, // 60초
    });
    
    return response.data;
  } catch (error: any) {
    // 에러 메시지 개선
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('이미지 업로드 중 오류가 발생했습니다.');
    }
  }
};

// 환경 정보 확인 함수
export const getEnvironmentInfo = () => {
  const isClient = typeof window !== 'undefined';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isVercel = process.env.VERCEL === '1';
  
  return {
    isClient,
    isDevelopment,
    isVercel,
    baseURL: getBaseURL(),
    hostname: isClient ? window.location.hostname : 'server',
  };
};

// 기본 export
export default api;