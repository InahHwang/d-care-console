// src/types/user.ts

import { UserRole } from './invitation';

// 역할 타입 (invitation.ts에서 가져옴)
// 'admin' | 'manager' | 'staff'
// master는 admin으로 호환 처리 (로그인 시 자동 변환)

// 기존 authSlice의 User 인터페이스와 호환되도록 확장
export interface User {
  id: string
  _id?: string  // MongoDB 호환성
  username: string  // 로그인용 사용자명 (기존 email과 동일하게 사용)
  email: string     // 기존 필드 유지
  name: string
  role: UserRole | 'master'  // master는 레거시, admin으로 취급
  isActive: boolean
  department?: string  // 부서 (선택적)
  createdAt: string
  updatedAt: string
  lastLogin?: string
  createdBy?: string   // 계정 생성자
}

// 역할 정규화 함수 (master -> admin)
export function normalizeRole(role: string): UserRole {
  if (role === 'master') return 'admin';
  return role as UserRole;
}

// 관리자 권한 체크 (admin 또는 레거시 master)
export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'master';
}

// 로그인 요청 데이터
export interface LoginCredentials {
  email: string      // 기존 필드명 유지 (실제로는 username으로 사용)
  password: string
}

// 사용자 생성 요청 데이터
export interface CreateUserRequest {
  username: string
  email: string
  name: string
  password: string
  role: UserRole | 'master'  // 레거시 호환
  department?: string
}

// 사용자 수정 요청 데이터
export interface UpdateUserRequest {
  username?: string
  email?: string
  name?: string
  role?: UserRole | 'master'  // 레거시 호환
  department?: string
  isActive?: boolean
}

// 사용자 목록 조회 응답
export interface UsersListResponse {
  users: User[]
  total: number
  page: number
  limit: number
}

// API 응답 타입
export interface UserApiResponse {
  success: boolean
  message?: string
  user?: User
  users?: User[]
  total?: number
}