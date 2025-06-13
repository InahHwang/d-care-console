// src/components/management/PatientTooltip.tsx - 실시간 업데이트 개선

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiUser, FiClock, FiEdit, FiUserPlus, FiPhone, FiTrash, FiMessageSquare, FiCheckCircle, FiUserCheck, FiTarget } from 'react-icons/fi';
import { ActivityLog } from '@/types/activityLog';

interface PatientTooltipProps {
  patientId: string;
  patientName: string;
  children: React.ReactNode;
  className?: string;
  refreshTrigger?: number; // 🔥 외부에서 새로고침을 트리거할 수 있는 prop 추가
}

interface PatientHistoryData {
  logs: ActivityLog[];
  isLoading: boolean;
  error?: string;
  hasMore?: boolean;
  currentPage?: number;
  totalCount?: number;
}

// 툴팁에서 제외할 액션들 (조회성 액션들만 제외)
const EXCLUDED_ACTIONS = [
  'patient_view',           // 환자 조회 - 제외
  'message_log_view',       // 메시지 로그 조회
  'login',                  // 로그인
  'logout',                 // 로그아웃
];

// 중복 로그 제거 함수 (동일한 액션+시간+사용자 기준)
const removeDuplicateLogs = (logs: ActivityLog[]): ActivityLog[] => {
  const seen = new Set<string>();
  
  return logs.filter(log => {
    // 중복 판별 키: 액션 + 환자ID + 사용자 + 시간(분 단위까지만)
    const timestamp = new Date(log.timestamp);
    const timeKey = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}-${timestamp.getHours()}-${timestamp.getMinutes()}`;
    const key = `${log.action}-${log.targetId}-${log.userId}-${timeKey}`;
    
    if (seen.has(key)) {
      console.log('🚫 중복 로그 제거:', { action: log.action, user: log.userName, time: log.timestamp });
      return false;
    }
    
    seen.add(key);
    return true;
  });
};

// 중요한 액션들만 필터링하는 함수 (모든 의미있는 액션 포함)
const filterImportantActions = (logs: ActivityLog[]): ActivityLog[] => {
  const filtered = logs.filter(log => {
    // 제외 액션이 아니면서
    if (EXCLUDED_ACTIONS.includes(log.action)) {
      return false;
    }
    
    // 모든 의미있는 액션을 포함
    return true;
  });
  
  // 중복 제거 적용
  return removeDuplicateLogs(filtered);
};

export default function PatientTooltip({ 
  patientId, 
  patientName, 
  children, 
  className = "",
  refreshTrigger = 0 // 🔥 새로고침 트리거 prop
}: PatientTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [historyData, setHistoryData] = useState<PatientHistoryData>({
    logs: [],
    isLoading: false,
    hasMore: false,
    currentPage: 1,
    totalCount: 0
  });
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // 🔥 refreshTrigger가 변경되면 데이터 강제 새로고침
  useEffect(() => {
    if (refreshTrigger > 0 && isVisible) {
      console.log('🔥 PatientTooltip: 외부 트리거로 새로고침', { 
        patientId, 
        patientName, 
        refreshTrigger 
      });
      fetchPatientHistory(1, false, true); // 강제 새로고침
    }
  }, [refreshTrigger, isVisible, patientId]);

  // 툴팁 표시 지연 함수
  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
      fetchPatientHistory(1, false, false); // 일반 로딩
    }, 800); // 0.8초 후 표시
    setTimeoutId(id);
  };

  // 툴팁 숨김 함수 (지연 적용)
  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // 300ms 지연 후 툴팁 숨김
    const hideId = setTimeout(() => {
      setIsVisible(false);
      setIsExpanded(false); // 툴팁 숨길 때 확장 상태도 초기화
      setTimeoutId(null);
    }, 300);
    
    setTimeoutId(hideId);
  };

  // 툴팁 숨김 취소 함수
  const cancelHideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
  };

  // 🔥 환자 편집 이력 가져오기 - 실시간 업데이트 개선
  const fetchPatientHistory = async (page: number = 1, append: boolean = false, forceRefresh: boolean = false) => {
    // 🔥 강제 새로고침이 아니고 이미 로드된 경우 재요청 방지
    if (!append && !forceRefresh && historyData.logs.length > 0 && page === 1) return;

    setHistoryData(prev => ({ ...prev, isLoading: true }));

    try {
      const token = localStorage.getItem('token');
      const limit = 100; // 더 많이 가져와서 필터링 후에도 충분한 양 확보
      const skip = (page - 1) * limit;
      
      // 🔥 캐시 버스팅을 위한 타임스탬프 추가 (강제 새로고침 시)
      const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
      
      const response = await fetch(`/api/activity-logs/target/${patientId}?limit=${limit}&skip=${skip}${cacheBuster}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('이력을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      
      // 중요한 액션들만 필터링 (중복 제거 포함)
      const allLogs = data.logs || [];
      const filteredLogs = filterImportantActions(allLogs);
      
      console.log('🔍 활동 로그 필터링 결과:', {
        patientId,
        patientName,
        total: allLogs.length,
        filtered: filteredLogs.length,
        duplicatesRemoved: allLogs.length - filteredLogs.length,
        forceRefresh, // 🔥 강제 새로고침 여부 로깅
        actions: filteredLogs.map(log => ({ 
          action: log.action, 
          source: log.source,
          user: log.userName,
          time: log.timestamp.substring(11, 16) // HH:MM만 표시
        }))
      });
      
      setHistoryData(prev => ({
        logs: append ? [...prev.logs, ...filteredLogs] : filteredLogs,
        isLoading: false,
        hasMore: data.hasNext || false,
        currentPage: page,
        totalCount: filteredLogs.length // 필터링된 로그 수로 업데이트
      }));
    } catch (error) {
      console.error('Failed to fetch patient history:', error);
      setHistoryData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '이력을 불러오는데 실패했습니다.'
      }));
    }
  };

  // 더 많은 이력 로드
  const loadMoreHistory = () => {
    if (!historyData.isLoading && historyData.hasMore) {
      fetchPatientHistory(historyData.currentPage! + 1, true, false);
    }
  };

  // 액션별 아이콘 및 라벨 가져오기 (콜백/메시지 액션들 추가)
  const getActionInfo = (action: string) => {
    switch (action) {
      // 환자 관련
      case 'patient_create':
        return { icon: FiUserPlus, label: '환자 최초 등록', color: 'text-green-600' };
      case 'patient_update':
        return { icon: FiEdit, label: '환자 정보 수정', color: 'text-blue-600' };
      case 'patient_delete':
        return { icon: FiTrash, label: '환자 삭제', color: 'text-red-600' };
      case 'patient_complete':
        return { icon: FiCheckCircle, label: '환자 종결 처리', color: 'text-green-600' };
      case 'patient_complete_cancel':
        return { icon: FiClock, label: '환자 종결 취소', color: 'text-orange-600' };
        
      // 콜백 관련 액션들 추가 (모든 콜백 액션 포함)
      case 'callback_create':
        return { icon: FiPhone, label: '콜백 등록', color: 'text-purple-600' };
      case 'callback_update':
        return { icon: FiEdit, label: '콜백 수정', color: 'text-blue-600' };
      case 'callback_complete':
        return { icon: FiCheckCircle, label: '콜백 완료', color: 'text-green-600' };
      case 'callback_cancel':
        return { icon: FiTrash, label: '콜백 취소', color: 'text-orange-600' };
      case 'callback_delete':
        return { icon: FiTrash, label: '콜백 삭제', color: 'text-red-600' };
      case 'callback_reschedule':
        return { icon: FiClock, label: '콜백 일정변경', color: 'text-blue-600' };
        
      // 메시지 관련 액션들 추가
      case 'message_send':
        return { icon: FiMessageSquare, label: '메시지 발송', color: 'text-cyan-600' };
      case 'message_template_used':
        return { icon: FiMessageSquare, label: '템플릿 메시지', color: 'text-cyan-500' };
        
      // 기존 액션들
      case 'patient_status_change':
        return { icon: FiEdit, label: '환자 상태 변경', color: 'text-blue-600' };
      case 'visit_confirmation_toggle':
        return { icon: FiUserCheck, label: '내원 확정', color: 'text-indigo-600' };
      case 'event_target_create':
        return { icon: FiTarget, label: '이벤트 타겟 등록', color: 'text-purple-600' };
      case 'event_target_update':
        return { icon: FiEdit, label: '이벤트 타겟 수정', color: 'text-blue-600' };
      case 'event_target_delete':
        return { icon: FiTrash, label: '이벤트 타겟 삭제', color: 'text-red-600' };
      default:
        return { icon: FiClock, label: action, color: 'text-gray-600' };
    }
  };

  // 날짜 및 시간 포맷팅 함수
  const formatDateTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format(date, 'MM-dd HH:mm', { locale: ko });
    } catch {
      return '알 수 없음';
    }
  };

  // 액션별 상세 정보 표시 함수 (콜백/메시지 관련 정보 추가)
  const getActionDetails = (log: ActivityLog) => {
    const details = log.details;
    
    // 콜백 관련 상세 정보
    if (log.action.includes('callback')) {
      let info = '';
      
      // 콜백 타입 정보
      if (details?.callbackType) {
        info += ` (${details.callbackType})`;
      }
      
      // 콜백 결과 정보
      if (details?.result && log.action === 'callback_complete') {
        const resultMap: { [key: string]: string } = {
          '완료': '상담 완료',
          '부재중': '부재중',
          '예약확정': '예약 확정',
          '종결처리': '종결 처리',
          '이벤트타겟설정': '이벤트 타겟 설정'
        };
        const resultText = resultMap[details.result] || details.result;
        info += ` → ${resultText}`;
      }
      
      // 다음 단계 정보
      if (details?.nextStep && log.action === 'callback_complete') {
        const nextStepMap: { [key: string]: string } = {
          '2차_콜백': '2차 콜백',
          '3차_콜백': '3차 콜백',
          '4차_콜백': '4차 콜백',
          '5차_콜백': '5차 콜백',
          '예약_확정': '예약 확정',
          '종결_처리': '종결 처리',
          '이벤트_타겟_설정': '이벤트 타겟'
        };
        const nextStepText = nextStepMap[details.nextStep] || details.nextStep;
        info += ` → ${nextStepText}`;
      }
      
      // 취소 사유
      if (details?.cancelReason && log.action === 'callback_cancel') {
        info += ` (${details.cancelReason})`;
      }
      
      return info;
    }
    
    // 메시지 관련 상세 정보
    if (log.action.includes('message')) {
      let info = '';
      
      // 메시지 타입
      if (details?.messageType) {
        info += ` (${details.messageType})`;
      }
      
      // 발송 대상 수
      if (details?.recipientCount && details.recipientCount > 1) {
        info += ` → ${details.recipientCount}명`;
      }
      
      // 템플릿 이름
      if (details?.templateName && log.action === 'message_template_used') {
        info += ` → ${details.templateName}`;
      }
      
      // 성공/실패 정보
      if (details?.successCount !== undefined && details?.totalRecipients !== undefined) {
        const successRate = Math.round((details.successCount / details.totalRecipients) * 100);
        info += ` → 성공률 ${successRate}%`;
      }
      
      return info;
    }
    
    // 환자 정보 수정 - 변경사항 상세 표시
    if (log.action === 'patient_update') {
      if (details?.changeDetails) {
        return ` (${details.changeDetails})`;
      }
      // 이전 버전 호환성을 위한 fallback
      if (details?.notes && details.notes.includes('환자 정보 수정:')) {
        const changeInfo = details.notes.replace('환자 정보 수정:', '').trim();
        return changeInfo ? ` (${changeInfo})` : '';
      }
      return '';
    }
    
    // 상태 변경 정보
    if (log.action === 'patient_status_change') {
      if (details?.previousStatus && details?.newStatus) {
        return ` (${details.previousStatus} → ${details.newStatus})`;
      }
    }
    
    // 내원 확정 정보
    if (log.action === 'visit_confirmation_toggle') {
      if (details?.newStatus) {
        return details.newStatus === '내원확정' ? ' (확정)' : ' (취소)';
      }
    }
    
    // 이벤트 타겟 관련 정보
    if (log.action.includes('event_target')) {
      if (details?.targetReason) {
        return ` (${details.targetReason})`;
      }
    }
    
    return '';
  };

  // 액션의 중요도에 따른 스타일링 (콜백/메시지 액션들 추가)
  const getActionPriority = (action: string) => {
    const highPriorityActions = [
      'patient_create', 
      'callback_complete', 
      'patient_complete',
      'callback_create',  // 콜백 등록도 높은 우선순위
      'message_send'      // 메시지 발송도 높은 우선순위
    ];
    const mediumPriorityActions = [
      'patient_update', 
      'patient_status_change',
      'callback_update',  // 콜백 수정
      'callback_cancel',  // 콜백 취소
      'message_template_used'  // 템플릿 사용
    ];
    
    if (highPriorityActions.includes(action)) {
      return 'font-medium';
    } else if (mediumPriorityActions.includes(action)) {
      return 'font-normal';
    }
    return 'font-normal text-gray-600';
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="cursor-pointer"
      >
        {children}
      </div>

      {/* 툴팁 */}
      {isVisible && (
        <div 
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 z-50"
          onMouseEnter={cancelHideTooltip}
          onMouseLeave={hideTooltip}
        >
          {/* 🔥 툴팁 크기 및 스크롤 개선 */}
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[450px] max-w-[600px] w-max">
            {/* 툴팁 헤더 */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <FiUser className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{patientName}</div>
                <div className="text-xs text-gray-500">
                  활동 이력 
                  {/* 🔥 새로고침 트리거 표시 (디버깅용) */}
                  {refreshTrigger > 0 && (
                    <span className="ml-1 text-green-600">(업데이트됨)</span>
                  )}
                </div>
              </div>
            </div>

            {/* 이력 내용 */}
            <div>
              {historyData.isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-xs text-gray-500">불러오는 중...</span>
                </div>
              ) : historyData.error ? (
                <div className="text-center py-4">
                  <div className="text-red-500 text-xs">{historyData.error}</div>
                </div>
              ) : historyData.logs.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-gray-500 text-xs">활동 이력이 없습니다.</div>
                  <div className="text-gray-400 text-xs mt-1">
                    환자 등록, 콜백 처리, 메시지 발송 등의 활동이 기록됩니다.
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* 최대 높이 제한 및 스크롤 추가 */}
                  <div className="max-h-[300px] overflow-y-auto pr-1">
                    {historyData.logs.map((log, index) => {
                      const actionInfo = getActionInfo(log.action);
                      const additionalInfo = getActionDetails(log);
                      const priorityStyle = getActionPriority(log.action);
                      
                      return (
                        <div key={log._id || index} className="flex items-start justify-between py-1.5 hover:bg-gray-50 rounded text-xs gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="font-mono text-gray-500 text-[10px] min-w-[70px] flex-shrink-0">
                              {formatDateTime(log.timestamp)}
                            </div>
                            <div className={`${actionInfo.color} ${priorityStyle} flex-1 leading-relaxed`}>
                              <span className="break-words">
                                {actionInfo.label}
                                {additionalInfo && (
                                  <span className="text-blue-600 font-medium">{additionalInfo}</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="text-gray-500 font-medium text-[10px] flex-shrink-0">
                            @{log.userName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 더보기 버튼 */}
                  {historyData.hasMore && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                      <button 
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed"
                        onClick={loadMoreHistory}
                        disabled={historyData.isLoading}
                      >
                        {historyData.isLoading ? '불러오는 중...' : '더 많은 이력 보기 →'}
                      </button>
                    </div>
                  )}
                  
                  {/* 총 개수 표시 */}
                  {historyData.logs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                      <div className="text-[10px] text-gray-400">
                        총 {historyData.logs.length}개의 활동 이력
                        {historyData.logs.length !== historyData.totalCount && 
                          ` (중복 제거됨)`
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 툴팁 화살표 */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white"></div>
            <div className="absolute top-[-5px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200"></div>
          </div>
        </div>
      )}
    </div>
  );
}