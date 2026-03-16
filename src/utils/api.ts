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

// 응답 인터셉터
api.interceptors.response.use(
  (response) => {
    // 성공 응답 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API 응답:', {
        status: response.status,
        url: response.config.url,
        data: response.data
      });
    }
    
    return response;
  },
  (error) => {
    // 에러 응답 처리
    console.error('💥 API 에러:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data
    });
    
    // 인증 에러 처리
    if (error.response?.status === 401) {
      // 토큰 만료 또는 인증 실패
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        // 로그인 페이지로 리다이렉트 (필요시)
        // window.location.href = '/login';
      }
    }
    
    // Vercel 환경에서 발생할 수 있는 특정 오류 처리
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
    const response = await api.post('/v2/messages/send', messageData);
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