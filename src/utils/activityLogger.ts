// src/utils/activityLogger.ts - 순환 의존성 해결 버전

import { ActivityAction, ActivityTarget, ActivityDetails } from '@/types/activityLog';
// 🔥 순환 의존성 해결: store 직접 import 제거
// import { store } from '@/store';  // 이 줄 제거!
import { shouldSkipLogging } from './adminActivityFilter';

// 🔥 최근 로그 추적을 위한 캐시 (중복 방지용)
let recentLogCache: Map<string, number> = new Map();

// 🔥 중복 로그 방지를 위한 함수
function isDuplicateLog(
  action: ActivityAction,
  targetId: string,
  details?: ActivityDetails
): boolean {
  const cacheKey = `${action}-${targetId}-${JSON.stringify(details || {})}`;
  const now = Date.now();
  const lastLogTime = recentLogCache.get(cacheKey);
  
  // 5초 이내 동일한 로그는 중복으로 간주
  if (lastLogTime && now - lastLogTime < 5000) {
    console.log('🚫 중복 로그 감지, 스킵:', cacheKey);
    return true;
  }
  
  // 캐시 업데이트
  recentLogCache.set(cacheKey, now);
  
  // 캐시 크기 제한 (메모리 절약)
  if (recentLogCache.size > 100) {
    const oldestKey = recentLogCache.keys().next().value;
    if (oldestKey) {
      recentLogCache.delete(oldestKey);
    }
  }
  
  return false;
}

// 🔥 런타임에 store 가져오기 (순환 의존성 해결)
function getStore() {
  try {
    // 동적 import로 런타임에 store 가져오기
    const storeModule = require('@/store');
    return storeModule.store;
  } catch (error) {
    console.warn('Store 접근 실패:', error);
    return null;
  }
}

// 활동 로그 기록 함수
export async function logActivity(
  action: ActivityAction,
  target: ActivityTarget,
  targetId: string,
  targetName?: string,
  details?: ActivityDetails
) {
  try {
    // 🔥 관리자 페이지 및 관리자 전용 작업 로깅 제외
    if (shouldSkipLogging(action)) {
      return;
    }

    // 🔥 중복 로그 체크
    if (isDuplicateLog(action, targetId, details)) {
      return; // 중복 로그는 기록하지 않음
    }

    // 🔥 런타임에 현재 로그인한 사용자 정보 가져오기
    const store = getStore();
    if (!store) {
      console.warn('Store에 접근할 수 없어 활동 로그를 기록할 수 없습니다.');
      return;
    }

    const state = store.getState();
    const currentUser = state.auth?.user;
    const token = state.auth?.token;

    if (!currentUser || !token) {
      console.warn('사용자가 로그인하지 않아 활동 로그를 기록할 수 없습니다.');
      return;
    }

    // API 호출하여 로그 기록
    const response = await fetch('/api/activity-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        target,
        targetId,
        targetName: targetName || '',
        details: details || {}
      }),
    });

    if (!response.ok) {
      console.warn('활동 로그 기록 실패:', response.statusText);
    } else {
      console.log('✅ 활동 로그 기록 성공:', action, targetId);
    }

  } catch (error) {
    console.warn('활동 로그 기록 중 오류:', error);
    // 로그 기록 실패는 다른 기능에 영향주지 않도록 조용히 처리
  }
}

// 🔥 필드 변경 사항을 사람이 읽기 쉬운 형태로 변환하는 함수 (개선)
function formatFieldChanges(previousData: any, newData: any): string {
  const changes: string[] = [];
  
  // 필드별 변경 사항 확인
  const fieldLabels: Record<string, string> = {
    name: '이름',
    phoneNumber: '연락처', 
    age: '나이',
    status: '상태',
    callInDate: 'DB유입날짜',
    firstConsultDate: '첫상담일',
    notes: '메모',
    referralSource: '유입경로',
    consultationType: '상담타입'
  };

  // 기본 필드 변경사항 확인
  Object.keys(fieldLabels).forEach(field => {
    const oldValue = previousData?.[field];
    const newValue = newData?.[field];
    
    if (oldValue !== newValue && newValue !== undefined) {
      const label = fieldLabels[field];
      
      if (field === 'age') {
        if (oldValue && newValue) {
          changes.push(`${label}: ${oldValue} → ${newValue}`);
        } else if (newValue) {
          changes.push(`${label}: ${newValue}`);
        }
      } else if (field === 'referralSource') {
        const oldSource = oldValue || '없음';
        const newSource = newValue || '없음';
        if (oldSource !== newSource) {
          changes.push(`${label}: ${oldSource} → ${newSource}`);
        }
      } else {
        if (oldValue && newValue) {
          changes.push(`${label}: ${oldValue} → ${newValue}`);
        } else if (newValue) {
          changes.push(`${label}: ${newValue}`);
        }
      }
    }
  });

  // 지역 변경사항 확인
  const oldRegion = previousData?.region;
  const newRegion = newData?.region;
  
  if (JSON.stringify(oldRegion) !== JSON.stringify(newRegion)) {
    if (oldRegion && newRegion) {
      const oldRegionStr = `${oldRegion.province}${oldRegion.city ? ' ' + oldRegion.city : ''}`;
      const newRegionStr = `${newRegion.province}${newRegion.city ? ' ' + newRegion.city : ''}`;
      if (oldRegionStr !== newRegionStr) {
        changes.push(`지역: ${oldRegionStr} → ${newRegionStr}`);
      }
    } else if (newRegion) {
      const newRegionStr = `${newRegion.province}${newRegion.city ? ' ' + newRegion.city : ''}`;
      changes.push(`지역: ${newRegionStr}`);
    } else if (oldRegion) {
      changes.push('지역: 삭제됨');
    }
  }

  // 관심분야 변경사항 확인
  const oldServices = previousData?.interestedServices || [];
  const newServices = newData?.interestedServices || [];
  
  if (JSON.stringify(oldServices.sort()) !== JSON.stringify(newServices.sort())) {
    const added = newServices.filter((s: string) => !oldServices.includes(s));
    const removed = oldServices.filter((s: string) => !newServices.includes(s));
    
    if (added.length > 0 && removed.length > 0) {
      changes.push(`관심분야: +${added.join(', ')}, -${removed.join(', ')}`);
    } else if (added.length > 0) {
      changes.push(`관심분야 추가: ${added.join(', ')}`);
    } else if (removed.length > 0) {
      changes.push(`관심분야 제거: ${removed.join(', ')}`);
    }
  }

  return changes.join(', ');
}

// 환자 관련 활동 로그 도우미 함수들
export const PatientActivityLogger = {
  // 환자 생성
  create: (patientId: string, patientName: string, patientData: any) => 
    logActivity('patient_create', 'patient', patientId, patientName, {
      patientId,
      patientName,
      newData: patientData,
      notes: '새 환자가 등록되었습니다.',
      callbackNumber: ''
    }),

  // 🔥 환자 정보 수정 - 상세 변경사항 포함 (단일 로그로 통합)
  update: (patientId: string, patientName: string, previousData: any, newData: any) => {
    const changeDetails = formatFieldChanges(previousData, newData);
    
    // 🔥 변경사항이 없으면 로그 기록하지 않음
    if (!changeDetails) {
      console.log('변경사항이 없어서 로그를 기록하지 않습니다.');
      return Promise.resolve();
    }
    
    return logActivity('patient_update', 'patient', patientId, patientName, {
      patientId,
      patientName,
      previousData,
      newData,
      changeDetails, // 🔥 변경사항 요약 추가
      notes: `환자 정보 수정: ${changeDetails}`, // 🔥 상세 정보가 포함된 단일 메시지
      callbackNumber: ''
    });
  },

  // 환자 삭제
  delete: (patientId: string, patientName: string) => 
    logActivity('patient_delete', 'patient', patientId, patientName, {
      patientId,
      patientName,
      notes: '환자가 삭제되었습니다.',
      callbackNumber: ''
    }),

  // 🚫 환자 상세 조회 - 로그 기록 비활성화
  view: (patientId: string, patientName: string) => {
    // 환자 조회는 너무 빈번하므로 로그에 기록하지 않음
    console.log(`환자 조회: ${patientName} (${patientId}) - 로그 기록 안함`);
    return Promise.resolve();
  },

  // 환자 상태 변경
  statusChange: (patientId: string, patientName: string, previousStatus: string, newStatus: string, reason?: string) => 
    logActivity('patient_status_change', 'patient', patientId, patientName, {
      patientId,
      patientName,
      previousStatus,
      newStatus,
      reason,
      notes: `환자 상태가 ${previousStatus}에서 ${newStatus}로 변경되었습니다.`,
      callbackNumber: ''
    }),

  // 환자 종결 처리
  complete: (patientId: string, patientName: string, reason: string) => 
    logActivity('patient_complete', 'patient', patientId, patientName, {
      patientId,
      patientName,
      reason,
      notes: '환자가 종결 처리되었습니다.',
      callbackNumber: ''
    }),

  // 환자 종결 취소
  cancelComplete: (patientId: string, patientName: string) => 
    logActivity('patient_complete_cancel', 'patient', patientId, patientName, {
      patientId,
      patientName,
      notes: '환자 종결 처리가 취소되었습니다.',
      callbackNumber: ''
    }),

  // 내원 확정 토글
  toggleVisitConfirmation: (patientId: string, patientName: string, isConfirmed: boolean) => 
    logActivity('visit_confirmation_toggle', 'patient', patientId, patientName, {
      patientId,
      patientName,
      newStatus: isConfirmed ? '내원확정' : '내원확정취소',
      notes: `내원 확정이 ${isConfirmed ? '설정' : '해제'}되었습니다.`,
      callbackNumber: ''
    }),

  // 🔥 내원 후 상태 데이터 초기화 메서드 수정 (기존 타입 호환)
  resetPostVisitData: (patientId: string, patientName: string) => 
    logActivity('patient_update', 'patient', patientId, patientName, {
      patientId,
      patientName,
      notes: '내원 후 상태 데이터가 초기화되었습니다. (postVisitStatus, postVisitConsultation, postVisitNotes, treatmentStartDate, nextCallbackDate, visitDate)',
      callbackNumber: ''
    }),
};

// 콜백 관련 활동 로그 도우미 함수들
export const CallbackActivityLogger = {
  // 콜백 생성
  create: (patientId: string, patientName: string, callbackData: any) => 
    logActivity('callback_create', 'callback', callbackData.id || 'new', patientName, {
      patientId,
      patientName,
      callbackType: callbackData.type,
      callbackDate: callbackData.date,
      callbackStatus: callbackData.status,
      notes: `${callbackData.type} 콜백이 생성되었습니다.`,
      callbackNumber: ''
    }),

  // 콜백 수정
  update: (patientId: string, patientName: string, callbackId: string, previousData: any, newData: any) => 
    logActivity('callback_update', 'callback', callbackId, patientName, {
      patientId,
      patientName,
      callbackId,
      previousData,
      newData,
      notes: '콜백 정보가 수정되었습니다.',
      callbackNumber: ''
    }),

  // 콜백 완료
  complete: (patientId: string, patientName: string, callbackId: string, callbackType: string, nextStep?: string) => 
    logActivity('callback_complete', 'callback', callbackId, patientName, {
      patientId,
      patientName,
      callbackId,
      callbackType,
      nextStep,
      notes: `${callbackType} 콜백이 완료되었습니다.`,
      callbackNumber: ''
    }),

  // 콜백 취소
  cancel: (patientId: string, patientName: string, callbackId: string, reason: string) => 
    logActivity('callback_cancel', 'callback', callbackId, patientName, {
      patientId,
      patientName,
      callbackId,
      reason,
      notes: '콜백이 취소되었습니다.',
      callbackNumber: ''
    }),

  // 콜백 삭제
  delete: (patientId: string, patientName: string, callbackId: string) => 
    logActivity('callback_delete', 'callback', callbackId, patientName, {
      patientId,
      patientName,
      callbackId,
      notes: '콜백이 삭제되었습니다.',
      callbackNumber: ''
    }),
};

// 메시지 관련 활동 로그 도우미 함수들
export const MessageActivityLogger = {
  // 메시지 발송
  send: (patientIds: string[], messageType: string, content: string, recipientCount: number) => {
    // 첫 번째 환자 ID를 대표로 사용
    const targetId = patientIds[0] || 'bulk';
    return logActivity('message_send', 'message', targetId, '메시지 발송', {
      messageType,
      recipientCount,
      messageContent: content.substring(0, 100), // 처음 100자만 저장
      notes: `${recipientCount}명에게 ${messageType} 메시지가 발송되었습니다.`,
      callbackNumber: ''
    });
  },

  // 🚫 메시지 로그 조회 - 로그 기록 비활성화 (필요에 따라)
  viewLogs: () => {
    // 메시지 로그 조회도 빈번할 수 있으므로 로그 기록 안함
    console.log('메시지 로그 조회 - 로그 기록 안함');
    return Promise.resolve();
  },
};

// 이벤트 타겟 관련 활동 로그 도우미 함수들
export const EventTargetActivityLogger = {
  // 이벤트 타겟 생성
  create: (patientId: string, patientName: string, eventData: any) => 
    logActivity('event_target_create', 'event_target', patientId, patientName, {
      patientId,
      patientName,
      targetReason: eventData.targetReason,
      categories: eventData.categories,
      notes: '환자가 이벤트 타겟으로 설정되었습니다.',
      callbackNumber: ''
    }),

  // 이벤트 타겟 수정
  update: (patientId: string, patientName: string, eventData: any) => 
    logActivity('event_target_update', 'event_target', patientId, patientName, {
      patientId,
      patientName,
      targetReason: eventData.targetReason,
      categories: eventData.categories,
      notes: '이벤트 타겟 정보가 수정되었습니다.',
      callbackNumber: ''
    }),

  // 이벤트 타겟 삭제
  delete: (patientId: string, patientName: string) => 
    logActivity('event_target_delete', 'event_target', patientId, patientName, {
      patientId,
      patientName,
      notes: '이벤트 타겟에서 제외되었습니다.',
      callbackNumber: ''
    }),
};

// 기본 활동 로그 함수 export
export default logActivity;