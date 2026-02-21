# 일정 관리 페이지 구현 명령

일정 관리 페이지(/schedules)를 구현해줘.

## 참고 UI 파일
schedule-management-v2.jsx 파일을 참고해서 구현해.

---

## 페이지 구조

### 상단 요약 카드 (3개)
```
[오늘 콜백 5건]     [오늘 리콜 5건]      [감사인사 3건]
 대기3 완료1 미연결1  발송대기3 전화필요2   대기2 완료1
```

### 메인 탭 (3개)
```
[📞 콜백 12] [🔄 리콜 28] [🎁 감사인사 3]
```

---

## 콜백 탭

### 필터
- 상태: 전체 / 대기 / 완료 / 미연결
- 날짜 네비게이션: ◀ 2024년 1월 15일 ▶
- 검색: 환자명, 전화번호

### 목록 아이템
```
┌─────────────────────────────────────────────────────┐
│ 10:00  │  김미영 🔥 [대기]              [전화] [완료] │
│ 01-15  │  010-1234-5678                             │
│        │  [임플란트] 임플란트 상담 후 가격 검토 중     │
│        │  💬 분납 조건 다시 안내 필요                 │
└─────────────────────────────────────────────────────┘
```

포함 정보:
- 예정 시간 + 날짜
- 환자명 + 관심도(🔥/🌡️/❄️) + 상태 뱃지
- 전화번호
- 관심시술 태그 + 콜백 사유
- 메모 (있으면)

액션 버튼:
- 대기: [전화] [완료]
- 미연결: [재시도]
- 완료: 완료 시간 표시

---

## 리콜 탭 (자동 발송 시스템)

### 서브탭 (4개)
```
[발송 설정] [발송 대기 5] [발송 이력] [전화 필요 3]
```

### 1. 발송 설정

치료별 자동 발송 시점/메시지 설정

```
치료별 자동 발송 설정                    [+ 치료 추가]

┌─────────────────────────────────────────────────┐
│ 스케일링                                    [⋮] │
├─────────────────────────────────────────────────┤
│ [토글] 6개월 후                                 │
│        "정기 스케일링 시기입니다..."    [✏️] [🗑️] │
│                                                │
│ + 발송 시점 추가                                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 임플란트                                   [⋮] │
├─────────────────────────────────────────────────┤
│ [토글] 1주 후   "수술 부위 불편하신 점..."       │
│ [토글] 1개월 후 "임플란트 정기 점검..."         │
│ [토글] 6개월 후 "임플란트 정기 점검..."         │
│                                                │
│ + 발송 시점 추가                                │
└─────────────────────────────────────────────────┘
```

기능:
- 치료 종류 추가/삭제
- 발송 시점 추가/수정/삭제
- 토글로 활성화/비활성화
- 메시지 템플릿 편집

### 2. 발송 대기

오늘/내일 발송 예정 목록

```
⏰ 오늘 발송 예정 2건

┌─────────────────────────────────────────────────┐
│ 📤 한소희 [스케일링 6개월]                       │
│    010-1111-2222                               │
│    마지막 방문: 2023-07-15 · 발송 예정: 오늘 10:00│
│                           [즉시 발송] [취소]    │
└─────────────────────────────────────────────────┘
```

액션:
- [즉시 발송]: 바로 알림톡 발송
- [취소]: 이번 발송 건너뛰기

### 3. 발송 이력

발송 완료된 내역 + 결과

```
[전체] [예약완료] [미응답]  ← 필터

┌─────────────────────────────────────────────────┐
│ ✅ 유재석 [스케일링 6개월] [예약완료]            │
│    010-6666-7777                               │
│    발송: 2024-01-10 → 2024-01-15 14:00 예약     │
├─────────────────────────────────────────────────┤
│ ❌ 현빈 [임플란트 1개월] [미응답]                │
│    010-4444-5555                               │
│    발송: 2024-01-08 → 5일 경과        [전화하기] │
└─────────────────────────────────────────────────┘
```

상태:
- 예약완료: 알림톡 발송 후 예약 잡힌 경우
- 미응답: 발송 후 3일 지나도 예약 없는 경우

### 4. 전화 필요 (미응답)

알림톡 발송 후 3일 내 예약 없는 환자

```
⚠️ 알림톡 발송 후 3일 내 예약이 없는 환자입니다.

┌─────────────────────────────────────────────────┐
│ 📞 현빈 [임플란트 1개월] [5일 경과]              │
│    010-4444-5555                               │
│    발송일: 2024-01-08             [전화] [완료]  │
└─────────────────────────────────────────────────┘
```

액션:
- [전화]: 전화 걸기
- [완료]: 처리 완료 (예약 잡힘 or 연락됨)

---

## 감사인사 탭

### 필터
- 상태: 전체 / 대기 / 완료
- 검색: 환자명, 전화번호

### 목록 아이템
```
┌─────────────────────────────────────────────────┐
│  ❤️  │  김미영님이 이수진님을 소개해주셨어요 [대기] │
│      │  소개자: 010-1234-5678                     │
│      │  피소개자: 010-9999-8888                   │
│      │  소개일: 2024-01-14                        │
│      │  💬 단골 환자 - 정성껏 감사 표현            │
│      │                      [전화] [문자] [완료]  │
└─────────────────────────────────────────────────┘
```

액션:
- [전화]: 소개자에게 감사 전화
- [문자]: 감사 문자 발송
- [완료]: 처리 완료

---

## 하단: 이번 주 요약

```
이번 주 일정 요약

월(13) 화(14) 수(15) 목(16) 금(17) 토(18) 일(19)
 ●●●    ●●    [●●●]   ●      ●
                오늘

● 콜백  ● 리콜  ● 감사인사
```

---

## DB 스키마

### callbacks 컬렉션 (콜백)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  patientId: ObjectId,
  
  scheduledAt: Date,          // 콜백 예정 시간
  status: 'pending' | 'completed' | 'missed',
  
  reason: string,             // 콜백 사유
  interest: string,           // 관심 시술
  temperature: 'hot' | 'warm' | 'cold',
  note?: string,
  
  consultantId: ObjectId,     // 담당 상담사
  completedAt?: Date,
  createdAt: Date
}
```

### recall_settings 컬렉션 (리콜 발송 설정)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  
  treatment: string,          // 치료 종류 (스케일링, 임플란트 등)
  schedules: [
    {
      timing: string,         // "1주 후", "1개월 후", "6개월 후" 등
      timingDays: number,     // 일수로 환산 (7, 30, 180 등)
      message: string,        // 알림톡 메시지
      enabled: boolean
    }
  ],
  
  createdAt: Date,
  updatedAt: Date
}
```

### recall_messages 컬렉션 (리콜 발송 내역)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  patientId: ObjectId,
  
  treatment: string,
  timing: string,
  message: string,
  
  status: 'pending' | 'sent' | 'booked' | 'no-response' | 'call-needed',
  // pending: 발송 대기
  // sent: 발송 완료 (아직 결과 모름)
  // booked: 예약 완료
  // no-response: 미응답 (3일 경과)
  // call-needed: 전화 필요로 이동됨
  
  scheduledAt: Date,          // 발송 예정 시간
  sentAt?: Date,              // 실제 발송 시간
  bookedAt?: Date,            // 예약 완료 시간
  completedAt?: Date,         // 처리 완료 시간
  
  lastVisit: Date,            // 마지막 방문일
  createdAt: Date
}
```

### thanks 컬렉션 (감사인사)
```typescript
{
  _id: ObjectId,
  clinicId: ObjectId,
  
  referrerId: ObjectId,       // 소개자 환자 ID
  referredId: ObjectId,       // 피소개자 환자 ID
  
  status: 'pending' | 'completed',
  note?: string,
  
  referredAt: Date,           // 소개 발생일
  completedAt?: Date,
  createdAt: Date
}
```

---

## API 엔드포인트

### 콜백
```
GET    /api/v2/callbacks?date=2024-01-15&status=pending
POST   /api/v2/callbacks
PATCH  /api/v2/callbacks/:id/complete
PATCH  /api/v2/callbacks/:id/missed
```

### 리콜 설정
```
GET    /api/v2/recall-settings
POST   /api/v2/recall-settings
PUT    /api/v2/recall-settings/:id
DELETE /api/v2/recall-settings/:id
```

### 리콜 발송
```
GET    /api/v2/recall-messages?status=pending
POST   /api/v2/recall-messages/:id/send     // 즉시 발송
POST   /api/v2/recall-messages/:id/cancel   // 취소
PATCH  /api/v2/recall-messages/:id/complete // 전화 완료
```

### 감사인사
```
GET    /api/v2/thanks?status=pending
POST   /api/v2/thanks
PATCH  /api/v2/thanks/:id/complete
```

### Cron Job
```
/api/cron/send-recall-messages  // 매일 10:00 실행
/api/cron/check-no-response     // 매일 실행 (3일 경과 체크)
```

---

## 자동화 로직

### 1. 리콜 메시지 자동 생성
```
환자 상태가 "치료완료"로 변경될 때:
1. 해당 치료의 recall_settings 조회
2. 활성화된 발송 시점마다 recall_messages 생성
3. scheduledAt = 치료완료일 + timingDays
```

### 2. 알림톡 자동 발송 (Cron)
```
매일 10:00:
1. status='pending' & scheduledAt <= 오늘인 메시지 조회
2. 알림톡 API 호출 (일단 Mock)
3. status를 'sent'로 변경, sentAt 기록
```

### 3. 미응답 체크 (Cron)
```
매일 실행:
1. status='sent' & sentAt <= 3일 전인 메시지 조회
2. 해당 환자의 예약 여부 확인
3. 예약 있으면 → status='booked'
4. 예약 없으면 → status='no-response' → 'call-needed'
```

---

## 요구사항

### 성능
- API 응답 200ms 이내
- 목록 페이지네이션 (최대 50건)
- 검색/필터 debounce (300ms)

### 기술
- TypeScript로 구현
- 알림톡 API는 Mock으로 (나중에 실제 연동)
- Vercel Cron 사용

### 인덱스
```
callbacks: { clinicId, scheduledAt, status }
recall_settings: { clinicId, treatment }
recall_messages: { clinicId, status, scheduledAt }
thanks: { clinicId, status, referredAt }
```
