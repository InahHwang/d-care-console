// src/components/management/CallHistory.tsx
'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMessageLogs, selectFilteredLogs, setFilters, resetFilters, setSort } from '@/store/slices/messageLogsSlice'
import { format } from 'date-fns'
import { MessageStatus, MessageType } from '@/types/messageLog'
import { AppDispatch, RootState } from '@/store'

// 상태 뱃지 컴포넌트
const StatusBadge = ({ status }: { status: MessageStatus }) => {
  const colorMap = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorMap[status]}`}>
      {status === 'success' ? '성공' : status === 'failed' ? '실패' : '대기중'}
    </span>
  )
}

// 메시지 타입 뱃지 컴포넌트
const MessageTypeBadge = ({ type }: { type: MessageType }) => {
  const colorMap = {
    SMS: 'bg-blue-100 text-blue-800',
    LMS: 'bg-purple-100 text-purple-800',
    MMS: 'bg-indigo-100 text-indigo-800',
    RCS: 'bg-teal-100 text-teal-800'
  }

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorMap[type]}`}>
      {type}
    </span>
  )
}

export default function CallHistory() {
  const dispatch = useDispatch<AppDispatch>()
  const { logs, isLoading, error, filters, sort } = useSelector((state: RootState) => state.messageLogs)
  const filteredLogs = useSelector(selectFilteredLogs)
  
  // 날짜 필터링을 위한 상태
  const [dateRange, setDateRange] = useState({
    startDate: filters.startDate || '',
    endDate: filters.endDate || ''
  })
  
  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    dispatch(fetchMessageLogs())
  }, [dispatch])
  
  // 필터 변경 핸들러
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    if (name === 'startDate' || name === 'endDate') {
      setDateRange({
        ...dateRange,
        [name]: value
      })
      
      // 날짜 필터는 즉시 적용하지 않고, 둘 다 설정되었을 때 적용
      if (name === 'startDate' && dateRange.endDate) {
        dispatch(setFilters({ startDate: value, endDate: dateRange.endDate }))
      } else if (name === 'endDate' && dateRange.startDate) {
        dispatch(setFilters({ startDate: dateRange.startDate, endDate: value }))
      }
    } else {
      dispatch(setFilters({ [name]: value }))
    }
  }
  
  // 필터 초기화 핸들러
  const handleResetFilters = () => {
    dispatch(resetFilters())
    setDateRange({ startDate: '', endDate: '' })
  }
  
  // 정렬 변경 핸들러
  const handleSortChange = (field: string) => {
    // 같은 필드를 클릭한 경우 정렬 방향 전환
    const direction = sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc'
    dispatch(setSort({ field: field as any, direction }))
  }
  
  // 메시지 타입 필터 변경 핸들러
  const handleMessageTypeFilterChange = (type: MessageType) => {
    const currentTypes = [...filters.messageTypes]
    
    if (currentTypes.includes(type)) {
      // 이미 있으면 제거
      const updatedTypes = currentTypes.filter(t => t !== type)
      dispatch(setFilters({ messageTypes: updatedTypes }))
    } else {
      // 없으면 추가
      dispatch(setFilters({ messageTypes: [...currentTypes, type] }))
    }
  }
  
  // 상태 필터 변경 핸들러
  const handleStatusFilterChange = (status: MessageStatus) => {
    const currentStatuses = [...filters.statuses]
    
    if (currentStatuses.includes(status)) {
      // 이미 있으면 제거
      const updatedStatuses = currentStatuses.filter(s => s !== status)
      dispatch(setFilters({ statuses: updatedStatuses }))
    } else {
      // 없으면 추가
      dispatch(setFilters({ statuses: [...currentStatuses, status] }))
    }
  }
  
  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-lg">데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-600">오류 발생</h3>
            <p className="mt-2 text-text-secondary">{error}</p>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
              onClick={() => dispatch(fetchMessageLogs())}
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (logs.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-text-primary">통화 기록이 없습니다</h3>
            <p className="mt-2 text-text-secondary">
              아직 기록된 통화 내역이 없습니다.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-6">통화 기록</h2>
      
      {/* 필터링 영역 */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* 검색 */}
          <div>
            <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <input
              type="text"
              id="searchTerm"
              name="searchTerm"
              value={filters.searchTerm}
              onChange={handleFilterChange}
              placeholder="환자명, 전화번호 또는 내용 검색"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          {/* 날짜 범위 */}
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              시작일
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleFilterChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              종료일
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleFilterChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        {/* 필터 버튼 그룹 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="mr-4">
            <span className="text-sm font-medium text-gray-700 mr-2">메시지 타입:</span>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleMessageTypeFilterChange('SMS')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filters.messageTypes.includes('SMS') 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                SMS
              </button>
              <button
                onClick={() => handleMessageTypeFilterChange('LMS')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filters.messageTypes.includes('LMS') 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                LMS
              </button>
              <button
                onClick={() => handleMessageTypeFilterChange('MMS')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filters.messageTypes.includes('MMS') 
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                MMS
              </button>
            </div>
          </div>
          
          <div>
            <span className="text-sm font-medium text-gray-700 mr-2">상태:</span>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleStatusFilterChange('success')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filters.statuses.includes('success') 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                성공
              </button>
              <button
                onClick={() => handleStatusFilterChange('failed')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filters.statuses.includes('failed') 
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                실패
              </button>
              <button
                onClick={() => handleStatusFilterChange('pending')}
                className={`px-3 py-1 text-xs rounded-full ${
                  filters.statuses.includes('pending') 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                대기중
              </button>
            </div>
          </div>
        </div>
        
        {/* 필터 초기화 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleResetFilters}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            필터 초기화
          </button>
        </div>
      </div>
      
      {/* 통화 기록 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('createdAt')}
              >
                <div className="flex items-center">
                  날짜/시간
                  {sort.field === 'createdAt' && (
                    <span className="ml-1">
                      {sort.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('patientName')}
              >
                <div className="flex items-center">
                  환자명
                  {sort.field === 'patientName' && (
                    <span className="ml-1">
                      {sort.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                전화번호
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                메시지 유형
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                내용
              </th>
              <th 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('status')}
              >
                <div className="flex items-center">
                  상태
                  {sort.field === 'status' && (
                    <span className="ml-1">
                      {sort.direction === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{log.patientName}</div>
                  {log.category && (
                    <div className="text-xs text-gray-500">{log.category}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.phoneNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <MessageTypeBadge type={log.messageType} />
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate">
                    {log.content}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={log.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 페이지네이션 또는 '더 보기' 버튼 */}
      {filteredLogs.length > 0 && (
        <div className="mt-4 flex justify-center">
          <div className="text-sm text-gray-700">
            총 <span className="font-medium">{filteredLogs.length}</span>개의 기록 표시 중
            (전체 <span className="font-medium">{logs.length}</span>개)
          </div>
        </div>
      )}
      
      {/* 데이터가 없을 때 메시지 */}
      {filteredLogs.length === 0 && logs.length > 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">필터 조건에 맞는 기록이 없습니다.</p>
          <button
            onClick={handleResetFilters}
            className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            필터 초기화
          </button>
        </div>
      )}
    </div>
  )
}