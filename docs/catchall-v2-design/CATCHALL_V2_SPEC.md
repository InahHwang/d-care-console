# CatchAll v2 설계 명세서

## 프로젝트 개요

치과 상담 관리 SaaS 플랫폼. 아웃바운드 마케팅 중심의 환자 상담 관리 시스템에 CTI 연동 및 AI 자동화 기능을 추가한 버전.

### 핵심 차별점
- **CTI 연동**: SK브로드밴드 API 연동으로 발신/수신 자동 기록
- **AI 자동 분석**: 통화 종료 후 STT + AI가 자동으로 환자 정보 추출 및 등록
- **퍼널 기반 환자 관리**: 전화상담 → 내원예약 → 내원완료 → 치료중 → 치료완료 → 사후관리

### 기술 스택
- Frontend: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- Backend: Next.js API Routes
- Database: MongoDB Atlas
- 인증: 기존 인증 시스템 유지
- CTI: SK브로드밴드 OpenAPI
- AI: OpenAI Whisper (STT) + Claude Haiku 또는 GPT-4o-mini (분석)

---

## ⚡ 성능 최적화 요구사항 (최우선)

기존 시스템이 느려서 사용자 불만이 많았음. 설계 단계부터 속도 최적화 필수.

### 1. 데이터베이스 최적화
```
- 인덱스 설계 필수
  - patients: phone, status, createdAt, clinicId
  - callLogs: phone, createdAt, clinicId, aiStatus
  - callbacks: scheduledAt, status, clinicId
  
- 쿼리 최적화
  - 목록 조회 시 필요한 필드만 projection
  - 페이지네이션 필수 (한 번에 최대 50건)
  - aggregation pipeline 사용 시 $match를 최대한 앞에
  
- 연결 풀링
  - MongoDB 연결 풀 재사용 (global connection)
```

### 2. 프론트엔드 최적화
```
- React Server Components 적극 활용
- 클라이언트 컴포넌트 최소화
- 동적 import로 코드 스플리팅
- 이미지 최적화 (next/image)
- 목록 가상화 (react-window) - 환자 목록, 통화 기록 등
- debounce 적용 - 검색, 필터
- SWR 또는 React Query로 캐싱 + 낙관적 업데이트
```

### 3. API 최적화
```
- API 응답 시간 목표: 200ms 이내
- 무거운 작업은 백그라운드 처리 (AI 분석 등)
- 적절한 캐싱 전략
  - 정적 데이터: CDN 캐싱
  - 사용자 데이터: SWR revalidation
- Edge Functions 활용 검토
```

### 4. AI 분석 비동기 처리
```
- 통화 종료 → 즉시 DB 저장 → 사용자에게 응답
- AI 분석은 백그라운드에서 15~25초 후 완료
- 분석 완료 시 실시간 알림 (폴링 또는 WebSocket)
- 분석 대기열 관리 (BullMQ + Redis 고려)
```

### 5. 로딩 UX
```
- 스켈레톤 UI 적용
- 점진적 로딩 (중요 데이터 먼저)
- 낙관적 업데이트 (버튼 클릭 즉시 UI 반영)
```

---

## 메뉴 구조

```
📊 대시보드        - 오늘 요약 + 주의 필요 알림
📞 통화 기록       - 전체 수발신 로그 (AI 분석 포함)
👥 환자 관리       - 등록된 환자 (퍼널 상태별)
🔔 일정 관리       - 콜백 + 리콜 + 감사인사
🎁 소개 관리       - 소개자/피소개자 연결
📈 리포트         - 일별 (상담내역) / 월별 (통계+피드백)
⚙️ 설정           - 치과 설정, 리콜 주기 등
```

---

## 페이지별 상세 설계

### 1. 대시보드 (`/dashboard`)

#### 오늘 통계 카드 (4열)
- 총 통화: 발신/수신 구분
- 신규 환자: AI 자동 등록된 환자 수
- 오늘 콜백: 예정/완료
- 부재중: 재시도 필요

#### 주의 필요 카드 ⚠️
```
- 내원완료 7일+ : 3명 (치료 미결정 환자)
- 전화상담 14일+ : 2명 (장기 미진행)
- 내원예약 노쇼 위험 : 1명
→ 클릭 시 해당 환자 목록으로 이동
```

#### AI 분석 현황
- 분석 완료 / 분석 중 / 대기열
- 진행률 바

#### 오늘의 콜백
- 시간순 리스트
- 관심도 아이콘 (🔥/🌡️/❄️)
- 바로 전화 버튼

#### 최근 등록 환자
- AI 자동 등록된 환자 목록

---

### 2. 통화 기록 (`/call-logs`)

#### 데이터 플로우
```
통화 발생 (CTI)
    ↓
즉시 DB 저장 (callLogs 컬렉션)
    ↓
[백그라운드 15~25초] STT + AI 분석
    ↓
분류 결과에 따라:
├─ 신규환자 → patients에 자동 등록
├─ 기존환자 → 해당 환자 타임라인에 추가
├─ 부재중 → 통화 기록에만 (재시도 표시)
├─ 거래처 → 통화 기록에만 (태그)
└─ 스팸 → 통화 기록에만 (태그)
```

#### 테이블 구조
| 유형 | 번호/이름 | 시간 | 통화시간 | AI분류 | 관심도 | AI요약 | 상태 |

#### 필터 탭
전체 / 신규환자 / 기존환자 / 콜백필요 / 부재중 / 거래처

#### 우측 상세 패널 (행 클릭 시)
- 통화 정보 + 녹취 재생
- AI 분석 결과 상세 (신뢰도 % 포함)
- 액션 버튼: 환자 상세 / 환자로 등록 / 다시 전화 / 콜백 예약 / 태그

#### AI 추출 정보 스키마
```typescript
interface AIAnalysis {
  classification: '신규환자' | '기존환자' | '거래처' | '스팸' | '부재중';
  patientName?: string;
  interest?: string;           // 관심시술
  interestDetail?: string;     // 세부 (예: 앞니)
  temperature: 'hot' | 'warm' | 'cold';
  summary: string;             // AI 요약
  followUp: '콜백필요' | '예약확정' | '종결';
  recommendedCallback?: Date;
  concerns: string[];          // 관심사 태그
  preferredTime?: string;      // 선호 시간
  confidence: number;          // 신뢰도 0-100
}
```

---

### 3. 환자 관리 (`/patients`)

#### 상태 필터 버튼
```
[전체 156] [전화상담 23] [내원예약 15] [내원완료 12] [치료중 34] [치료완료 45] [사후관리 27]
```

#### 테이블 구조
| 환자명 | 전화번호 | 관심시술 | 상태 | 관심도 | 체류일 | 다음액션 | 액션 |

- 체류일: 현재 상태에서 며칠째인지 (병목 파악용)
- 검색: 이름, 전화번호
- 페이지네이션 필수

#### 환자 상태 정의
```typescript
type PatientStatus = 
  | 'consulting'  // 전화상담
  | 'reserved'    // 내원예약
  | 'visited'     // 내원완료
  | 'treatment'   // 치료중
  | 'completed'   // 치료완료
  | 'followup';   // 사후관리
```

---

### 4. 환자 상세 (`/patients/[id]`)

#### 좌측 패널
- AI 자동 등록 뱃지 (신뢰도 %)
- 관심도 온도 (🔥/🌡️/❄️)
- 기본 정보: 이름, 전화번호, 연령, 지역
- AI 추출 정보: 관심시술, 선호시간, 내원희망, 주요 관심사 태그
- 유입경로
- 콜백 예약 카드
- 상태 변경 버튼

#### 우측 타임라인
- AI 자동 등록 이벤트
- 통화 이벤트 (발신/수신 구분, AI 요약, 녹취 재생)
- 상태 변경 이벤트
- 콜백 예약 이벤트
- 메모 이벤트

---

### 5. 일정 관리 (`/schedules`)

#### 탭 구분
- 콜백: 상담 팔로업
- 리콜: 사후관리 (치료 완료 후)
- 감사인사: 소개 환자 발생 시

#### 리콜 설정 (치료별 주기)
```
스케일링: 6개월
임플란트: 3개월, 6개월, 1년
교정: 1년 (유지장치)
일반치료: 6개월~1년
→ 원장님이 설정에서 커스터마이징
```

#### 리콜 자동 생성
치료완료 상태로 변경 시 → 해당 치료의 리콜 주기에 따라 자동 생성

---

### 6. 소개 관리 (`/referrals`)

#### 소개자 ↔ 피소개자 연결
- 환자 등록 시 유입경로 = "소개" 선택
- 소개자 선택 (기존 환자 중)

#### 소개왕 리스트
```
1. 한소희 - 5명 소개
2. 김미영 - 3명 소개
3. 박서연 - 2명 소개
```

#### 감사인사 알림
- 신규 소개 발생 시 → 감사인사 대기 목록에 추가
- 상담사: 문자 발송
- 원장님: 원내에서 직접

---

### 7. 리포트

#### 일별 리포트 (`/reports/daily`)
**원장님이 보고 싶은 것: "오늘 누가 왔고, 뭐 상담했고, 동의했나, 얼마 매출이냐"**

##### 요약 카드
- 총 상담 / 전환율
- 상담 결과 (동의/미동의/보류 + 비율 바)
- 예상 매출
- 할인 금액

##### 환자 목록 (좌측)
- 필터: 전체 / 미동의 / 보류 / 동의
- 미동의/보류 우선 정렬
- 미동의 사유 태그 표시

##### 환자 상세 (우측)
- 기본 정보 + 금액 (할인 적용 시 표시)
- AI 통화 요약
- 상담사 메모
- 미동의 사유 + 시정 계획
- 예약 정보 또는 콜백 예정

##### 미동의 사유 카테고리
```
💰 가격/비용: 예산 초과, 타 병원 대비 비쌈, 분납 조건 안 맞음, 당장 여유 안 됨
🦷 치료 계획: 치료 계획 이견, 제안 치료 거부, 치료 범위 과다, 치료 기간 부담
⏳ 결정 보류: 가족 상의 필요, 타 병원 비교 중, 추가 상담 필요, 단순 정보 문의
📋 기타: 일정 조율 어려움, 치료 두려움, 기타
```

---

#### 월별 리포트 (`/reports/monthly`)
**통계 + 분석 + 피드백**

##### 매출 현황 분석
- 목표 매출 / 실제 매출 / 달성률 / 전월 대비
- 항목별 매출 (임플란트, 교정, 보철, 일반진료) + 달성률 바

##### 상담 분석
- 유형별 분류: 아웃바운드 / 인바운드 / 구환 / 소개
- 총 상담 / 연결 성공 / 신규 환자 / 전환율
- 퍼널 분석: 전화상담 → 내원예약 → 내원완료 → 치료동의 → 치료완료
- 이탈 분석: 단계별 이탈 수 + 이유 비율

##### 환자 통계
- 연령대별 분포 (막대 그래프)
- 지역별 분포 (막대 그래프)
- 내원경로별 분포 + 전환율

##### 월간 피드백 (원장님 ↔ 실무자 소통)
```
┌─────────────────────────────────────────────────────┐
│ 1. 전화 상담 후 미내원하신 환자들의 원인은?          │
├─────────────────────────────────────────────────────┤
│ 👤 박상담 (2024.01.28)                              │
│ 이번 달 미내원 환자 대부분이 가격 비교를 위해...    │
├─────────────────────────────────────────────────────┤
│ 💬 원장님 피드백                    [+ 피드백 추가] │
│ ✓ 원장님 (2024.01.29)                              │
│ 가격 경쟁력 부분은 검토해보겠습니다...             │
│                                                     │
│ [피드백 입력...]                          [전송]   │
└─────────────────────────────────────────────────────┘
```

피드백 질문 항목:
1. 전화 상담 후 미내원하신 환자들의 원인은?
2. 내원 후 치료에 동의하지 않으신 환자분의 원인은?
3. 환자들의 내원, 치료 동의를 이끌어 내기 위해 어떤 부분에서 개선이 필요할까요?
4. 이번 달 특이사항이나 건의사항

---

## 데이터베이스 스키마

### patients (환자)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  name: string,
  phone: string,              // 인덱스
  gender?: '남' | '여',
  age?: number,
  region?: string,            // 지역
  status: PatientStatus,      // 인덱스
  statusChangedAt: Date,      // 체류일 계산용
  temperature: 'hot' | 'warm' | 'cold',
  interest?: string,          // 관심시술
  interestDetail?: string,
  source: string,             // 유입경로
  referrerId?: ObjectId,      // 소개자 (있으면)
  aiRegistered: boolean,      // AI 자동 등록 여부
  aiConfidence?: number,      // AI 신뢰도
  nextAction?: string,
  nextActionDate?: Date,
  createdAt: Date,            // 인덱스
  updatedAt: Date,
}
```

### callLogs (통화 기록)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  phone: string,              // 인덱스
  patientId?: ObjectId,       // 연결된 환자 (있으면)
  direction: 'inbound' | 'outbound',
  status: 'connected' | 'missed' | 'busy',
  duration: number,           // 초
  recordingUrl?: string,
  startedAt: Date,
  endedAt: Date,
  
  // AI 분석
  aiStatus: 'pending' | 'processing' | 'completed' | 'failed',
  aiAnalysis?: {
    classification: string,
    patientName?: string,
    interest?: string,
    temperature: string,
    summary: string,
    followUp: string,
    recommendedCallback?: Date,
    concerns: string[],
    confidence: number,
    transcript?: string,      // STT 결과
  },
  aiCompletedAt?: Date,
  
  createdAt: Date,            // 인덱스
}
```

### callbacks (콜백/리콜)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  patientId: ObjectId,
  type: 'callback' | 'recall' | 'thanks',
  scheduledAt: Date,          // 인덱스
  status: 'pending' | 'completed' | 'missed',
  note?: string,
  completedAt?: Date,
  createdAt: Date,
}
```

### referrals (소개)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  referrerId: ObjectId,       // 소개자
  referredId: ObjectId,       // 피소개자
  thanksSent: boolean,
  thanksSentAt?: Date,
  createdAt: Date,
}
```

### consultations (상담 기록 - 일별 리포트용)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  patientId: ObjectId,
  callLogId?: ObjectId,
  date: Date,                 // 상담일
  
  treatment: string,          // 상담 시술
  originalAmount: number,     // 정가
  discountRate: number,       // 할인율
  discountAmount: number,     // 할인 금액
  finalAmount: number,        // 최종 금액
  discountReason?: string,    // 할인 사유
  
  status: 'agreed' | 'disagreed' | 'pending',
  disagreeReasons?: string[],
  correctionPlan?: string,    // 시정 계획
  
  appointmentDate?: Date,     // 예약일 (동의 시)
  callbackDate?: Date,        // 콜백 예정 (보류 시)
  
  consultantId: ObjectId,
  consultantName: string,
  inquiry?: string,           // 상담 내용
  memo?: string,              // 상담사 메모
  aiSummary?: string,         // AI 요약
  
  createdAt: Date,
}
```

### feedbacks (월간 피드백)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  yearMonth: string,          // "2024-01"
  questionId: number,
  question: string,
  
  managerAnswer?: string,
  managerName?: string,
  managerAnsweredAt?: Date,
  
  comments: [{
    author: string,
    content: string,
    createdAt: Date,
  }],
  
  createdAt: Date,
  updatedAt: Date,
}
```

---

## CTI 연동 (SK브로드밴드)

### 이벤트 처리
```
발신 시작: IMS_SVC_ORIGCAL_START_NOTI
발신 종료: IMS_SVC_ORIGCAL_END_NOTI
수신 시작: IMS_SVC_INCOM_START_NOTI
수신 종료: IMS_SVC_INCOM_END_NOTI
```

### 통화 종료 시 플로우
```
1. CTI 이벤트 수신
2. callLogs에 즉시 저장 (aiStatus: 'pending')
3. 응답 반환 (사용자 대기 없음)
4. 백그라운드 작업 트리거
   - 녹취 파일 다운로드
   - STT (Whisper) - 10~20초
   - AI 분석 (Haiku) - 1~5초
   - 결과 저장 + 필요 시 환자 자동 등록
5. 프론트엔드에서 폴링 또는 WebSocket으로 상태 업데이트
```

---

## AI 분석 프롬프트 (참고)

```
당신은 치과 상담 전화를 분석하는 AI입니다.
아래 통화 녹취록을 분석하여 JSON 형식으로 응답하세요.

분석 항목:
1. 분류: 신규환자 | 기존환자 | 거래처 | 스팸 | 부재중
2. 환자명 (언급된 경우)
3. 관심시술
4. 관심도: hot(적극적) | warm(관심있음) | cold(정보만)
5. 요약 (1-2문장)
6. 후속조치: 콜백필요 | 예약확정 | 종결
7. 추천 콜백 일시 (있으면)
8. 관심사 태그 (가격, 통증, 기간 등)
9. 신뢰도 (0-100)

녹취록:
{transcript}
```

---

## 폴더 구조 제안

```
/app
  /(current)              # 기존 운영 (교체 전까지 유지)
  /(v2)                   # 새 버전
    /dashboard
    /call-logs
    /patients
      /[id]
    /schedules
    /referrals
    /reports
      /daily
      /monthly
    /settings

/components
  /v2
    /ui                   # 공통 UI (Button, Card, Table 등)
    /dashboard
    /call-logs
    /patients
    /schedules
    /referrals
    /reports

/lib
  /db                     # MongoDB 연결 및 쿼리
  /cti                    # SK브로드밴드 API
  /ai                     # STT + AI 분석
  /utils

/types                    # TypeScript 타입 정의
```

---

## 개발 순서 제안

### Phase 1: 기반 구축
1. 폴더 구조 생성
2. DB 스키마 및 인덱스 설정
3. 공통 컴포넌트 (테이블, 카드, 필터 등)
4. 레이아웃 (사이드바)

### Phase 2: 핵심 기능
5. 대시보드
6. 환자 관리 (목록 + 상세)
7. 통화 기록 (CTI 연동 제외, UI만)

### Phase 3: CTI + AI
8. CTI 연동 (SK브로드밴드 API)
9. AI 분석 파이프라인 (STT + 분석)
10. 자동 환자 등록 로직

### Phase 4: 부가 기능
11. 일정 관리 (콜백 + 리콜)
12. 소개 관리
13. 리포트 (일별 + 월별)

### Phase 5: 마무리
14. 성능 최적화 검증
15. 기존 데이터 마이그레이션
16. 테스트 및 버그 수정
17. 라우트 교체 (v2 → 메인)

---

## 체크리스트

### 성능
- [ ] 모든 목록 페이지 페이지네이션 적용
- [ ] 검색/필터 debounce 적용
- [ ] 스켈레톤 로딩 UI
- [ ] API 응답 200ms 이내 확인
- [ ] DB 인덱스 적용 확인
- [ ] AI 분석 백그라운드 처리 확인

### 기능
- [ ] CTI 발신/수신 자동 기록
- [ ] AI 자동 분석 및 분류
- [ ] 신규환자 자동 등록
- [ ] 환자 상태 퍼널 관리
- [ ] 콜백/리콜 알림
- [ ] 소개 관리
- [ ] 일별/월별 리포트
- [ ] 피드백 기능

---

## 참고 UI 파일

설계 시 참고할 수 있는 React 컴포넌트 파일들:
- dashboard-with-ai.jsx (대시보드)
- call-log-with-ai.jsx (통화 기록)
- patient-management-simple.jsx (환자 관리)
- patient-detail-with-ai.jsx (환자 상세)
- report-daily-detail.jsx (일별 리포트)
- report-monthly-feedback.jsx (월별 리포트)

이 파일들은 UI 참고용이며, 실제 구현 시 TypeScript + 실제 API 연동으로 재작성 필요.
