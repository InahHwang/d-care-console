// src/lib/ctiEventStore.ts
// 메모리 기반 CTI 이벤트 저장소 (SSE 브로드캐스트용)

export interface PatientInfo {
  id: string;
  name: string;
  phoneNumber: string;
  lastVisit?: string;
  notes?: string;
  callCount?: number;
}

export interface CTIEvent {
  id: string;
  eventType: 'INCOMING_CALL' | 'CALL_ANSWERED' | 'CALL_ENDED' | 'MISSED_CALL';
  callerNumber: string;
  calledNumber: string;
  timestamp: string;
  receivedAt: string;
  // 환자 정보 (DB에서 매칭된 경우)
  patient?: PatientInfo | null;
  isNewCustomer?: boolean;
}

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class CTIEventStore {
  private clients: Map<string, SSEClient> = new Map();
  private events: CTIEvent[] = [];
  private maxEvents = 100;

  // 새 이벤트 추가 및 모든 클라이언트에게 브로드캐스트
  addEvent(event: CTIEvent) {
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    console.log(`[CTI Store] 이벤트 추가: ${event.callerNumber} -> ${event.calledNumber}`);
    console.log(`[CTI Store] 연결된 클라이언트: ${this.clients.size}개`);

    // 모든 연결된 클라이언트에게 브로드캐스트
    this.broadcast(event);
  }

  // SSE 클라이언트 등록
  addClient(id: string, controller: ReadableStreamDefaultController) {
    this.clients.set(id, { id, controller });
    console.log(`[CTI Store] 클라이언트 연결: ${id} (총 ${this.clients.size}개)`);
  }

  // SSE 클라이언트 제거
  removeClient(id: string) {
    this.clients.delete(id);
    console.log(`[CTI Store] 클라이언트 연결 해제: ${id} (총 ${this.clients.size}개)`);
  }

  // 모든 클라이언트에게 이벤트 전송
  private broadcast(event: CTIEvent) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    const encoder = new TextEncoder();

    this.clients.forEach((client, id) => {
      try {
        client.controller.enqueue(encoder.encode(data));
      } catch (error) {
        console.log(`[CTI Store] 전송 실패, 클라이언트 제거: ${id}`);
        this.clients.delete(id);
      }
    });
  }

  // 최근 이벤트 조회
  getRecentEvents(limit: number = 20): CTIEvent[] {
    return this.events.slice(0, limit);
  }

  // 연결된 클라이언트 수
  getClientCount(): number {
    return this.clients.size;
  }
}

// 싱글톤 인스턴스
declare global {
  // eslint-disable-next-line no-var
  var _ctiEventStore: CTIEventStore | undefined;
}

export function getCTIEventStore(): CTIEventStore {
  if (!global._ctiEventStore) {
    global._ctiEventStore = new CTIEventStore();
    console.log('[CTI Store] 인스턴스 생성됨');
  }
  return global._ctiEventStore;
}
