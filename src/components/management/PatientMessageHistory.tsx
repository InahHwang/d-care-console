// src/components/management/PatientMessageHistory.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { 
  initializeLogs, 
  setFilters, 
  resetFilters, 
  selectPatientLogs,
  fetchMessageLogs,
  MessageLogFilters
} from '@/store/slices/messageLogsSlice'
import { 
  MessageLog, 
  MessageStatus, 
  MessageType 
} from '@/types/messageLog'
import { Patient } from '@/store/slices/patientsSlice'
import { EventCategory } from '@/types/messageLog'
import { 
  formatMessageDate, 
  getMessagePreview, 
  getStatusText,
  getMessageTypeText,
  getCategoryText
} from '@/utils/messageLogUtils'
import { format, subDays, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale/ko'

interface PatientMessageHistoryProps {
  patient: Patient;
}

// 페이지당 표시할 항목 수
const PAGE_SIZE = 5;

export default function PatientMessageHistory({ patient }: PatientMessageHistoryProps) {
  const dispatch = useAppDispatch();
  
  // 상태 관리
  const patientMessages = useAppSelector(state => selectPatientLogs(state, patient.id));
  const isLoading = useAppSelector(state => state.messageLogs.isLoading);
  const error = useAppSelector(state => state.messageLogs.error);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<MessageStatus | 'all'>('all');
  const [selectedMessage, setSelectedMessage] = useState<MessageLog | null>(null);
  
  // 전체 페이지 수 계산
  const totalPages = Math.ceil(patientMessages.length / PAGE_SIZE);
  
  // 현재 페이지에 표시할 메시지 목록
  const visibleMessages = patientMessages.slice(
    (currentPage - 1) * PAGE_SIZE, 
    currentPage * PAGE_SIZE
  );
  
  // 컴포넌트 마운트 시 로그 초기화 및 데이터 로드
  useEffect(() => {
    console.log('PatientMessageHistory 마운트 - 환자 ID:', patient.id);
    
    // 먼저 로컬 데이터 초기화
    dispatch(initializeLogs());
    
    // 메시지 로그 불러오기
    dispatch(fetchMessageLogs());
    
    // 환자 ID 또는 전화번호로 필터링하는 로직은 Redux 액션으로 처리
    const filterParams: Partial<MessageLogFilters> = {
      searchTerm: '', // 기존 검색어 초기화
      statuses: ['success', 'failed'] as MessageStatus[], // 타입 캐스팅 추가
      patientId: patient.id,
      phoneNumber: patient.phoneNumber
    };
    
    dispatch(setFilters(filterParams));
    
    // 언마운트 시 필터 초기화
    return () => {
      dispatch(resetFilters());
    };
  }, [dispatch, patient.id, patient.phoneNumber]);
  
  // 필터 변경 시 적용
  useEffect(() => {
    const filterParams: Partial<MessageLogFilters> = {
      searchTerm,
      startDate: startDate || undefined,
      statuses: statusFilter === 'all' 
        ? ['success', 'failed'] as MessageStatus[] 
        : [statusFilter],
      patientId: patient.id,
      phoneNumber: patient.phoneNumber
    };
    
    dispatch(setFilters(filterParams));
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  }, [dispatch, searchTerm, startDate, statusFilter, patient.id, patient.phoneNumber]);
  
  // 날짜 필터 빠른 선택 (최근 N일)
  const handleQuickDateFilter = (days: number) => {
    const date = subDays(new Date(), days);
    setStartDate(format(date, 'yyyy-MM-dd'));
  };
  
  // 메시지 상태 아이콘 컴포넌트
  const MessageStatusIcon = ({ status }: { status: MessageStatus }) => {
    if (status === 'success') {
      return (
        <span className="flex items-center text-green-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          성공
        </span>
      );
    }
    return (
      <span className="flex items-center text-red-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        실패
      </span>
    );
  };
  
  // 디버깅을 위한 출력
  useEffect(() => {
    console.log(`환자 메시지 수: ${patientMessages.length}`);
  }, [patientMessages]);
  
  return (
    <div className="space-y-4">
      {/* 검색 및 필터 영역 */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="문자 내용 검색"
            className="pl-10 pr-4 py-2 w-full bg-light-bg rounded-md text-sm focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <input
              type="date"
              className="pl-10 pr-4 py-2 bg-light-bg rounded-md text-sm focus:outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <select 
            className="px-4 py-2 bg-light-bg rounded-md text-sm focus:outline-none text-text-secondary"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MessageStatus | 'all')}
          >
            <option value="all">모든 상태</option>
            <option value="success">성공</option>
            <option value="failed">실패</option>
          </select>
        </div>
      </div>
      
      {/* 빠른 필터 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button 
          className="px-3 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          onClick={() => {
            setStartDate('');
            setStatusFilter('all');
            setSearchTerm('');
          }}
        >
          모든 내역
        </button>
        <button 
          className="px-3 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          onClick={() => handleQuickDateFilter(7)}
        >
          최근 7일
        </button>
        <button 
          className="px-3 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          onClick={() => handleQuickDateFilter(30)}
        >
          최근 30일
        </button>
        <button 
          className="px-3 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          onClick={() => handleQuickDateFilter(90)}
        >
          최근 90일
        </button>
      </div>
      
      {/* 로딩 및 오류 처리 */}
      {isLoading && (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          <p>{error}</p>
          <button 
            className="mt-2 text-sm underline"
            onClick={() => {
              dispatch(initializeLogs());
              dispatch(fetchMessageLogs());
            }}
          >
            다시 시도
          </button>
        </div>
      )}
      
      {/* 문자 목록 */}
      <div className="bg-white rounded-md border border-border">
        {!isLoading && patientMessages.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            발송된 문자 내역이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleMessages.map((message, index) => (
              <div 
                key={`${message.id}-${index}`} // 인덱스를 추가하여 고유키 생성
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedMessage?.id === message.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedMessage(message.id === selectedMessage?.id ? null : message)}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      message.messageType === 'SMS' 
                        ? 'bg-blue-100 text-blue-700' 
                        : message.messageType === 'MMS'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {getMessageTypeText(message.messageType)}
                    </span>
                    <MessageStatusIcon status={message.status} />
                  </div>
                  <div className="text-xs text-text-secondary">
                    {formatMessageDate(message.createdAt)}
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <p className="text-sm text-text-primary line-clamp-2">
                    {getMessagePreview(message.content, 50)}
                  </p>
                  
                  <button
                    className="ml-2 p-1 text-text-secondary hover:text-primary rounded-full hover:bg-gray-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMessage(message.id === selectedMessage?.id ? null : message);
                    }}
                    title="상세보기"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 페이지네이션 */}
      {patientMessages.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-text-secondary">
            총 {patientMessages.length}개 중 {patientMessages.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-
            {Math.min(currentPage * PAGE_SIZE, patientMessages.length)} 표시
          </div>
          
          <div className="flex items-center gap-2">
            <button
              className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <span className="text-sm text-text-primary px-2">
              {currentPage} / {totalPages || 1}
            </span>
            
            <button
              className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* 선택된 메시지 상세 정보 */}
      {selectedMessage && (
        <div className="card mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-text-primary flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              문자 상세 정보
            </h3>
            <button
              className="text-text-secondary hover:text-text-primary"
              onClick={() => setSelectedMessage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-text-secondary">발송 일시</p>
              <p className="text-text-primary">{formatMessageDate(selectedMessage.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">메시지 유형</p>
              <p className="text-text-primary">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedMessage.messageType === 'SMS' 
                    ? 'bg-blue-100 text-blue-700' 
                    : selectedMessage.messageType === 'MMS'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-green-100 text-green-700'
                }`}>
                  {getMessageTypeText(selectedMessage.messageType)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">상태</p>
              <MessageStatusIcon status={selectedMessage.status} />
            </div>
          </div>
          
          <div>
            <p className="text-sm text-text-secondary mb-1">내용</p>
            <div className="p-3 bg-gray-50 rounded-md text-text-primary whitespace-pre-line">
              {selectedMessage.content}
            </div>
          </div>
          
          {selectedMessage.imageUrl && (
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-1">첨부 이미지</p>
              <div className="p-3 bg-gray-50 rounded-md">
                <img 
                  src={selectedMessage.imageUrl} 
                  alt="첨부 이미지" 
                  className="max-w-full h-auto rounded-md"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            </div>
          )}
          
          {selectedMessage.status === 'failed' && selectedMessage.errorMessage && (
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-1">오류 메시지</p>
              <div className="p-3 bg-red-50 rounded-md text-red-600 text-sm whitespace-pre-line">
                {selectedMessage.errorMessage}
              </div>
            </div>
          )}
          
          {selectedMessage.templateName && (
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-1">사용된 템플릿</p>
              <div className="p-3 bg-blue-50 rounded-md text-blue-600 text-sm">
                {selectedMessage.templateName}
              </div>
            </div>
          )}
          
          {selectedMessage.category && (
            <div className="mt-4">
              <p className="text-sm text-text-secondary mb-1">카테고리</p>
              <div className="p-3 bg-green-50 rounded-md text-green-600 text-sm">
                {getCategoryText(selectedMessage.category as EventCategory)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}