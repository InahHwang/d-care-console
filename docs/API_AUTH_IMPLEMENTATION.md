# API 인증 미들웨어 구현 결과 (2026-02-21)

## 개요

모든 V2 API에 JWT 토큰 검증을 추가하여, 로그인한 사용자만 API에 접근 가능하도록 변경.

## 변경 사항

### 새로 생성한 파일

- `src/utils/apiAuth.ts` — 공통 인증 유틸리티
  - `verifyApiToken(request)` — JWT 토큰 검증, 성공 시 AuthUser 반환
  - `unauthorizedResponse()` — 401 응답
  - `forbiddenResponse()` — 403 응답
  - `isAdmin(user)` — 관리자 권한 확인

### 인증 추가된 API 라우트 (약 40개 파일, 70+ 핸들러)

| 카테고리 | 파일 수 | 핸들러 수 |
|---------|--------|----------|
| patients | 6 | 13 |
| call-logs | 6 | 10 |
| callbacks | 1 | 4 |
| consultations | 1 | 4 |
| dashboard | 1 | 1 |
| reports | 1 | 1 |
| settings | 1 | 2 |
| recall-settings | 1 | 4 |
| recall-messages | 6 | 10 |
| channel-chats | 5 | 10 |
| consultants | 1 | 1 |
| manuals | 4 | 8 |
| manual-categories | 1 | 4 |
| referrals | 1 | 4 |
| thanks | 1 | 3 |
| alimtalk | 1 | 2 |
| users (기존 리팩토링) | 2 | 5 |

### 인증 제외된 라우트 (의도적)

| 경로 | 이유 |
|------|------|
| `/api/v2/cti/*` | CTIBridge(Windows 서비스)에서 호출, JWT 없음 |
| `/api/v2/webhooks/*` | 네이버/카카오/인스타그램 외부 서비스 호출 |
| `/api/v2/call-analysis/*` | CTIBridge에서 녹취 파일 전송 시 호출 |
| `/api/auth/*` | 로그인/로그아웃 자체 |
| `/api/v2/seed/*`, `migrate/*`, `test/*` | 유지보수/마이그레이션 유틸 |

## 동작 방식

### 인증 흐름

```
[프론트엔드]                         [백엔드 API]
    │                                    │
    ├─ 로그인 → JWT 토큰 수신            │
    ├─ localStorage에 토큰 저장           │
    │                                    │
    ├─ API 호출 시                        │
    │  Axios 인터셉터가 자동으로           │
    │  Authorization: Bearer <token>     │
    │  헤더 추가                          │
    │                                    │
    └────────────────────────────────────>│
                                         ├─ verifyApiToken(request)
                                         ├─ 토큰 없음/만료 → 401
                                         └─ 토큰 유효 → 정상 처리
```

### 프론트엔드 변경 없음

Axios 인터셉터(`src/utils/api.ts`)가 이미 Bearer 토큰을 자동 전송하므로,
프론트엔드 코드 변경 없이 기존과 동일하게 동작합니다.

## 백업

- 브랜치: `backup/before-api-auth` — 작업 전 전체 상태 보존
- 복구 방법: `git checkout backup/before-api-auth` 으로 이전 상태로 돌아갈 수 있음

## 검증

- `npm run build` 성공 확인 완료
- 토큰 없이 API 호출 시 401 응답 반환 확인 필요 (수동 테스트)
