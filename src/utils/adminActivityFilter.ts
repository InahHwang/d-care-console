// src/utils/adminActivityFilter.ts - 기존 코드 기반 수정

import { ActivityAction } from '@/types/activityLog';

// 🔥 관리자 페이지에서 로깅하지 않을 경로들
const ADMIN_PATHS = [
  '/admin',
  '/api/admin',
  '/api/activity-logs',
  '/api/users',
  '/settings'  // 🔥 설정 페이지도 추가
];

// 🔥 관리자 페이지에서 로깅하지 않을 액션들 + 조회성 액션들
const ADMIN_ONLY_ACTIONS = [
  'user_create',
  'user_update', 
  'user_delete',
  'log_delete',
  'logs_cleanup',
  'admin_dashboard_view',
  'activity_logs_view',
  // 🔥 조회성 액션들 추가 (너무 빈번함)
  'patient_view',           // 환자 조회
  'message_log_view',       // 메시지 로그 조회
  'activity_log_view',      // 활동 로그 조회
  'admin_user_list_view',   // 사용자 목록 조회
  'admin_stats_view',       // 통계 조회
];

// 🔥 로그인/로그아웃 관련 액션들 (별도 처리됨)
const AUTH_ACTIONS = [
  'login',
  'logout'
];

/**
 * 현재 경로가 관리자 페이지인지 확인
 */
export function isAdminPath(pathname?: string): boolean {
  if (!pathname) {
    // 브라우저 환경에서 현재 경로 확인
    if (typeof window !== 'undefined') {
      pathname = window.location.pathname;
    } else {
      return false;
    }
  }
  
  return ADMIN_PATHS.some(adminPath => pathname.startsWith(adminPath));
}

/**
 * 관리자 전용 액션인지 확인
 */
export function isAdminOnlyAction(action: string): boolean {
  return ADMIN_ONLY_ACTIONS.includes(action);
}

/**
 * 🔥 로그인/로그아웃 액션인지 확인 (별도 처리)
 */
export function isAuthAction(action: string): boolean {
  return AUTH_ACTIONS.includes(action);
}

/**
 * 🔥 로깅을 건너뛸지 결정 - 개선됨
 */
export function shouldSkipLogging(action: string, pathname?: string): boolean {
  // 🔥 로그인/로그아웃은 별도 API에서 처리되므로 일반 로깅에서 제외
  if (isAuthAction(action)) {
    console.log(`🚫 인증 액션으로 로깅 제외: ${action}`);
    return true;
  }
  
  // 관리자 전용 액션은 항상 스킵
  if (isAdminOnlyAction(action)) {
    console.log(`🚫 관리자/조회 액션으로 로깅 제외: ${action}`);
    return true;
  }
  
  // 관리자 페이지에서의 모든 액션은 스킵
  if (isAdminPath(pathname)) {
    console.log(`🚫 관리자 페이지에서 로깅 제외: ${action} at ${pathname}`);
    return true;
  }
  
  return false;
}

/**
 * 현재 사용자가 관리자 페이지에 있는지 확인 (React 컴포넌트용)
 */
export function useIsAdminPage(): boolean {
  if (typeof window === 'undefined') return false;
  return isAdminPath(window.location.pathname);
}

// 🔥 이전 함수명 호환성을 위한 alias들
export const isAdminPage = isAdminPath;

// 🔥 타입스크립트를 위한 ActivityAction 타입 체크 함수
export function shouldSkipLoggingTyped(action: ActivityAction, pathname?: string): boolean {
  return shouldSkipLogging(action, pathname);
}