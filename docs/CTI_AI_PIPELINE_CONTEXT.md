# CTI + AI 분석 파이프라인 컨텍스트 문서

> 최종 수정: 2026-02-14. 녹취/AI요약 실패 디버깅 시 이 문서를 참조하세요.

## 1. 시스템 구조 (V2 리팩토링 후)

```
[CTIBridge (.NET)] ─→ [Next.js API (V2 전용)] ─→ [MongoDB]
                                                      ↓
                                                 [STT + AI 분석]
```

### CTIBridge → 서버 엔드포인트 매핑

| CTIBridge 함수 | 서버 엔드포인트 | 역할 |
|---|---|---|
| `DoSendIncomingCall` | `/api/v2/cti/incoming-call` | 수신 전화 CID → callLog 생성 |
| `DoSendOutgoingCall` | `/api/v2/cti/outgoing-call` | 발신(ClickCall) 시작 → callLog 생성, callLogId 반환 |
| `DoSendCallLog` | `/api/v2/cti/call-logs` | 통화 상태 업데이트 (start/end/missed/outbound_end 등) |
| `DoSendRecording` | `/api/v2/call-analysis/recording` | 녹취 데이터 + AI 파이프라인 트리거 |

### AI 분석 파이프라인

```
녹취 수신 (/api/v2/call-analysis/recording)
  ├── callLog 찾기 (callLogId 직접매칭 → 전화번호 fallback)
  ├── status='connected', aiStatus='pending' 으로 업데이트
  ├── base64 녹음 데이터 → callRecordings_v2 저장
  └── waitUntil() 백그라운드 파이프라인:
      ├── STT (/api/v2/call-analysis/transcribe) → Whisper API → transcript 저장
      │   └── maxDuration: 120초
      │   └── 환각 방지: 50KB 미만 또는 5초 미만 → skipped
      └── AI 분석 (/api/v2/call-analysis/analyze) → GPT-4o-mini → aiAnalysis 저장
          └── maxDuration: 60초
```

## 2. 수신(Inbound) 통화 플로우

```
1. SK broadband CTI → EVT_RINGING → CTIBridge
   → DoSendIncomingCall → /api/v2/cti/incoming-call
   → callLogs_v2 생성 (status='ringing', 날짜=Date 객체)  ← 2026-02-13 수정

2. 상담사가 수화기 들음 → EVT_CONNECT → CTIBridge
   → DoSendCallLog(start) → /api/v2/cti/call-logs
   → callLogs_v2 업데이트 (status='connected', startedAt=실제 연결시간)  ← 2026-02-13 수정

3. 통화 종료 → EVT_DISCONNECT → CTIBridge
   → DoSendCallLog(end, duration=N초) → /api/v2/cti/call-logs  ← CTIBridge도 duration 계산
   → callLogs_v2 업데이트 (duration 기록)

4. 녹취 완료 → CTIBridge
   → DoSendRecording → /api/v2/call-analysis/recording
   → base64 저장 + STT → AI 분석 파이프라인
```

### 수신 녹취 실패 원인 (SK broadband)
- **Svc=8 (IPPBX)**: `EVT_READY_SERVICE`를 보내지 않아 녹취 시작 불가 (0x800D 에러)
- **해결**: SK broadband에 Svc=8 녹취 지원 문의 필요
- **발생 비율**: 인바운드 통화의 70-80%가 Svc=8 (코드 수정으로 해결 불가)

## 3. 발신(Outbound/ClickCall) 통화 플로우

```
1. 브라우저에서 "전화걸기" 클릭 → CTIBridge HTTP 서버 (5080)
   → IMS_ClickCall_Start() → DoSendOutgoingCall → /api/v2/cti/outgoing-call
   → callLogs_v2 생성 (direction='outbound', status='ringing')
   → callLogId를 CTIBridge에 반환 → _clickCallLogId에 저장

2. 환자가 전화 받음 → EVT 이벤트 → CTIBridge
   → 자동 녹취 시작 (IMS_ClickCall_StartRecord)
   → DoSendCallLog(start) → /api/v2/cti/call-logs
   → status='connected'

3. 통화 종료 → EVT_STOP_SERVICE → CTIBridge
   → ExtInfo 분석:
     - success + recfile → endReason = "outbound_end" (★ 정상 통화)
     - noanswer → "no_answer"
     - busy → "busy"
     - cancel → "cancelled"
     - 그 외 → "service_stopped" (부재중 처리)

   → HandleClickCallEnd:
     a) DoSendCallLog(endReason) → /api/v2/cti/call-logs
        - outbound_end → status='connected', duration=X
        - no_answer/service_stopped/busy → status='missed', aiStatus='completed'
     b) 녹취 URL 있으면 → DoSendRecording → /api/v2/call-analysis/recording
        - callLogId 포함 (정확한 매칭)
        - base64 저장 + AI 파이프라인 트리거
```

## 4. 이전에 발생했던 버그들과 수정 내역

### 버그 1: 발신 AI 요약이 항상 "부재중"으로 표시 (2026-02-12 수정)

**원인**: CTIBridge가 모든 ClickCall 종료를 `service_stopped`로 보냄.
서버측 `/api/call-logs`에서 `service_stopped`를 `isMissedCall=true`로 분류.
→ V2 callLog가 `aiStatus='completed'`, `aiAnalysis={부재중}`로 덮어씀.
→ 나중에 Recording 이벤트가 도착해도 이미 completed 상태라 파이프라인 미실행.

**수정**:
1. CTIBridge: `EVT_STOP_SERVICE`에서 ExtInfo에 `success+recfile`이면 `outbound_end`로 분류
2. V2 전용 엔드포인트 분리 (V1 제거): 각 엔드포인트가 단일 책임
3. Recording 엔드포인트에서 `status='connected'`로 강제 변경 (안전장치)

### 버그 2: ClickCall callLogId 레이스컨디션 (이전 수정 완료)

**원인**: CTIBridge가 여러 이벤트를 비동기 큐로 처리. `_clickCallLogId`가 Recording 이벤트 전송 전에 리셋됨.
**수정**: `HandleClickCallEnd`에서 큐에 넣기 전에 `CallLogId` 필드에 저장 (이벤트 객체에 바인딩).

### 버그 3: ClickCall 타임아웃 3분 → 1시간 (이전 수정 완료)

**원인**: `CLICKCALL_TIMEOUT_SEC = 180` (3분). 3분 넘는 통화는 CTIBridge가 강제 종료.
**수정**: `CLICKCALL_TIMEOUT_SEC = 3600` (1시간).

### 버그 4: 착신 컬럼이 "-"로 표시 (2026-02-13 수정)

**증상**: V2 리팩토링 후 통화기록 페이지에서 착신번호(031/070)가 전부 "-"로 표시.

**원인**: V2 전용 엔드포인트 분리 시 `calledNumber` 필드를 DB에 저장하지 않음.
- `incoming-call`: callLog 생성 시 `calledNumber` 필드 누락
- `outgoing-call`: `calledNumber`에 환자 번호를 넣어야 하는데 치과 회선번호를 안 넣음

**수정**:
1. `incoming-call/route.ts`: `calledNumber: calledNumber || ''` 추가
2. `outgoing-call/route.ts`: `calledNumber: callerNumber || ''` (치과 회선번호) 저장
3. `types/v2/index.ts`: `CallLogV2` 인터페이스에 `calledNumber` 필드 추가

### 버그 5: 수신 통화시간이 전부 2초로 기록 (2026-02-13 수정)

**증상**: 2/13 수신 통화 7건의 통화시간이 실제 19~237초인데 모두 2초로 표시.

**근본 원인**: 3가지 버그가 연쇄 발생.

```
[버그 A] incoming-call이 날짜를 String으로 저장
  → new Date().toISOString() = "2026-02-13T05:00:00Z" (문자열)
  → 이후 MongoDB 쿼리에서 new Date()와 비교 시 BSON 타입 불일치
  → String < Date (BSON 순서) → $gte 비교 항상 실패 → 검색 불가

[버그 B] incoming-call이 status='connected'로 생성
  → "start" 이벤트가 status='ringing'을 찾으므로 매칭 실패 → no-op
  → startedAt이 실제 통화 연결 시간으로 갱신되지 않음

[버그 C] CTIBridge가 수신 end 이벤트에 Duration=0 전송
  → 서버 fallback 계산에 의존해야 하는데, 검색 실패로 엉뚱한 callLog 매칭
```

**연쇄 실패 플로우**:
```
1. incoming-call → callLog1 생성 (status=connected, 날짜=STRING, duration=0)
2. "start" → ringing 검색 → 못 찾음 → NO-OP
3. Recording → callLog1 검색 → STRING/Date 불일치로 못 찾음
   → callLog2 새로 생성 (duration=76초, startedAt=녹취종료시점)
4. "end" → callLog2 발견 (Date 타입이라 검색됨)
   → CTIBridge duration=0 → fallback: now(14:01:19) - startedAt(14:01:17) = 2초!
5. UI → callLog2 표시 (callLog1은 STRING 날짜라 필터 안 걸림) → "2초"
```

**수정** (서버 + CTIBridge):
1. `incoming-call/route.ts`: 날짜를 `new Date()` (Date 객체)로 저장, `status: 'ringing'`으로 생성
2. `call-logs/route.ts`: "start" 핸들러에서 `startedAt: now` 갱신 추가
3. `CTIWorker.cs`: 수신 end 이벤트에 `Duration = (DateTime.Now - _inboundCallTime).TotalSeconds` 추가
4. `types/v2/index.ts`: `CallStatus`에 `'ringing'` 추가

**데이터 복구** (마이그레이션 API):
- `/api/v2/migration/fix-duration`: 2/13 통화 7건 duration 복구 + AI 파이프라인 재실행 + 고아 callLog 삭제
- `/api/v2/migration/fix-string-dates`: DB 전체 18건의 문자열 날짜를 Date 객체로 변환

**교훈 (⚠️ 중요)**:
- MongoDB에 날짜 저장 시 반드시 `new Date()` 사용. 절대 `new Date().toISOString()` 사용 금지
- 통화 초기 status는 `ringing`으로 생성 → 연결 시 `connected`로 전환 (2단계)
- CTIBridge에서 duration을 직접 계산해서 보내야 함 (서버 fallback에 의존하지 않기)

### Bug 6: CTIBridge 코드 점검 (2026-02-14)

전체 점검으로 발견된 4건:

**6-1. Duration에 벨소리 시간 포함** (CTIWorker.cs)
- `_inboundCallTime`은 ring 시점에 설정됨 → 통화시간에 벨소리 대기 10~30초 포함
- **수정**: `_inboundCallStartTime` 변수 추가, start 이벤트 전송 시점에 기록, duration 계산에 사용

**6-2. 녹취 상태 통화 종료 시 미리셋** (CTIWorker.cs)
- `ResetInboundCallState()`에서 `_isRecordingReady`, `_isRecording` 리셋 안 됨
- EVT_STOP_RECORD 없이 통화 종료 시 → 다음 통화의 EVT_READY_SERVICE guard clause에서 무시
- **수정**: `ResetInboundCallState()`에 녹취 상태 리셋 추가

**6-3. INBOUND_CALL_TIMEOUT_SEC 미사용** (CTIWorker.cs)
- 상수 정의만 있고 실제 체크 코드 없음 → end 이벤트 누락 시 상태 영구 고착
- **수정**: `CheckInboundCallTimeout()` 메서드 추가, 메인 루프에서 호출

**6-4. ClickCall 발신 이벤트 중복** (CTIWorker.cs)
- `StartClickCall()`과 `IMS_SVC_ORIGCALL_START_NOTI` 핸들러에서 각각 OutgoingCall 전송
- **수정**: `StartClickCall()`의 OutgoingCall 이벤트 제거, ORIGCALL_START_NOTI만 유지

## 5. V1 → V2 리팩토링 (2026-02-12)

### 이전 구조 (문제 있음)
```
CTIBridge → /api/call-logs (V1+V2 혼합, 932줄)
CTIBridge → /api/call-analysis/recording (V1+V2 혼합, 793줄)
CTIBridge → /api/cti/outgoing-call (V1+V2 혼합, 356줄)

문제점:
- V2 코드가 V1 try/catch 안에서 실행 → V2 에러가 조용히 무시됨
- 두 엔드포인트가 동일 callLog를 경쟁적으로 수정 → 레이스컨디션
- V1 로직이 V2 데이터를 부재중으로 덮어씀
```

### 새 구조 (V2 전용)
```
CTIBridge → /api/v2/cti/incoming-call (기존)
CTIBridge → /api/v2/cti/outgoing-call (신규)
CTIBridge → /api/v2/cti/call-logs (신규)
CTIBridge → /api/v2/call-analysis/recording (개선)

장점:
- 각 엔드포인트가 단일 책임 (SSoT)
- V2 에러가 즉시 노출됨 (silent failure 없음)
- callLogId 직접 전달로 전화번호 매칭 오류 제거
- V1 API 비용 이중 지출 제거
```

## 6. 디버깅 체크리스트

### AI 요약이 안 나올 때

1. **CTIBridge 로그 확인** (`CTIBridge/publish/logs/`)
   - 녹취 전송 성공했는지 (`[Recording] 전송 성공!`)
   - callLogId가 포함됐는지 (`[Recording] ClickCall 녹취 - callLogId 포함`)
   - endReason이 올바른지 (`outbound_end` vs `service_stopped`)

2. **Vercel 로그 확인** (서버)
   - `[Recording V2]` 로그로 녹취 수신 확인
   - callLogId 매칭 결과 (`callLogId로 직접 매칭` vs `전화번호로 매칭`)
   - 파이프라인 시작/완료 로그
   - STT skipped 여부 (`STT skipped: 녹취 파일 너무 작음`)

3. **MongoDB 확인**
   - `callLogs_v2`: aiStatus 필드 (pending/processing/completed/failed/skipped)
   - `callRecordings_v2`: base64 데이터 존재 여부
   - `callLogs_v2.aiAnalysis`: transcript와 analysis 결과

### 수신 녹취가 안 될 때

- SK broadband Svc 번호 확인 (Svc=8은 녹취 불가)
- `IMS_TermRec_Start()` 반환값 확인 (0x800D = 녹취불가)
- `EVT_READY_SERVICE` 수신 여부 확인

### 발신(ClickCall) 녹취가 안 될 때

- `IMS_ClickCall_StartRecord()` 반환값 확인
- HandleClickCallEnd에서 녹취 URL 존재 여부
- ExtInfo에 recfile URL이 포함됐는지

## 7. 관련 파일 목록

| 파일 | 역할 |
|---|---|
| `CTIBridge/CTIWorker.cs` | .NET CTI 브릿지 메인 워커 |
| `src/app/api/v2/cti/incoming-call/route.ts` | 수신 통화 초기 등록 |
| `src/app/api/v2/cti/outgoing-call/route.ts` | 발신 통화 초기 등록 |
| `src/app/api/v2/cti/call-logs/route.ts` | 통화 상태 업데이트 |
| `src/app/api/v2/call-analysis/recording/route.ts` | 녹취 수신 + 파이프라인 트리거 |
| `src/app/api/v2/call-analysis/transcribe/route.ts` | Whisper STT 변환 |
| `src/app/api/v2/call-analysis/analyze/route.ts` | GPT AI 분석 |

## 8. MongoDB 컬렉션

| 컬렉션 | 역할 |
|---|---|
| `callLogs_v2` | V2 통화기록 (aiStatus, aiAnalysis 포함) |
| `callRecordings_v2` | 녹음 base64 데이터 (callLogId로 연결) |
| `patients_v2` | V2 환자 정보 |

## 9. 현재 상태 (2026-02-14 기준)

### 발신(ClickCall) — 정상 동작

```
웹 UI → CTIBridge(localhost:5080) → IMS_ClickCall_Start(녹취=1)
  → 통화 → IMS_ClickCall_StartRecord() → 녹취 파일 URL 수신
  → 서버 전송 → STT(Whisper) → AI 분석(GPT) → callLog에 저장
```

- SK Svc=8 문제와 무관 (ClickCall 자체 녹취 메커니즘 사용)
- 녹취 + AI 요약 정상 동작 중

### 수신(Inbound) — SK 조치 필요

```
전화 수신 → Svc=7(ring) → Svc=8(EVT_READY_SERVICE) → IMS_TermRec_Start() → 녹취
                              ↑ 이 이벤트가 안 오는 게 문제
```

- **코드 쪽은 완료**: 날짜 타입, ringing 상태, duration 계산, 녹취 상태 리셋 모두 수정됨
- **남은 문제**: SK브로드밴드에서 Svc=8(EVT_READY_SERVICE) 이벤트를 보내지 않음
  - 2/9: 81% 정상 → 2/13: 24%로 급감 (SK 측 라우팅 변경 의심)
  - SK에 문의 중 (착신번호: 031-567-2278, 에러코드: 800D)
- SK가 Svc=8 정상 라우팅하면 수신 녹취 + AI 요약 완전 정상화

### 외부 의존성 (코드와 무관한 장애 가능성)

| 의존성 | 장애 시 영향 |
|--------|-------------|
| OpenAI Whisper API | STT 실패 → AI 요약 불가 |
| OpenAI GPT API | AI 요약 실패 (녹취 자체는 보존) |
| SK 녹취 URL 다운로드 | 녹취 파일 전송 실패 |
| Vercel 서버 | 콜드스타트 타임아웃 |

### CTIBridge 배포 방법

빌드 경로: `CTIBridge\bin\Release\net9.0\win-x86\publish\`

```
1. net stop "CTI Bridge Service"
2. publish 폴더 내용 → 운영 서버 CTIBridge 폴더에 덮어쓰기
3. net start "CTI Bridge Service"
```
