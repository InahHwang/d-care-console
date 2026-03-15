# D-Care Console

치과 환자 관리 및 아웃바운드 콜센터 시스템

## 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **State**: Redux Toolkit, React Query
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **실시간 통신**: Pusher
- **CTI**: CTIBridge (.NET 9 Windows Service)
- **SMS**: CoolSMS
- **AI 분석**: OpenAI (통화 녹음 분석)

## 프로젝트 구조
```
d-care-console/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # V1 API 라우트
│   │   ├── api/v2/       # V2 API 라우트
│   │   ├── v2/           # V2 페이지
│   │   └── ...           # V1 페이지
│   ├── components/       # React 컴포넌트
│   │   ├── v2/           # V2 전용 컴포넌트
│   │   └── ...           # 공통/V1 컴포넌트
│   ├── store/            # Redux 스토어
│   │   └── slices/       # Redux 슬라이스
│   ├── hooks/            # Custom hooks
│   ├── lib/              # 유틸리티 라이브러리
│   ├── types/            # TypeScript 타입 정의
│   ├── utils/            # 유틸리티 함수
│   └── constants/        # 상수 정의
├── CTIBridge/            # .NET CTI 브릿지 서비스
│   ├── Program.cs        # 엔트리포인트
│   ├── CTIWorker.cs      # 워커 서비스
│   └── publish/          # 배포 파일
└── public/               # 정적 파일
```

## 주요 명령어
```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# CTIBridge 빌드 (Windows)
cd CTIBridge
dotnet publish -c Release -r win-x86 --self-contained

# CTIBridge 서비스 관리
net start "CTI Bridge Service"
net stop "CTI Bridge Service"
```

## API 버전

- **V1**: `/api/*` - 레거시 API (**더 이상 수정하지 않음. V1 코드는 건드리지 말 것**)
- **V2**: `/api/v2/*` - 현재 운영 중인 API (patients_v2 컬렉션 사용). **모든 신규 작업은 V2에서만 진행**

## 환경 변수

`.env.local` 파일 필요:
- `MONGODB_URI`: MongoDB 연결 문자열
- `PUSHER_*`: Pusher 설정
- `COOLSMS_*`: SMS API 키
- `OPENAI_API_KEY`: OpenAI API 키
- `NAVER_TALKTALK_AUTH_TOKEN`: 네이버톡톡 발송 API 인증 토큰
- `KAKAO_CONSULTALK_API_TOKEN`: 카카오 상담톡 API 토큰 (선택, 별도 계약 필요)

### 네이버톡톡 설정

1. [네이버톡톡 파트너센터](https://partner.talk.naver.com/) 접속
2. 개발자도구 > 챗봇 API 설정
3. "이벤트 받을 URL"에 웹훅 URL 입력: `https://your-domain.com/api/v2/webhooks/naver`
4. 이벤트 선택: send, open, leave 체크
5. "보내기 API" 섹션에서 Authorization 생성 → `NAVER_TALKTALK_AUTH_TOKEN`에 설정

### 카카오 비즈니스 채널 설정

1. [카카오 비즈니스](https://business.kakao.com/) 접속 > 카카오톡 채널 생성
2. [카카오 디벨로퍼스](https://developers.kakao.com/) 접속 > 앱 생성
3. 앱 설정 > 카카오톡 채널 연결
4. 챗봇 관리자센터에서 스킬 서버 URL 설정: `https://your-domain.com/api/v2/webhooks/kakao`
5. (선택) 상담톡 계약 시 → `KAKAO_CONSULTALK_API_TOKEN`에 토큰 설정

**참고**: 카카오 채널은 챗봇 스킬 서버 방식으로 동작합니다. 상담사 메시지는 고객이 다음 메시지를 보낼 때 웹훅 응답으로 전송됩니다. 실시간 발송이 필요하면 상담톡 API 계약이 필요합니다.

### 인스타그램 DM 설정

1. [Meta 개발자 포털](https://developers.facebook.com/) 접속 > 앱 생성
2. Instagram Basic Display 또는 Instagram Graph API 추가
3. Instagram 비즈니스 계정과 Facebook 페이지 연결
4. 웹훅 설정:
   - Callback URL: `https://your-domain.com/api/v2/webhooks/instagram`
   - Verify Token: 임의 문자열 (환경변수와 일치해야 함)
   - 구독 필드: `messages`, `messaging_postbacks`
5. 앱 검수 제출 (messages 권한)
6. 환경변수 설정:
   - `INSTAGRAM_ACCESS_TOKEN`: Page Access Token (장기 토큰 권장)
   - `INSTAGRAM_PAGE_ID`: Instagram Business Account ID
   - `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`: 웹훅 검증용 토큰

**참고**: 인스타그램 DM은 24시간 응답 제한이 있습니다. 고객이 메시지를 보낸 후 24시간 이내에만 응답할 수 있습니다.

## CTIBridge

로컬 PC의 CTI 장비와 웹 애플리케이션을 연결하는 Windows 서비스.
- 포트: 5959 (내부 통신)
- 로그: `CTIBridge/publish/logs/`

## 주의사항

- V1과 V2 API가 공존하므로 작업 시 버전 확인 필요
- 환자 데이터는 `patients` (V1) / `patients_v2` (V2) 컬렉션 분리
- CTIBridge는 32비트(win-x86)로 빌드해야 함

---

## 코딩 규칙 (Claude 필수 준수)

### 1. 파일 크기 제한 ⚠️ 중요

- 단일 파일 1,500줄 절대 초과 금지
- 1,000줄 초과 시 모듈 분리 검토 필수
- 2,000줄 이상 파일은 맥락 파악이 어려워 오류 발생률 급증

### 2. SSoT & DRY 원칙

- SSoT(Single Source of Truth): 동일한 데이터/로직은 한 곳에서만 정의
- DRY(Don't Repeat Yourself): 중복 코드 금지
- 수정 작업 시 기존 유틸/컴포넌트 먼저 검색 후 재사용
- 새로 만들기 전 /utils, /hooks, /components 먼저 확인

### 3. 네이밍 컨벤션

모호한 이름 금지. 다음 구조 준수:
`[도메인]-[대상]-[동작/상태]`

| ❌ Bad | ✅ Good |
|--------|---------|
| ConnectButton | CTI-Connection-StatusButton |
| DataTable | Patient-Callback-ListTable |
| Modal | Consultation-Revenue-DetailModal |
| useFetch | usePatientCallbackList |

### 4. 리팩토링 안전장치

- 대규모 수정 전 반드시 .bak 파일 생성 또는 기존 코드 주석 보존
- 기존 로직 삭제 전 동작 확인 완료 필수
- 설계 변경 시 먼저 계획 설명 후 승인받고 진행

### 5. 개발 프로세스

- 메인 페이지/컴포넌트 직접 수정 최소화
- 가능하면 /test 경로에서 먼저 실험
- 검증 완료된 기능만 메인에 이식

### 6. 기존 코드 우선 활용

새 기능 개발 시:
- 프로젝트 내 유사 코드 먼저 검색
- 기존 패턴/구조 파악 후 일관성 유지
- 바퀴 재발명 금지 - 이미 있는 유틸 활용

### 7. 코드 구조화 원칙

컴포넌트 파일 구조:
1. imports
2. types/interfaces
3. constants
4. helper functions
5. component definition
6. exports

### 8. 스파게티 코드 방지

- 코드가 복잡해지면 먼저 "모듈화 설계 문서" 작성
- 복잡한 로직은 분리 전 구조도 먼저 설명
- 하나의 함수는 하나의 책임만 (Single Responsibility)

### 9. 성능 최적화 필수 ⚠️ 중요

현재 운영 중인 시스템이므로 속도 저하 절대 금지

체크리스트:
- [ ] 불필요한 리렌더링 없는지 (useEffect, useCallback, useMemo 의존성 배열 정확히 관리)
- [ ] API 중복 호출 없는지
- [ ] 무한 루프 가능성 없는지
- [ ] 큰 데이터 한번에 로딩하지 않는지 (페이지네이션 또는 가상화 적용)
- [ ] 새 라이브러리 추가 시 번들 사이즈 영향 검토했는지

의심되면 수정 전에 먼저 물어보기

---

## 자주 사용하는 패턴

### API 호출 (V2)
```typescript
// React Query 사용
const { data, isLoading } = useQuery({
  queryKey: ['patients', filters],
  queryFn: () => fetchPatients(filters)
});
```

### Redux 상태 업데이트
```typescript
// slice에서 정의
dispatch(setPatientList(data));
dispatch(updateCallbackStatus({ id, status }));
```

### CTI 이벤트 처리
```typescript
// Pusher 채널 구독
channel.bind('cti-event', handleCTIEvent);
```

---

## 작업 규칙

- 코드 수정 후 항상 `npm run build`로 빌드 확인
- UI 수정 시 브라우저에서 직접 테스트
- 에러 있으면 스스로 고치고 다시 확인
- 수정 후 페이지 로딩 속도, 반응 속도 체감상 느려지지 않았는지 확인

### CTIBridge 자동 커밋 규칙 ⚠️ 필수

**CTIBridge 코드(CTIBridge/ 폴더) 수정 후 빌드 성공하면 반드시 git commit 할 것.**
사용자가 커밋을 요청하지 않아도 자동으로 수행한다.

```bash
# CTIBridge 수정 후 빌드 성공 시 자동 실행
git add CTIBridge/CTIWorker.cs CTIBridge/Program.cs CTIBridge/CTIBridge.csproj
git commit -m "[CTIBridge] 변경 내용 요약"
```

- bin/, obj/, publish/ 폴더는 커밋하지 않음
- 커밋 메시지는 한글로, 변경 내용을 구체적으로 작성

---

## 상용화 로드맵 (Commercialization Roadmap) ⚠️ 필수 숙지

### 배경

- 현재 브랜치: `pre-commercialization-real` (운영 중)
- `main` 브랜치에 Phase 1~5 상용화 작업을 한꺼번에 올렸다가 기능이 전부 망가져서 되돌림
- 분기점: `9c91ba3` (동시착신 수정) 이후 두 브랜치가 분리됨

### main에 있었던 상용화 작업 (이전에 실패한 것들)

1. **Phase 1**: JWT 인증 (40개 파일, 70+ 핸들러), Zod 입력값 검증, 보안 기본 조치, 멀티테넌시 (clinicId)
2. **Phase 2**: Error Boundary, Sentry, Refresh Token, DB 스키마 검증
3. **Phase 3**: Jest 테스트 30개, GitHub Actions CI, Swagger UI, 에러 응답 표준화
4. **Phase 4**: 구조화된 로깅, Rate Limiting, 캐싱, 파이프라인 안정화
5. **Phase 5**: V1 폐기 마킹, 통합 테스트 25개, httpOnly 쿠키 인증, V2 대시보드 리다이렉트

### 진행 원칙 ⚠️ 절대 준수

1. **한 번에 하나씩만** - Phase를 한꺼번에 올리지 말 것. 하나의 기능/변경을 완료하고 운영 검증 후 다음으로
2. **운영 검증 필수** - 각 단계 완료 후 반드시 `npm run build` 성공 + 실제 운영 환경에서 기존 기능 정상 동작 확인
3. **기존 기능 절대 깨뜨리지 않기** - 상용화 작업이 기존 운영 기능(CTI, 통화기록, AI 분석, 채널챗 등)에 영향 주면 즉시 중단
4. **점진적 마이그레이션** - 한 번에 40개 파일 수정 같은 빅뱅 배포 금지. 파일 단위 또는 기능 단위로 쪼개서 진행
5. **롤백 가능하게** - 각 단계마다 독립적으로 커밋. 문제 시 해당 커밋만 되돌릴 수 있도록

### 진행 상태 추적

롤백 태그: `pre-commercialization-checkpoint` (상용화 작업 전 복원 지점)

#### Step 1: Zod 입력값 검증 (리스크: 낮음)
- [x] 핵심 API 6개 적용 (`c7672da`, 2026-03-10)
  - patients POST, cti/incoming-call, cti/call-logs, cti/call-end, cti/outgoing-call, call-analysis/recording
- [x] 핵심 API 추가 7개 적용 (2026-03-12, Vercel 배포 완료)
  - callbacks POST/PATCH, consultations POST/PATCH, channel-chats POST
  - recall-messages POST/PATCH, call-analysis/analyze POST
  - settings PATCH, patients/[id] PATCH
  - 패턴: `safeParse()` → 실패 시 400 + 첫 번째 에러 메시지 반환
- [ ] 나머지 API 적용 (webhooks, call-logs, reports, manuals 등) — 우선순위 낮음, 필요 시 점진적 추가

#### Step 2: 보안 기본 조치 (리스크: 낮음)
- [x] 보안 헤더 추가 (2026-03-12)
  - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
  - HSTS는 Vercel(HTTPS) 환경에서만 적용 (로컬 개발 호환)
- [x] 에러 메시지 노출 차단 (2026-03-12)
  - error.message를 클라이언트에 직접 반환하던 API 11개 → generic 메시지로 교체
  - 대상: coaching, analyze, transcribe, diarize, call-logs PATCH, channel-chats/analyze, recall-messages/send, migration 3개
- [x] CORS 정리 확인 (2026-03-12)
  - 외부 연동(webhooks, channel-chats, widget)만 `*` 허용 — 기존 유지
  - 내부 API는 same-origin 정책으로 보호 (추가 설정 불필요)

#### Step 3: 테스트/CI/모니터링 (리스크: 낮음) ← 순서 변경: 안전망 먼저
- [ ] 핵심 API 테스트 작성
- [ ] CI 파이프라인 구축

#### Step 4: 멀티테넌시 - clinicId (리스크: 중간)
- [ ] DB 쿼리에 clinicId 필터 추가 (한 API씩 점진적 적용)
- ⚠️ 기존 데이터에 clinicId 없을 수 있음 → 마이그레이션 먼저 필요
- ⚠️ Step 3 테스트 완료 후 진행할 것 (장애 리스크 30~40% → 10~15%로 감소)

#### Step 5: 인증 강화 - JWT/쿠키 (리스크: 높음)
- [ ] JWT 인증 미들웨어 (한 라우트씩 점진적 적용)