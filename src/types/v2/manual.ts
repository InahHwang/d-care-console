// src/types/v2/manual.ts
// 상담 매뉴얼 관련 타입 정의

import { ObjectId } from 'mongodb';

// ============================================
// 매뉴얼 카테고리 타입
// ============================================

export interface ManualCategory {
  _id?: ObjectId | string;
  clinicId?: string;
  name: string;           // 카테고리명 (임플란트, 교정, 일반상담, 불만대응 등)
  order: number;          // 정렬 순서
  isActive: boolean;      // 활성화 여부
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================
// 상담 매뉴얼 타입
// ============================================

export interface Manual {
  _id?: ObjectId | string;
  clinicId?: string;
  categoryId: string;     // 카테고리 ID
  categoryName?: string;  // 조회 시 조인용
  title: string;          // 매뉴얼 제목
  keywords: string[];     // 검색 키워드 (자동 추천용)
  script: string;         // 전체 스크립트 (전화 상담용)
  shortScript?: string;   // 짧은 버전 (채팅 삽입용)
  isActive: boolean;      // 활성화 여부
  order: number;          // 정렬 순서
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================
// API 요청/응답 타입
// ============================================

export interface ManualCreateRequest {
  categoryId: string;
  title: string;
  keywords: string[];
  script: string;
  shortScript?: string;
  order?: number;
}

export interface ManualUpdateRequest {
  categoryId?: string;
  title?: string;
  keywords?: string[];
  script?: string;
  shortScript?: string;
  isActive?: boolean;
  order?: number;
}

export interface ManualCategoryCreateRequest {
  name: string;
  order?: number;
}

export interface ManualCategoryUpdateRequest {
  name?: string;
  order?: number;
  isActive?: boolean;
}

export interface ManualSearchParams {
  keyword?: string;       // 키워드 검색
  categoryId?: string;    // 카테고리 필터
  isActive?: boolean;     // 활성화 필터
  page?: number;
  limit?: number;
}

// ============================================
// 기본 카테고리 (초기 세팅용)
// ============================================

export const DEFAULT_MANUAL_CATEGORIES = [
  { name: '임플란트', order: 1 },
  { name: '교정', order: 2 },
  { name: '일반진료', order: 3 },
  { name: '비용안내', order: 4 },
  { name: '예약/일정', order: 5 },
  { name: '불만대응', order: 6 },
  { name: '기타', order: 99 },
] as const;

// ============================================
// 유틸리티 타입
// ============================================

export interface ManualWithCategory extends Manual {
  category?: ManualCategory;
}
