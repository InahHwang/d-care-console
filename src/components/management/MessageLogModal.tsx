// src/components/management/MessageLogModal.tsx
'use client'

import { clearMessageLogs } from '@/store/slices/messageLogsSlice';
import { useState, useEffect, useMemo } from 'react'
import { useAppSelector, useAppDispatch } from '@/hooks/reduxHooks'
import { 
  initializeLogs, 
  setFilters, 
  resetFilters, 
  setSort,
  selectFilteredLogs 
} from '@/store/slices/messageLogsSlice'
import { 
  MessageLog, 
  MessageStatus, 
  MessageType,
  MessageLogSort,
  SortDirection
} from '@/types/messageLog'
import { EventCategory } from '@/store/slices/patientsSlice'
import { 
  formatMessageDate, 
  getMessagePreview, 
  getStatusText,
  getMessageTypeText,
  getCategoryText
} from '@/utils/messageLogUtils'
import { 
  HiOutlineX, 
  HiOutlineSearch, 
  HiOutlineCalendar, 
  HiOutlineAdjustments,
  HiOutlineCheck,
  HiOutlineExclamationCircle,
  HiOutlineDocumentText,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineFilter,
  HiOutlineRefresh,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineTemplate
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { format, subDays } from 'date-fns'

interface MessageLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId?: string; // 특정 환자의 로그만 표시할 경우
    embedded?: boolean; // 내장 모드 여부 (탭에 직접 표시)
}

// 페이지 크기 옵션
const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function MessageLogModal({ isOpen, onClose, patientId, embedded = false }: MessageLogModalProps) {
  const dispatch = useAppDispatch();
  const allLogs = useAppSelector(selectFilteredLogs);
  const filters = useAppSelector(state => state.messageLogs.filters);
  const sortOptions = useAppSelector(state => state.messageLogs.sort);
  
  // 로컬 상태
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // 페이지네이션 계산
  const totalPages = Math.ceil(allLogs.length / pageSize);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return allLogs.slice(startIndex, startIndex + pageSize);
  }, [allLogs, currentPage, pageSize]);
  
  // 통계 계산
  const stats = useMemo(() => {
    const total = allLogs.length;
    const successful = allLogs.filter(log => log.status === 'success').length;
    const failed = total - successful;
    const smsCount = allLogs.filter(log => log.messageType === 'SMS').length;
    const lmsCount = allLogs.filter(log => log.messageType === 'LMS').length;
    
    return { total, successful, failed, smsCount, lmsCount };
  }, [allLogs]);
  
  // 필터 핸들러
  const handleFilterChange = (filterName: keyof typeof filters, value: any) => {
    dispatch(setFilters({ [filterName]: value }));
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  };
  
  const handleClearLogs = () => {
    if (confirm('모든 메시지 발송 내역을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      dispatch(clearMessageLogs());
    }
  };  

  // 날짜 필터 빠른 선택
  const handleQuickDateFilter = (days: number) => {
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    
    dispatch(setFilters({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    }));
    setCurrentPage(1);
  };
  
  // 상태 필터 토글
  const toggleStatusFilter = (status: MessageStatus) => {
    const newStatuses = [...filters.statuses];
    const index = newStatuses.indexOf(status);
    
    if (index === -1) {
      newStatuses.push(status);
    } else {
      newStatuses.splice(index, 1);
    }
    
    dispatch(setFilters({ statuses: newStatuses }));
    setCurrentPage(1);
  };
  
  // 메시지 타입 필터 토글
  const toggleMessageTypeFilter = (type: MessageType) => {
    const newTypes = [...filters.messageTypes];
    const index = newTypes.indexOf(type);
    
    if (index === -1) {
      newTypes.push(type);
    } else {
      newTypes.splice(index, 1);
    }
    
    dispatch(setFilters({ messageTypes: newTypes }));
    setCurrentPage(1);
  };
  
  // 카테고리 필터 토글
  const toggleCategoryFilter = (category: EventCategory) => {
    const newCategories = [...filters.categories];
    const index = newCategories.indexOf(category);
    
    if (index === -1) {
      newCategories.push(category);
    } else {
      newCategories.splice(index, 1);
    }
    
    dispatch(setFilters({ categories: newCategories }));
    setCurrentPage(1);
  };
  
  // 정렬 변경
  const handleSort = (field: MessageLogSort['field']) => {
    const direction: SortDirection = 
      sortOptions.field === field && sortOptions.direction === 'desc' ? 'asc' : 'desc';
      
    dispatch(setSort({ field, direction }));
  };
  
  // 필터 초기화
  const handleResetFilters = () => {
    dispatch(resetFilters());
    setCurrentPage(1);
  };
  
  // 상세 정보 모달 열기
  const handleOpenDetail = (log: MessageLog) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };
  
  // 상세 정보 모달 닫기
  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setSelectedLog(null);
  };
  
  // 컴포넌트 마운트 시 로그 초기화
  useEffect(() => {
    if (isOpen) {
      dispatch(initializeLogs());
      
      // 특정 환자의 로그만 표시
      if (patientId) {
        dispatch(setFilters({ searchTerm: '' })); // 기존 검색어 초기화
        // 환자 ID로 필터링하는 로직은 추가 구현 필요
      }
    }
  }, [dispatch, isOpen, patientId]);
  
  // 모달이 닫히면 필터 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setFilterVisible(false);
      setDetailModalOpen(false);
      setSelectedLog(null);
      setCurrentPage(1);
    }
  }, [isOpen]);
  
  if (!isOpen && !embedded) return null;

  // 내장 모드에 따라 스타일 변경
  const containerClassName = embedded 
    ? "" // 탭에 내장된 경우 배경과 padding 없음
    : "fixed inset-0 bg-black/30 flex items-center justify-center z-[70] p-4";
  
  const contentClassName = embedded
    ? "bg-white rounded-lg w-full max-h-full" // 내장 모드에서는 최대 너비 제한 없음
    : "bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col";

  return (
    <div className={containerClassName}>
      <div className={contentClassName}>
        {/* 헤더 - 내장 모드일 때는 닫기 버튼 숨김 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-semibold text-text-primary">
            {patientId ? '환자 문자 내역' : '문자 발송 내역'}
          </h3>
          <div className="flex items-center gap-2">
            {/* 임시로 운영 환경에서도 표시 - 테스트 로그 삭제 후 다시 원복 예정 */}
            {(process.env.NODE_ENV === 'development' || true) && (
              <button
                className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-100 text-red-700 flex items-center gap-1"
                onClick={handleClearLogs}
                title="개발용: 모든 메시지 로그 초기화"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                로그 초기화 (임시)
              </button>
            )}

            <button
              className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-100 flex items-center gap-1"
              onClick={() => setFilterVisible(!filterVisible)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {filterVisible ? '필터 숨기기' : '필터 표시'}
            </button>
            {/* 내장 모드가 아닐 때만 닫기 버튼 표시 */}
            {!embedded && (
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={onClose}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* 필터 영역 */}
        {filterVisible && (
          <div className="px-6 py-4 border-b border-border bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 검색어 필터 */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  환자명/전화번호 검색
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="pl-9 pr-4 py-2 w-full bg-white border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="환자명 또는 전화번호 입력"
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  />
                  <Icon 
                    icon={HiOutlineSearch} 
                    size={16} 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
                  />
                </div>
              </div>
              
              {/* 날짜 필터 */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  기간 선택
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      className="pl-9 pr-4 py-2 w-full bg-white border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={filters.startDate || ''}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    />
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={16} 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
                    />
                  </div>
                  <span className="text-text-muted">~</span>
                  <div className="relative flex-1">
                    <input
                      type="date"
                      className="pl-9 pr-4 py-2 w-full bg-white border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={filters.endDate || ''}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    />
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={16} 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button 
                    className="px-2 py-1 text-xs bg-white border border-border rounded-md hover:bg-gray-100"
                    onClick={() => handleQuickDateFilter(7)}
                  >
                    최근 7일
                  </button>
                  <button 
                    className="px-2 py-1 text-xs bg-white border border-border rounded-md hover:bg-gray-100"
                    onClick={() => handleQuickDateFilter(30)}
                  >
                    최근 30일
                  </button>
                  <button 
                    className="px-2 py-1 text-xs bg-white border border-border rounded-md hover:bg-gray-100"
                    onClick={() => handleQuickDateFilter(90)}
                  >
                    최근 90일
                  </button>
                </div>
              </div>
              
              {/* 메시지 타입 및 상태 필터 */}
              <div className="col-span-1">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    메시지 타입
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3 py-1 text-sm rounded-md ${
                        filters.messageTypes.includes('SMS')
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-white text-text-secondary border border-border hover:bg-gray-100'
                      }`}
                      onClick={() => toggleMessageTypeFilter('SMS')}
                    >
                      SMS
                    </button>
                    <button
                      className={`px-3 py-1 text-sm rounded-md ${
                        filters.messageTypes.includes('LMS')
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-white text-text-secondary border border-border hover:bg-gray-100'
                      }`}
                      onClick={() => toggleMessageTypeFilter('LMS')}
                    >
                      LMS
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    발송 상태
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`px-3 py-1 text-sm rounded-md ${
                        filters.statuses.includes('success')
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-white text-text-secondary border border-border hover:bg-gray-100'
                      }`}
                      onClick={() => toggleStatusFilter('success')}
                    >
                      성공
                    </button>
                    <button
                      className={`px-3 py-1 text-sm rounded-md ${
                        filters.statuses.includes('failed')
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-white text-text-secondary border border-border hover:bg-gray-100'
                      }`}
                      onClick={() => toggleStatusFilter('failed')}
                    >
                      실패
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
              <div className="text-sm text-text-secondary">
                <span className="font-medium">{allLogs.length}</span>개의 발송 내역 중 필터에 해당되는 항목
              </div>
              <button
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary flex items-center gap-1"
                onClick={handleResetFilters}
              >
                <Icon icon={HiOutlineRefresh} size={16} />
                필터 초기화
              </button>
            </div>
          </div>
        )}
        
        {/* 통계 영역 */}
        <div className="px-6 py-3 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 px-4 py-2 rounded-md">
              <div className="text-xs text-text-secondary">총 발송</div>
              <div className="text-lg font-semibold">{stats.total}건</div>
            </div>
            <div className="bg-green-50 px-4 py-2 rounded-md">
              <div className="text-xs text-green-700">성공</div>
              <div className="text-lg font-semibold text-green-700">
                {stats.successful}건
                {stats.total > 0 && (
                  <span className="text-xs font-normal ml-1">
                    ({Math.round((stats.successful / stats.total) * 100)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="bg-red-50 px-4 py-2 rounded-md">
              <div className="text-xs text-red-700">실패</div>
              <div className="text-lg font-semibold text-red-700">
                {stats.failed}건
                {stats.total > 0 && (
                  <span className="text-xs font-normal ml-1">
                    ({Math.round((stats.failed / stats.total) * 100)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="bg-blue-50 px-4 py-2 rounded-md">
              <div className="text-xs text-blue-700">SMS</div>
              <div className="text-lg font-semibold text-blue-700">
                {stats.smsCount}건
              </div>
            </div>
            <div className="bg-purple-50 px-4 py-2 rounded-md">
              <div className="text-xs text-purple-700">LMS</div>
              <div className="text-lg font-semibold text-purple-700">
                {stats.lmsCount}건
              </div>
            </div>
          </div>
        </div>
        
        {/* 내용 영역 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[800px] table-auto">
            <thead className="bg-light-bg sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button 
                    className="flex items-center"
                    onClick={() => handleSort('createdAt')}
                  >
                    발송 일시
                    {sortOptions.field === 'createdAt' && (
                      <Icon 
                        icon={sortOptions.direction === 'asc' ? HiOutlineChevronUp : HiOutlineChevronDown} 
                        size={16} 
                        className="ml-1" 
                      />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button 
                    className="flex items-center"
                    onClick={() => handleSort('patientName')}
                  >
                    환자명
                    {sortOptions.field === 'patientName' && (
                      <Icon 
                        icon={sortOptions.direction === 'asc' ? HiOutlineChevronUp : HiOutlineChevronDown} 
                        size={16} 
                        className="ml-1" 
                      />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">전화번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">메시지 내용</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">타입</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">템플릿</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">
                  <button 
                    className="flex items-center"
                    onClick={() => handleSort('status')}
                  >
                    상태
                    {sortOptions.field === 'status' && (
                      <Icon 
                        icon={sortOptions.direction === 'asc' ? HiOutlineChevronUp : HiOutlineChevronDown} 
                        size={16} 
                        className="ml-1" 
                      />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">액션</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    {allLogs.length === 0 ? (
                      '발송된 메시지가 없습니다.'
                    ) : (
                      '조건에 맞는 메시지가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className={`border-b border-border last:border-0 hover:bg-gray-50 ${
                      log.status === 'failed' ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {formatMessageDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-text-primary">
                      {log.patientName}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {log.phoneNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {getMessagePreview(log.content, 30)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.messageType === 'SMS' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {getMessageTypeText(log.messageType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {log.templateName || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        log.status === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status === 'success' ? (
                          <Icon icon={HiOutlineCheck} size={12} className="mr-1" />
                        ) : (
                          <Icon icon={HiOutlineExclamationCircle} size={12} className="mr-1" />
                        )}
                        {getStatusText(log.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-text-primary hover:bg-gray-200 transition-colors"
                        onClick={() => handleOpenDetail(log)}
                        title="상세 정보"
                      >
                        <Icon icon={HiOutlineDocumentText} size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* 페이지네이션 */}
        {allLogs.length > 0 && (
          <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-text-secondary">
              총 {allLogs.length}개 항목 중 {Math.min((currentPage - 1) * pageSize + 1, allLogs.length)}-{Math.min(currentPage * pageSize, allLogs.length)} 표시
            </div>
            
            <div className="flex items-center gap-4">
              <select
                className="px-2 py-1 bg-white border border-border rounded-md text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}개씩 보기</option>
                ))}
              </select>
              
              <div className="flex items-center gap-2 bg-light-bg px-2 py-1 rounded-md">
                <button
                  className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <Icon icon={HiOutlineChevronLeft} size={18} />
                </button>
                
                <span className="text-sm text-text-primary px-2">
                  {currentPage} / {totalPages || 1}
                </span>
                
                <button
                  className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <Icon icon={HiOutlineChevronRight} size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 메시지 상세 정보 모달 */}
      {detailModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h4 className="text-lg font-semibold text-text-primary">
                메시지 상세 정보
              </h4>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={handleCloseDetail}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1">
                  <h5 className="text-sm font-medium text-text-secondary mb-3 flex items-center">
                    <Icon icon={HiOutlineUser} size={16} className="mr-1.5 text-blue-600" />
                    환자 정보
                  </h5>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-text-secondary">환자명</p>
                      <p className="text-sm font-medium">{selectedLog.patientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">전화번호</p>
                      <p className="text-sm">{selectedLog.phoneNumber}</p>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-1">
                  <h5 className="text-sm font-medium text-text-secondary mb-3 flex items-center">
                    <Icon icon={HiOutlineMail} size={16} className="mr-1.5 text-blue-600" />
                    발송 정보
                  </h5>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-text-secondary">발송 일시</p>
                      <p className="text-sm">{formatMessageDate(selectedLog.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">발송 상태</p>
                      <p className="text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedLog.status === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {getStatusText(selectedLog.status)}
                        </span>
                      </p>
                    </div>
                    {selectedLog.messageId && (
                      <div>
                        <p className="text-xs text-text-secondary">메시지 ID</p>
                        <p className="text-sm text-text-muted break-all">{selectedLog.messageId}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <h5 className="text-sm font-medium text-text-secondary mb-3 flex items-center">
                  <Icon icon={HiOutlineTemplate} size={16} className="mr-1.5 text-blue-600" />
                  메시지 내용
                </h5>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div>
                      <p className="text-xs text-text-secondary">타입</p>
                      <p className="text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedLog.messageType === 'SMS' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {selectedLog.messageType}
                        </span>
                      </p>
                    </div>
                    {selectedLog.templateName && (
                      <div className="ml-4">
                        <p className="text-xs text-text-secondary">사용 템플릿</p>
                        <p className="text-sm">{selectedLog.templateName}</p>
                      </div>
                    )}
                    {selectedLog.category && (
                      <div className="ml-4">
                        <p className="text-xs text-text-secondary">카테고리</p>
                        <p className="text-sm">{getCategoryText(selectedLog.category)}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">내용</p>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border border-border text-sm whitespace-pre-line">
                      {selectedLog.content}
                    </div>
                  </div>
                  {selectedLog.status === 'failed' && selectedLog.errorMessage && (
                    <div>
                      <p className="text-xs text-red-600">에러 메시지</p>
                      <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 mt-1 whitespace-pre-line">
                        {selectedLog.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                onClick={handleCloseDetail}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}