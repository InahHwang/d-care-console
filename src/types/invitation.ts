// src/types/invitation.ts

// 사용자 역할 타입 (user.ts와 공유)
export type UserRole = 'admin' | 'manager' | 'staff';

// 초대 상태
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

// 초대 인터페이스
export interface Invitation {
  _id?: string;
  name: string;                    // 초대받은 사람 이름
  email?: string;                  // 이메일 (선택)
  role: UserRole;                  // 부여할 역할
  token: string;                   // UUID 초대 토큰
  expiresAt: Date | string;        // 만료일 (7일)
  status: InvitationStatus;
  invitedBy: string;               // 초대한 사람 ID
  invitedByName?: string;          // 초대한 사람 이름 (표시용)
  acceptedAt?: Date | string;
  acceptedUserId?: string;         // 수락 후 생성된 사용자 ID
  createdAt: Date | string;
}

// 초대 생성 요청
export interface CreateInvitationRequest {
  name: string;
  email?: string;
  role: UserRole;
}

// 초대 수락 요청 (회원가입)
export interface AcceptInvitationRequest {
  username: string;
  password: string;
  name?: string;  // 변경 원할 경우
}

// 초대 목록 응답
export interface InvitationsListResponse {
  success: boolean;
  data: Invitation[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

// 초대 검증 응답
export interface InvitationVerifyResponse {
  success: boolean;
  valid: boolean;
  invitation?: Invitation;
  error?: string;
}

// 초대 수락 응답
export interface InvitationAcceptResponse {
  success: boolean;
  message?: string;
  userId?: string;
  error?: string;
}

// 역할 표시 설정
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string }> = {
  admin: { label: '관리자', color: 'purple', bgColor: 'bg-purple-100 text-purple-700' },
  manager: { label: '매니저', color: 'blue', bgColor: 'bg-blue-100 text-blue-700' },
  staff: { label: '상담사', color: 'gray', bgColor: 'bg-gray-100 text-gray-700' },
};

// 초대 상태 표시 설정
export const INVITATION_STATUS_CONFIG: Record<InvitationStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '대기중', color: 'yellow', bgColor: 'bg-yellow-100 text-yellow-700' },
  accepted: { label: '수락됨', color: 'green', bgColor: 'bg-green-100 text-green-700' },
  expired: { label: '만료됨', color: 'gray', bgColor: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '취소됨', color: 'red', bgColor: 'bg-red-100 text-red-700' },
};
