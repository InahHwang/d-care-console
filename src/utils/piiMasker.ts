// src/utils/piiMasker.ts
// PII(개인식별정보) 마스킹/복원 유틸리티
// OpenAI 등 외부 AI 서비스 전송 전 개인정보 보호

// 마스킹 맵: 원본 → 치환값
interface MaskingMap {
  names: Map<string, string>;       // 이름 → [환자A], [환자B]...
  phones: Map<string, string>;      // 전화번호 → [전화번호1], [전화번호2]...
}

export class PIIMasker {
  private map: MaskingMap;
  private nameCounter = 0;
  private phoneCounter = 0;

  // 이름 라벨: A~Z
  private static NAME_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  constructor() {
    this.map = {
      names: new Map(),
      phones: new Map(),
    };
  }

  // 이름 등록 (DB에서 조회한 환자명을 미리 등록)
  registerName(name: string): string {
    if (!name || name.length < 2) return name;
    const existing = this.map.names.get(name);
    if (existing) return existing;

    const label = PIIMasker.NAME_LABELS[this.nameCounter] || `환자${this.nameCounter + 1}`;
    const masked = `[환자${label}]`;
    this.map.names.set(name, masked);
    this.nameCounter++;
    return masked;
  }

  // 전화번호 등록
  registerPhone(phone: string): string {
    if (!phone) return phone;
    const normalized = phone.replace(/[\s-]/g, '');
    const existing = this.map.phones.get(normalized);
    if (existing) return existing;

    this.phoneCounter++;
    const masked = `[전화번호${this.phoneCounter}]`;
    this.map.phones.set(normalized, masked);
    // 원본 형식도 등록 (하이픈 포함)
    if (phone !== normalized) {
      this.map.phones.set(phone, masked);
    }
    return masked;
  }

  // 텍스트에서 PII 마스킹
  maskText(text: string): string {
    if (!text) return text;
    let masked = text;

    // 1. 등록된 이름 치환 (긴 이름부터 — 부분매칭 방지)
    const sortedNames = Array.from(this.map.names.entries())
      .sort(([a], [b]) => b.length - a.length);
    for (const [name, placeholder] of sortedNames) {
      masked = masked.replaceAll(name, placeholder);
    }

    // 2. 등록된 전화번호 치환
    Array.from(this.map.phones.entries()).forEach(([phone, placeholder]) => {
      masked = masked.replaceAll(phone, placeholder);
    });

    // 3. 미등록 전화번호 패턴 자동 감지 (010-1234-5678, 01012345678, 02-1234-5678 등)
    masked = masked.replace(
      /(?:0\d{1,2})[-.\s]?(?:\d{3,4})[-.\s]?(?:\d{4})/g,
      (match) => {
        const normalized = match.replace(/[\s-]/g, '');
        if (this.map.phones.has(normalized)) {
          return this.map.phones.get(normalized)!;
        }
        return this.registerPhone(match);
      }
    );

    return masked;
  }

  // 객체의 PII 필드를 마스킹 (환자 데이터 구조에 맞춤)
  maskPatientData(data: Record<string, unknown>): Record<string, unknown> {
    const result = { ...data };

    // 환자명 마스킹
    if (typeof result['환자명'] === 'string') {
      result['환자명'] = this.registerName(result['환자명'] as string);
    }
    if (typeof result['name'] === 'string') {
      result['name'] = this.registerName(result['name'] as string);
    }
    if (typeof result['patientName'] === 'string') {
      result['patientName'] = this.registerName(result['patientName'] as string);
    }

    // 전화번호 마스킹
    if (typeof result['전화번호'] === 'string') {
      result['전화번호'] = this.registerPhone(result['전화번호'] as string);
    }
    if (typeof result['phone'] === 'string') {
      result['phone'] = this.registerPhone(result['phone'] as string);
    }
    if (typeof result['phoneNumber'] === 'string') {
      result['phoneNumber'] = this.registerPhone(result['phoneNumber'] as string);
    }

    // 메모에 포함된 PII
    if (typeof result['메모'] === 'string') {
      result['메모'] = this.maskText(result['메모'] as string);
    }
    if (typeof result['memo'] === 'string') {
      result['memo'] = this.maskText(result['memo'] as string);
    }

    // 상태이력 내 이름 마스킹
    if (Array.isArray(result['상태이력'])) {
      result['상태이력'] = (result['상태이력'] as string[]).map(s => this.maskText(s));
    }

    // 콜백이력 내 이름 마스킹
    if (Array.isArray(result['콜백이력'])) {
      result['콜백이력'] = (result['콜백이력'] as string[]).map(s => this.maskText(s));
    }

    // 최근통화 배열 마스킹
    if (Array.isArray(result['최근통화'])) {
      result['최근통화'] = (result['최근통화'] as Record<string, unknown>[]).map(c => {
        const masked = { ...c };
        if (typeof masked['AI요약'] === 'string') masked['AI요약'] = this.maskText(masked['AI요약'] as string);
        return masked;
      });
    }

    // 최근상담 배열 마스킹
    if (Array.isArray(result['최근상담'])) {
      result['최근상담'] = (result['최근상담'] as Record<string, unknown>[]).map(c => {
        const masked = { ...c };
        if (typeof masked['메모'] === 'string') masked['메모'] = this.maskText(masked['메모'] as string);
        return masked;
      });
    }

    return result;
  }

  // contextData 전체 마스킹 (ai-chat용)
  maskContextData(contextData: Record<string, unknown>): Record<string, unknown> {
    const result = { ...contextData };

    // 검색된_환자 (단일)
    if (result['검색된_환자'] && typeof result['검색된_환자'] === 'object') {
      result['검색된_환자'] = this.maskPatientData(result['검색된_환자'] as Record<string, unknown>);
    }

    // 검색된_환자목록 (복수)
    if (Array.isArray(result['검색된_환자목록'])) {
      result['검색된_환자목록'] = (result['검색된_환자목록'] as Record<string, unknown>[])
        .map(p => this.maskPatientData(p));
    }

    // 콜백_예정 목록
    if (Array.isArray(result['콜백_예정'])) {
      result['콜백_예정'] = (result['콜백_예정'] as Record<string, unknown>[])
        .map(c => this.maskPatientData(c));
    }

    // 기타 환자명 포함 가능 필드들을 텍스트 레벨로 마스킹
    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'string') {
        result[key] = this.maskText(result[key] as string);
      }
    }

    return result;
  }

  // AI 응답에서 마스킹된 값을 원본으로 복원
  unmaskText(text: string): string {
    if (!text) return text;
    let unmasked = text;

    // 이름 복원
    this.map.names.forEach((masked, original) => {
      unmasked = unmasked.replaceAll(masked, original);
    });

    // 전화번호 복원
    this.map.phones.forEach((masked, original) => {
      unmasked = unmasked.replaceAll(masked, original);
    });

    return unmasked;
  }

  // 사용자 메시지에서 이름을 마스킹 (사용자가 "홍길동 환자" 라고 입력한 경우)
  maskUserMessage(message: string): string {
    return this.maskText(message);
  }

  // 대화 이력 메시지 마스킹
  maskMessages(messages: { role: string; content: string }[]): { role: string; content: string }[] {
    return messages.map(m => ({
      role: m.role,
      content: this.maskText(m.content),
    }));
  }
}
