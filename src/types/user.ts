// src/types/user.ts

// 기존 authSlice의 User 인터페이스와 호환되도록 확장
export interface User {
  id: string
  _id?: string  // MongoDB 호환성
  username: string  // 로그인용 사용자명 (기존 email과 동일하게 사용)
  email: string     // 기존 필드 유지
  name: string
  role: 'master' | 'staff'  // 기존 string에서 구체적 타입으로
  isActive: boolean
  department?: string  // 부서 (선택적)
  createdAt: string
  updatedAt: string
  lastLogin?: string
  createdBy?: string   // 계정 생성자
  clinicId: string     // 소속 치과 ID (멀티테넌시)
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
  role: 'master' | 'staff'
  department?: string
}

// 사용자 수정 요청 데이터
export interface UpdateUserRequest {
  username?: string
  email?: string
  name?: string
  role?: 'master' | 'staff'
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