// src/hooks/useActivityLogger.ts (수정된 버전)
import { useCallback } from 'react';
import { useAppSelector } from './reduxHooks';
import { logActivity } from '@/utils/activityLogger';
import { ActivityAction, ActivityTarget } from '@/types/activityLog';
import { shouldSkipLogging } from '@/utils/adminActivityFilter'; // 🔥 새로 추가

interface ActivityLoggerOptions {
  action: ActivityAction;
  target: ActivityTarget;
  targetId: string;
  details?: any;
  skipLogging?: boolean;
}

export const useActivityLogger = () => {
  const { user } = useAppSelector((state) => state.auth);

  const logUserActivity = useCallback(async (options: ActivityLoggerOptions) => {
    if (options.skipLogging || !user) return;

    // 🔥 관리자 페이지/액션 로깅 제외 체크
    if (shouldSkipLogging(options.action)) {
      console.log(`🚫 관리자 작업으로 로깅 제외: ${options.action}`);
      return;
    }

    try {
      await logActivity(
        options.action,
        options.target,
        options.targetId,
        `${user.name} - ${options.target}`,
        options.details || {}
      );
    } catch (error) {
      console.warn('활동 로그 기록 실패:', error);
      // 로깅 실패가 메인 기능을 방해하지 않도록 조용히 처리
    }
  }, [user]);

  // 환자 관련 액션 로깅
  const logPatientAction = useCallback((
    action: 'patient_create' | 'patient_update' | 'patient_delete' | 'patient_view',
    patientId: string,
    patientName: string,
    details?: any
  ) => {
    return logUserActivity({
      action: action as ActivityAction,
      target: 'patient' as ActivityTarget,
      targetId: patientId,
      details: {
        patientName,
        callbackNumber: '', // 기본값 추가
        ...details
      }
    });
  }, [logUserActivity]);

  const logPatientCompleteAction = useCallback((
    action: 'patient_complete' | 'patient_complete_cancel',
    patientId: string,
    patientName: string,
    details?: any
  ) => {
    return logUserActivity({
      action: action as ActivityAction,
      target: 'patient' as ActivityTarget,
      targetId: patientId,
      details: {
        patientName,
        callbackNumber: '', // 기본값 추가
        ...details
      }
    });
  }, [logUserActivity]);

  // 🔥 콜백 관련 액션 로깅 - 수정됨
  const logCallbackAction = useCallback((
    action: 'callback_create' | 'callback_update' | 'callback_complete' | 'callback_cancel' | 'callback_delete' | 'callback_reschedule',
    patientId: string,
    patientName: string,
    callbackDetails?: any
  ) => {
    console.log('🔥 콜백 활동 로그 기록:', {
      action,
      patientId,
      patientName,
      callbackDetails
    });

    return logUserActivity({
      action: action as ActivityAction,
      target: 'callback' as ActivityTarget,
      targetId: patientId, // 환자 ID를 targetId로 사용
      details: {
        patientName,
        callbackNumber: '', // 기본값 추가
        // 🔥 callbackDetails를 직접 스프레드하여 중첩 제거
        ...callbackDetails
      }
    });
  }, [logUserActivity]);

  // 상태 변경 로깅
  const logStatusChange = useCallback((
    patientId: string,
    patientName: string,
    statusType: 'consultation_status' | 'patient_status' | 'event_target',
    oldValue: string,
    newValue: string
  ) => {
    return logUserActivity({
      action: 'patient_status_change' as ActivityAction,
      target: statusType as ActivityTarget,
      targetId: patientId,
      details: {
        patientName,
        statusType,
        oldValue,
        newValue,
        callbackNumber: '' // 기본값 추가
      }
    });
  }, [logUserActivity]);

  // 🔥 메시지 전송 로깅 - 수정됨
  const logMessageAction = useCallback((
    action: 'message_send' | 'message_template_used',
    patientId: string,
    patientName: string,
    messageDetails?: any
  ) => {
    console.log('🔥 메시지 활동 로그 기록:', {
      action,
      patientId,
      patientName,
      messageDetails
    });

    return logUserActivity({
      action: action as ActivityAction,
      target: 'message' as ActivityTarget,
      targetId: patientId,
      details: {
        patientName,
        callbackNumber: '', // 기본값 추가
        // 🔥 messageDetails를 직접 스프레드하여 중첩 제거
        ...messageDetails
      }
    });
  }, [logUserActivity]);

  // 일반 액션 로깅 (사용자 정의)
  const logCustomAction = useCallback((
    action: ActivityAction,
    target: ActivityTarget,
    targetId: string,
    details?: any
  ) => {
    return logUserActivity({
      action,
      target,
      targetId,
      details: {
        callbackNumber: '', // 기본값 추가
        ...details
      }
    });
  }, [logUserActivity]);

  return {
    logPatientAction,
    logCallbackAction,
    logPatientCompleteAction, 
    logStatusChange,
    logMessageAction,
    logCustomAction,
    logUserActivity
  };
};