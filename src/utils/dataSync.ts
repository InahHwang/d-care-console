// src/utils/dataSync.ts - getEventListeners 에러 수정

import { QueryClient } from '@tanstack/react-query';

/**
 * 데이터 변경 이벤트 타입 정의
 */
export type DataChangeType = 
  | 'patient_create'      // 환자 생성
  | 'patient_update'      // 환자 정보 수정
  | 'patient_delete'      // 환자 삭제
  | 'callback_add'        // 콜백 추가
  | 'callback_update'     // 콜백 수정
  | 'callback_delete'     // 콜백 삭제
  | 'visit_confirmation'  // 내원확정 토글
  | 'consultation_update' // 상담정보 업데이트
  | 'event_target_update' // 이벤트타겟 업데이트
  | 'post_visit_update'   // 내원 후 상태 업데이트
  | 'patient_complete'    // 환자 종결
  | 'refresh_all';        // 전체 새로고침

/**
 * 데이터 변경 이벤트 상세 정보
 */
export interface DataChangeDetail {
  patientId?: string;
  type: DataChangeType;
  timestamp: number;
  source?: string; // 변경을 트리거한 컴포넌트 식별
  metadata?: any;  // 추가 메타데이터
}

/**
 * 데이터 새로고침 트리거 함수
 * @param patientId 변경된 환자 ID (선택)
 * @param type 변경 타입
 * @param source 변경을 트리거한 컴포넌트 (선택)
 * @param metadata 추가 메타데이터 (선택)
 */
export const triggerDataRefresh = (
  patientId?: string, 
  type: DataChangeType = 'refresh_all',
  source?: string,
  metadata?: any
) => {
  if (typeof window !== 'undefined') {
    const detail: DataChangeDetail = {
      patientId,
      type,
      timestamp: Date.now(),
      source,
      metadata
    };
    
    console.log('🔄 데이터 새로고침 트리거:', detail);
    
    window.dispatchEvent(new CustomEvent('patientDataChanged', {
      detail,
      bubbles: true
    }));
  }
};

/**
 * 데이터 동기화 리스너 설정
 * @param queryClient React Query 클라이언트
 * @returns cleanup 함수
 */
export const setupDataSyncListener = (queryClient: QueryClient) => {
  const handleDataChange = (event: CustomEvent<DataChangeDetail>) => {
    const { patientId, type, source, timestamp } = event.detail;
    
    console.log('📡 데이터 변경 이벤트 수신:', {
      patientId,
      type,
      source,
      timestamp: new Date(timestamp).toISOString()
    });
    
    // 타입별 캐시 무효화 전략
    switch (type) {
      case 'patient_create':
      case 'patient_delete':
      case 'refresh_all':
        // 전체 환자 목록 새로고침
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        console.log('🔄 전체 환자 목록 캐시 무효화');
        break;
        
      case 'patient_update':
      case 'callback_add':
      case 'callback_update':
      case 'callback_delete':
      case 'visit_confirmation':
      case 'consultation_update':
      case 'event_target_update':
      case 'post_visit_update':
      case 'patient_complete':
        // 전체 목록과 특정 환자 모두 새로고침
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        if (patientId) {
          queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
        }
        console.log(`🔄 환자 데이터 캐시 무효화 (${type})`, patientId);
        break;
        
      default:
        // 알 수 없는 타입은 전체 새로고침
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        console.log('🔄 기본 전체 캐시 무효화');
    }
    
    // 선택적: 특정 시간 후 자동 재검증
    setTimeout(() => {
      queryClient.invalidateQueries({ 
        queryKey: ['patients'],
        refetchType: 'inactive' // 비활성 쿼리도 재검증
      });
    }, 100); // 100ms 후 한번 더 확인
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('patientDataChanged', handleDataChange as EventListener);
    
    console.log('📡 데이터 동기화 리스너 등록 완료');
    
    // cleanup 함수 반환
    return () => {
      window.removeEventListener('patientDataChanged', handleDataChange as EventListener);
      console.log('📡 데이터 동기화 리스너 해제');
    };
  }
  
  return () => {}; // SSR 환경에서는 빈 함수 반환
};

/**
 * 컴포넌트에서 사용할 데이터 새로고침 훅
 */
export const useDataRefresh = () => {
  const refresh = (
    patientId?: string, 
    type: DataChangeType = 'refresh_all',
    source?: string,
    metadata?: any
  ) => {
    triggerDataRefresh(patientId, type, source, metadata);
  };
  
  return { refresh };
};

/**
 * 환자 관련 데이터 변경 시 사용할 특화된 함수들
 */
export const PatientDataSync = {
  // 환자 생성
  onCreate: (patientId: string, source?: string) => 
    triggerDataRefresh(patientId, 'patient_create', source),
    
  // 환자 정보 수정
  onUpdate: (patientId: string, source?: string, metadata?: any) => 
    triggerDataRefresh(patientId, 'patient_update', source, metadata),
    
  // 환자 삭제
  onDelete: (patientId: string, source?: string) => 
    triggerDataRefresh(patientId, 'patient_delete', source),
    
  // 콜백 추가
  onCallbackAdd: (patientId: string, callbackType?: string, source?: string) => 
    triggerDataRefresh(patientId, 'callback_add', source, { callbackType }),
    
  // 콜백 수정
  onCallbackUpdate: (patientId: string, callbackId?: string, source?: string) => 
    triggerDataRefresh(patientId, 'callback_update', source, { callbackId }),
    
  // 콜백 삭제
  onCallbackDelete: (patientId: string, callbackId?: string, source?: string) => 
    triggerDataRefresh(patientId, 'callback_delete', source, { callbackId }),
    
  // 내원확정 토글
  onVisitConfirmation: (patientId: string, visitConfirmed: boolean, source?: string) => 
    triggerDataRefresh(patientId, 'visit_confirmation', source, { visitConfirmed }),
    
  // 상담정보 업데이트
  onConsultationUpdate: (patientId: string, source?: string) => 
    triggerDataRefresh(patientId, 'consultation_update', source),
    
  // 이벤트타겟 업데이트
  onEventTargetUpdate: (patientId: string, isEventTarget: boolean, source?: string) => 
    triggerDataRefresh(patientId, 'event_target_update', source, { isEventTarget }),
    
  // 내원 후 상태 업데이트
  onPostVisitUpdate: (patientId: string, postVisitStatus?: string, source?: string) => 
    triggerDataRefresh(patientId, 'post_visit_update', source, { postVisitStatus }),
    
  // 환자 종결
  onComplete: (patientId: string, reason?: string, source?: string) => 
    triggerDataRefresh(patientId, 'patient_complete', source, { reason }),
    
  // 전체 새로고침
  refreshAll: (source?: string) => 
    triggerDataRefresh(undefined, 'refresh_all', source)
};

/**
 * 디버깅용 함수 - getEventListeners 타입 에러 수정
 */
export const debugDataSync = {
  // 현재 등록된 리스너 확인 - 🔥 타입 에러 해결
  checkListeners: () => {
    if (typeof window !== 'undefined') {
      console.log('🔍 데이터 동기화 리스너 상태 확인');
      
      // 🔥 getEventListeners는 개발자 도구에서만 사용 가능한 함수이므로 안전하게 처리
      try {
        // @ts-ignore - 개발자 도구 전용 함수
        const listeners = (window as any).getEventListeners?.(window);
        if (listeners?.patientDataChanged) {
          console.log('📡 등록된 patientDataChanged 리스너 수:', listeners.patientDataChanged.length);
        } else {
          console.log('📡 getEventListeners 메서드 없음 (개발자 도구에서만 사용 가능)');
        }
      } catch (error) {
        console.log('📡 리스너 확인 불가 (브라우저 환경에 따라 다름)');
      }
    }
  },
  
  // 테스트 이벤트 발생
  testEvent: (patientId?: string) => {
    triggerDataRefresh(patientId, 'refresh_all', 'debug_test', { 
      message: '디버깅 테스트 이벤트' 
    });
  }
};