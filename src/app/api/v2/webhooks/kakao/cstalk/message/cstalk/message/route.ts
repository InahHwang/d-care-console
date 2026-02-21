// 비즈고 웹훅 실제 수신 경로
// 비즈고는 등록된 base URL에 /cstalk/message를 자동 추가함
// 등록 URL이 /api/v2/webhooks/kakao/cstalk/message 이므로
// 실제 호출: /api/v2/webhooks/kakao/cstalk/message/cstalk/message
// → 원본 핸들러로 위임

export { POST, GET } from '../../route';
export { dynamic } from '../../route';
