// src/components/management/PatientTooltip.tsx - 툴팁 잘림 현상 해결

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
  refreshTrigger?: number;
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
  'patient_view',
  'message_log_view',
  'login',
  'logout',
];

// 중복 로그 제거 함수
const removeDuplicateLogs = (logs: ActivityLog[]): ActivityLog[] => {
  const seen = new Set<string>();
  
  return logs.filter(log => {
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

// 중요한 액션들만 필터링하는 함수
const filterImportantActions = (logs: ActivityLog[]): ActivityLog[] => {
  const filtered = logs.filter(log => {
    if (EXCLUDED_ACTIONS.includes(log.action)) {
      return false;
    }
    return true;
  });
  
  return removeDuplicateLogs(filtered);
};

export default function PatientTooltip({ 
  patientId, 
  patientName, 
  children, 
  className = "",
  refreshTrigger = 0
}: PatientTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [historyData, setHistoryData] = useState<PatientHistoryData>({
    logs: [],
    isLoading: false,
    hasMore: false,
    currentPage: 1,
    totalCount: 0
  });
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  // 🔥 툴팁 위치 상태 추가
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // refreshTrigger가 변경되면 데이터 강제 새로고침
  useEffect(() => {
    if (refreshTrigger > 0 && isVisible) {
      console.log('🔥 PatientTooltip: 외부 트리거로 새로고침', { 
        patientId, 
        patientName, 
        refreshTrigger 
      });
      fetchPatientHistory(1, false, true);
    }
  }, [refreshTrigger, isVisible, patientId]);

  // 🔥 마우스 위치 기반 툴팁 표시
  const showTooltip = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    
    // 뷰포트 크기 가져오기
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 툴팁 예상 크기 (실제 크기는 다를 수 있지만 대략적으로)
    const tooltipWidth = 500;
    const tooltipHeight = 400;
    
    // 기본 위치는 마우스 커서 위
    let x = rect.left + rect.width / 2;
    let y = rect.top;
    
    // 오른쪽으로 넘어가면 왼쪽으로 이동
    if (x + tooltipWidth / 2 > viewportWidth - 20) {
      x = viewportWidth - tooltipWidth / 2 - 20;
    }
    
    // 왼쪽으로 넘어가면 오른쪽으로 이동
    if (x - tooltipWidth / 2 < 20) {
      x = tooltipWidth / 2 + 20;
    }
    
    // 위로 넘어가면 아래쪽에 표시
    if (y - tooltipHeight < 20) {
      y = rect.bottom + 10; // 마우스 아래쪽에 표시
    }
    
    setTooltipPosition({ x, y });
    
    const id = setTimeout(() => {
      setIsVisible(true);
      fetchPatientHistory(1, false, false);
    }, 800);
    setTimeoutId(id);
  };

  // 툴팁 숨김 함수
  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const hideId = setTimeout(() => {
      setIsVisible(false);
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

  // 환자 편집 이력 가져오기
  const fetchPatientHistory = async (page: number = 1, append: boolean = false, forceRefresh: boolean = false) => {
    if (!append && !forceRefresh && historyData.logs.length > 0 && page === 1) return;

    setHistoryData(prev => ({ ...prev, isLoading: true }));

    try {
      const token = localStorage.getItem('token');
      const limit = 100;
      const skip = (page - 1) * limit;
      
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
      
      const allLogs = data.logs || [];
      const filteredLogs = filterImportantActions(allLogs);
      
      console.log('🔍 활동 로그 필터링 결과:', {
        patientId,
        patientName,
        total: allLogs.length,
        filtered: filteredLogs.length,
        duplicatesRemoved: allLogs.length - filteredLogs.length,
        forceRefresh,
        actions: filteredLogs.map(log => ({ 
          action: log.action, 
          source: log.source,
          user: log.userName,
          time: log.timestamp.substring(11, 16)
        }))
      });
      
      setHistoryData(prev => ({
        logs: append ? [...prev.logs, ...filteredLogs] : filteredLogs,
        isLoading: false,
        hasMore: data.hasNext || false,
        currentPage: page,
        totalCount: filteredLogs.length
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

  // 액션별 아이콘 및 라벨 가져오기
  const getActionInfo = (action: string) => {
    switch (action) {
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
      case 'message_send':
        return { icon: FiMessageSquare, label: '메시지 발송', color: 'text-cyan-600' };
      case 'message_template_used':
        return { icon: FiMessageSquare, label: '템플릿 메시지', color: 'text-cyan-500' };
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

  // 액션별 상세 정보 표시 함수
  const getActionDetails = (log: ActivityLog) => {
    const details = log.details;
    
    if (log.action.includes('callback')) {
      let info = '';
      
      if (details?.callbackType) {
        info += ` (${details.callbackType})`;
      }
      
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
      
      if (details?.cancelReason && log.action === 'callback_cancel') {
        info += ` (${details.cancelReason})`;
      }
      
      return info;
    }
    
    if (log.action.includes('message')) {
      let info = '';
      
      if (details?.messageType) {
        info += ` (${details.messageType})`;
      }
      
      if (details?.recipientCount && details.recipientCount > 1) {
        info += ` → ${details.recipientCount}명`;
      }
      
      if (details?.templateName && log.action === 'message_template_used') {
        info += ` → ${details.templateName}`;
      }
      
      if (details?.successCount !== undefined && details?.totalRecipients !== undefined) {
        const successRate = Math.round((details.successCount / details.totalRecipients) * 100);
        info += ` → 성공률 ${successRate}%`;
      }
      
      return info;
    }
    
    if (log.action === 'patient_update') {
      if (details?.changeDetails) {
        return ` (${details.changeDetails})`;
      }
      if (details?.notes && details.notes.includes('환자 정보 수정:')) {
        const changeInfo = details.notes.replace('환자 정보 수정:', '').trim();
        return changeInfo ? ` (${changeInfo})` : '';
      }
      return '';
    }
    
    if (log.action === 'patient_status_change') {
      if (details?.previousStatus && details?.newStatus) {
        return ` (${details.previousStatus} → ${details.newStatus})`;
      }
    }
    
    if (log.action === 'visit_confirmation_toggle') {
      if (details?.newStatus) {
        return details.newStatus === '내원확정' ? ' (확정)' : ' (취소)';
      }
    }
    
    if (log.action.includes('event_target')) {
      if (details?.targetReason) {
        return ` (${details.targetReason})`;
      }
    }
    
    return '';
  };

  // 액션의 중요도에 따른 스타일링
  const getActionPriority = (action: string) => {
    const highPriorityActions = [
      'patient_create', 
      'callback_complete', 
      'patient_complete',
      'callback_create',
      'message_send'
    ];
    const mediumPriorityActions = [
      'patient_update', 
      'patient_status_change',
      'callback_update',
      'callback_cancel',
      'message_template_used'
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

      {/* 🔥 Portal을 사용한 툴팁 - fixed 위치로 테이블 바운더리 무시 */}
      {isVisible && (
        <div 
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)', // 중앙 정렬 및 위로 이동
          }}
          onMouseEnter={cancelHideTooltip}
          onMouseLeave={hideTooltip}
        >
          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 min-w-[450px] max-w-[600px] w-max mb-2 pointer-events-auto">
            {/* 툴팁 헤더 */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <FiUser className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{patientName}</div>
                <div className="text-xs text-gray-500">
                  활동 이력 
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

          {/* 🔥 툴팁 화살표 - 위치 조정 */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white"></div>
            <div className="absolute top-[-5px] left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200"></div>
          </div>
        </div>
      )}
    </div>
  );
}