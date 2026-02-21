# D-Care V2 사업화 기술 보완 로드맵

> 작성일: 2026-02-15
> 현재 상용화 준비도: 3/10

---

## 목차

1. [Critical - 즉시 해결 필수](#1-critical---즉시-해결-필수)
2. [High - 출시 전 해결 필요](#2-high---출시-전-해결-필요)
3. [Medium - 품질 및 운영](#3-medium---품질-및-운영)
4. [Phase별 실행 계획](#4-phase별-실행-계획)

---

## 1. Critical - 즉시 해결 필수

### 1.1 API 인증 미적용

**현황**: V2 API 라우트에 JWT 토큰 검증이 없음. URL만 알면 누구나 접근 가능.

**영향받는 파일**:
- `src/app/api/v2/patients/route.ts` - 환자 데이터 무인증 접근
- `src/app/api/v2/dashboard/route.ts` - 대시보드 데이터 노출
- `src/app/api/v2/settings/route.ts` - 설정 변경 무방비
- `src/app/api/v2/consultations/route.ts` - 상담 기록 노출
- `src/app/api/v2/call-logs/route.ts` - 통화 이력 노출
- 기타 모든 V2 API 라우트

**해결 방안**:
- [ ] API 미들웨어에서 JWT 토큰 검증 함수 구현 (`src/utils/apiAuth.ts`)
- [ ] 모든 V2 API 라우트 핸들러 시작 부분에 인증 체크 추가
- [ ] 인증 실패 시 401 Unauthorized 응답 표준화
- [ ] 권한별 접근 제어 (admin/manager/staff)

---

### 1.2 멀티테넌시 미구현

**현황**: 단일 치과만 지원. `clinicId = 'default'` 하드코딩. 여러 치과 가입 시 데이터 혼재.

**영향받는 파일**:
- `src/app/api/v2/settings/route.ts:65` - `clinicId = 'default'` 하드코딩
- `src/types/v2/index.ts:143` - `clinicId` 필드 정의는 있지만 미사용
- 모든 V2 API의 DB 쿼리 - clinicId 필터 없음

**해결 방안**:
- [ ] 치과(클리닉) 관리 컬렉션 생성 (`clinics`)
- [ ] 사용자 가입/로그인 시 clinicId를 JWT에 포함
- [ ] 모든 DB 쿼리에 `clinicId` 필터 추가
- [ ] 데이터 격리 검증 테스트
- [ ] 기존 데이터 마이그레이션 (기본 clinicId 부여)

---

### 1.3 보안 취약점

**현황**:

| 항목 | 위치 | 상태 |
|------|------|------|
| 테스트 계정 하드코딩 | `src/app/api/auth/login/route.ts:13-24` | 마스터 계정 노출 |
| CORS 전체 허용 | `src/middleware.ts` | `Access-Control-Allow-Origin: *` |
| 입력값 검증 부재 | 모든 POST/PATCH API | body 검증 없음 |
| Rate Limiting 없음 | 전체 API | 무차별 대입 가능 |
| CSRF 보호 없음 | `src/middleware.ts` | 미구현 |
| 토큰 저장 방식 | `src/components/auth/AuthGuard.tsx` | localStorage (XSS 취약) |

**해결 방안**:
- [ ] 테스트 계정 코드 제거
- [ ] CORS 허용 도메인 제한 (환경변수로 관리)
- [ ] zod 등으로 API 요청 body 스키마 검증 추가
- [ ] Rate Limiting 미들웨어 적용 (특히 로그인 API)
- [ ] 토큰 저장을 httpOnly 쿠키로 전환 검토
- [ ] API 에러 응답에서 DB 구조 정보 제거

---

## 2. High - 출시 전 해결 필요

### 2.1 테스트 코드 전무

**현황**: 테스트 파일 0개. jest.config 없음. 회귀 테스트 불가능.

**해결 방안**:
- [ ] Jest + React Testing Library 설정
- [ ] API 라우트 단위 테스트 (최소 핵심 CRUD)
- [ ] 인증/권한 테스트
- [ ] 멀티테넌시 데이터 격리 테스트
- [ ] CI에서 테스트 자동 실행

---

### 2.2 에러 처리 & 모니터링 미흡

**현황**:
- `console.error`로만 로깅 (구조화된 로깅 없음)
- 에러 응답 포맷 불일치
- Error Boundary 없음 → 컴포넌트 에러 시 화면 전체 깨짐
- 프로덕션 에러 알림 없음

**해결 방안**:
- [ ] Sentry 연동 (프론트엔드 + API)
- [ ] API 에러 응답 포맷 표준화: `{ success: boolean, data?: any, error?: { code: string, message: string } }`
- [ ] React Error Boundary 추가 (`src/app/v2/layout.tsx`)
- [ ] 구조화된 로깅 라이브러리 도입 (pino 등)

---

### 2.3 DB 스키마 검증 없음

**현황**:
- `patients_v2` 컬렉션에 MongoDB Schema Validation 미적용
- V1 `patients`에만 스키마 검증 존재 (`src/utils/mongodb.ts:161-189`)
- 마이그레이션 함수 멱등성 없음

**해결 방안**:
- [ ] `patients_v2` 컬렉션에 Schema Validation 추가
- [ ] `consultations`, `call_logs` 등 주요 컬렉션에도 적용
- [ ] 마이그레이션 함수에 버전 관리 및 멱등성 보장 로직 추가
- [ ] 인덱스 최적화 검토

---

### 2.4 세션 관리 부실

**현황**: JWT 만료 1일, Refresh Token 없음. 동시 로그인 제한 없음.

**해결 방안**:
- [ ] Access Token (15분) + Refresh Token (7일) 이중 구조
- [ ] Refresh Token DB 저장 및 관리
- [ ] 동시 세션 수 제한 옵션
- [ ] 강제 로그아웃 기능 (관리자용)

---

## 3. Medium - 품질 및 운영

### 3.1 API 설계 일관성

**현황**:
- V1/V2 API 혼재
- 응답 포맷 비표준
- API 문서 없음
- skip/limit 페이지네이션 → 대량 데이터 성능 저하

**해결 방안**:
- [ ] API 응답 포맷 통일
- [ ] OpenAPI(Swagger) 문서 자동 생성
- [ ] cursor 기반 페이지네이션 전환 검토
- [ ] V1 API 단계적 폐기 계획

---

### 3.2 CI/CD 파이프라인

**현황**: Vercel 직접 배포만 사용. 자동화 테스트/배포 없음.

**해결 방안**:
- [ ] GitHub Actions 워크플로우 구성 (lint → test → build → deploy)
- [ ] PR 시 자동 테스트 실행
- [ ] 스테이징/프로덕션 환경 분리
- [ ] docker-compose로 로컬 개발 환경 구성

---

### 3.3 확장성

**현황**: 캐싱 없음, 메시지 큐 없음, 단일 리전.

**해결 방안**:
- [ ] Redis 캐싱 레이어 (자주 조회되는 데이터)
- [ ] 통화 분석 등 무거운 작업 비동기 큐 처리
- [ ] MongoDB 커넥션 풀 설정 최적화
- [ ] CDN 활용 정적 자산 배포

---

## 4. Phase별 실행 계획

```
Phase 1 - 보안 기반 (약 3주)
├── 1.1 API 인증 미들웨어 구축
├── 1.2 멀티테넌시 (clinicId 기반 데이터 격리)
├── 1.3 테스트 계정 제거 & 보안 기본 조치
└── 1.3 입력값 검증 (zod)

Phase 2 - 안정성 (약 2주)
├── 2.2 에러 모니터링 (Sentry 연동)
├── 2.2 API 응답 포맷 표준화
├── 2.4 Refresh Token 구현
└── 2.3 DB 스키마 검증 추가

Phase 3 - 품질 (약 2주)
├── 2.1 핵심 API 테스트 코드 작성
├── 3.2 CI/CD 파이프라인 (GitHub Actions)
├── 3.1 API 문서 자동화 (Swagger)
└── 2.2 Error Boundary 추가

Phase 4 - 확장 (약 1주)
├── 1.3 Rate Limiting
├── 2.2 구조화된 로깅
├── 3.3 캐싱 레이어
└── 3.3 비동기 작업 큐
```

**총 예상 기간: 약 8주**

---

## 진행 상황 추적

| Phase | 항목 | 상태 | 완료일 |
|-------|------|------|--------|
| 1 | API 인증 미들웨어 | ✅ 완료 | 2026-02-21 |
| 1 | 멀티테넌시 | ⬜ 미착수 | - |
| 1 | 보안 기본 조치 | ⬜ 미착수 | - |
| 1 | 입력값 검증 | ⬜ 미착수 | - |
| 2 | Sentry 연동 | ⬜ 미착수 | - |
| 2 | API 응답 표준화 | ⬜ 미착수 | - |
| 2 | Refresh Token | ⬜ 미착수 | - |
| 2 | DB 스키마 검증 | ⬜ 미착수 | - |
| 3 | 테스트 코드 | ⬜ 미착수 | - |
| 3 | CI/CD | ⬜ 미착수 | - |
| 3 | API 문서 | ⬜ 미착수 | - |
| 3 | Error Boundary | ⬜ 미착수 | - |
| 4 | Rate Limiting | ⬜ 미착수 | - |
| 4 | 구조화된 로깅 | ⬜ 미착수 | - |
| 4 | 캐싱 레이어 | ⬜ 미착수 | - |
| 4 | 비동기 작업 큐 | ⬜ 미착수 | - |
