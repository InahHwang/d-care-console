# 비즈고 카카오 상담톡 연동 - 이어서 진행

## 현재 완료 상태 (2026-02-21)

### 구현 완료
1. **웹훅 수신 API**: `src/app/api/v2/webhooks/kakao/cstalk/message/route.ts`
   - 비즈고가 POST로 고객 메시지 전달 → channelChats_v2/channelMessages_v2 저장 → Pusher 실시간 이벤트
2. **메시지 발송**: `src/app/api/v2/channel-chats/[chatId]/messages/route.ts`
   - sendKakaoMessage 함수에 비즈고 API 발송 로직 추가 (1순위: 비즈고 → 2순위: 레거시 → 3순위: pending_send)
3. **Vercel 배포 완료** + 환경변수 설정 완료 (BIZGO_API_KEY, BIZGO_SENDER_KEY)

### 블로커 발견 (2026-02-21)
- **웹훅 미수신 원인 확인**: A치과의 카카오톡 채널에 **채널톡(channel.io)**이 상담톡으로 이미 연동되어 있음
- 카카오 상담톡은 **하나의 채널에 하나의 파트너만 연결 가능** → 채널톡이 점유 중이라 비즈고 웹훅이 수신 안 됨
- **해결 방법**: 채널톡에서 카카오 상담톡 연동 해제 → 비즈고로 전환
- 비즈고 담당자에게 이메일 발송 완료 (채널톡 충돌 확인 + 전환 절차 문의)
- **비즈고 담당자 회신 대기 중**

### 사업화 관련 결정사항
- MVP 단계: A치과 카카오 채널 + senderKey 1개로 테스트
- 사업화 시: 치과별 개별 카카오 채널 연동 (senderKey를 환경변수 → DB 조회로 변경)
- 구조 변경 범위 작으므로 사업화 시점에 변경 예정

## 대기 중인 작업
- 비즈고 담당자 회신 대기 (채널톡 충돌 확인 + 전환 절차 안내)
- 회신 후: A치과 채널톡 상담톡 해제 → 비즈고 연동 등록 → 수신/발송 테스트

## 다음 작업 (담당자 회신 후)

$ARGUMENTS

아래 순서로 진행:
1. 채널톡 상담톡 해제 (A치과 관리자에서)
2. 비즈고 담당자에게 해제 완료 알림 → 상담톡 연동 등록 요청
3. 웹훅 수신 테스트 - 카카오톡에서 A치과 채널로 메시지 보내서 비즈고 웹훅 수신 확인
4. 메시지 발송 테스트 - D-Care 콘솔에서 답장 → 카카오톡 도착 확인
5. 문제 있으면 로그 확인 후 수정 → 재배포

## 핵심 파일
- 웹훅 수신: `src/app/api/v2/webhooks/kakao/cstalk/message/route.ts`
- 메시지 발송: `src/app/api/v2/channel-chats/[chatId]/messages/route.ts` (sendKakaoMessage 함수)
- 타입: `src/types/v2/channelChat.ts`
- 채널상담 페이지: `src/app/v2/channel-chat/page.tsx`
- 비즈고 API 문서: `docs/bizgo.txt`

## 비즈고 API 스펙
- 수신 웹훅: POST {우리서버}/api/v2/webhooks/kakao/cstalk/message (msgKey, userKey, senderKey, msgType, contents)
- 발송 API: POST https://mars.ibapi.kr/api/comm/v1/send/cstalk/plain (Authorization: {ApiKey})
- 발송 파라미터: userKey, senderKey, msgType(TEXT/IMAGE/FILE), message

## 비즈고 연동 정보
- 업체명: 엠톤
- 로그인 ID: contact@catchall.ai.kr
- 발신프로필 키: 1508b3ea718d8fe0f46dd88754c23ace51687451
- 수신 URL: https://d-care-console.vercel.app/api/v2/webhooks/kakao/cstalk/message
