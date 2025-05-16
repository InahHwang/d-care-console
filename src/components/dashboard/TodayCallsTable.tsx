'use client'

import { useState } from 'react'
import { Call, selectCall } from '@/store/slices/callsSlice'
import { IconType } from 'react-icons'
import { HiOutlineSearch, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineArrowUp } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { format } from 'date-fns'
import { useAppDispatch } from '@/hooks/reduxHooks'

interface TodayCallsTableProps {
  calls?: Call[]
  isLoading?: boolean
}

export default function TodayCallsTable({ calls = [], isLoading = false }: TodayCallsTableProps) {
  const dispatch = useAppDispatch()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<string>('전체')
  
  const itemsPerPage = 5
  
  // 검색 및 필터링된 콜 목록
  const filteredCalls = calls.filter(call => {
    const matchesSearch = 
      call.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.phoneNumber.includes(searchTerm)
    
    const matchesFilter = filter === '전체' || 
      (filter === '초기' && call.attemptCount === 0) || 
      (filter === '1차' && call.attemptCount === 1) || 
      (filter === '2차' && call.attemptCount === 2) || 
      (filter === '3차' && call.attemptCount === 3)
    
    return matchesSearch && matchesFilter
  })
  
  // 페이지네이션
  const totalPages = Math.ceil(filteredCalls.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedCalls = filteredCalls.slice(startIndex, startIndex + itemsPerPage)
  
  // 콜 디테일 페이지로 이동
  const handleViewCallDetails = (callId: string) => {
    dispatch(selectCall(callId))
    // TODO: 콜 디테일 모달 또는 페이지 열기
  }
  
  // 시도 횟수에 따른 배지 컬러
  const getAttemptBadgeColor = (attemptCount: number) => {
    switch (attemptCount) {
      case 0: return 'text-text-secondary'
      case 1: return 'bg-orange-100 text-orange-800'
      case 2: return 'bg-orange-200 text-orange-900'
      case 3: return 'bg-red-100 text-red-800'
      default: return 'text-text-secondary'
    }
  }
  
  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-text-primary">오늘의 예정된 콜</h2>
      </div>
      
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="환자명 또는 연락처 검색"
            className="pl-10 pr-4 py-2 w-full bg-light-bg rounded-full text-sm focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Icon 
            icon={HiOutlineSearch} 
            size={18} 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" 
          />
        </div>
        
        <div className="flex gap-3">
          <select
            className="px-4 py-2 bg-light-bg rounded-full text-sm focus:outline-none text-text-secondary"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="전체">전체</option>
            <option value="초기">초기</option>
            <option value="1차">1차</option>
            <option value="2차">2차</option>
            <option value="3차">3차</option>
          </select>
        </div>
      </div>
      
      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px]">
          {/* 테이블 헤더 */}
          <thead>
            <tr className="bg-light-bg rounded-md">
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">환자명</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">연락처</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">시간</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">상태</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">시도</th>
              <th className="px-4 py-2 text-center text-sm font-semibold text-text-secondary">액션</th>
            </tr>
          </thead>
          
          {/* 테이블 바디 */}
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  불러오는 중...
                </td>
              </tr>
            ) : paginatedCalls.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-secondary">
                  오늘 예정된 콜이 없습니다.
                </td>
              </tr>
            ) : (
              paginatedCalls.map((call) => {
                // 시간 포맷팅
                const scheduledTime = new Date(call.scheduledTime)
                const timeDisplay = format(scheduledTime, 'HH:mm')
                
                // 홍길동만 하이라이트 (디자인에서 본 것처럼)
                const isHighlighted = call.patientName === '홍길동'
                
                return (
                  <tr 
                    key={call.id} 
                    className={`
                      border-b border-border last:border-0 hover:bg-light-bg/50 transition-colors duration-150
                      ${isHighlighted ? 'bg-red-50/30' : ''}
                    `}
                  >
                    <td className={`px-4 py-4 text-sm ${isHighlighted ? 'text-red-600 font-medium' : 'text-text-primary'}`}>
                      {call.patientName}
                    </td>
                    <td className="px-4 py-4 text-sm text-text-secondary">
                      {call.phoneNumber}
                    </td>
                    <td className="px-4 py-4 text-sm text-text-secondary">
                      {timeDisplay}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {call.attemptCount === 0 ? (
                        <span className="text-sm text-text-secondary">초기</span>
                      ) : (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${getAttemptBadgeColor(call.attemptCount)}`}>
                          {call.attemptCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors duration-150"
                        onClick={() => handleViewCallDetails(call.id)}
                      >
                        <Icon 
                          icon={HiOutlineArrowUp} 
                          size={16} 
                          className="transform rotate-45" 
                        />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* 페이지네이션 */}
      <div className="flex items-center justify-between pt-4 mt-2">
        <div className="text-sm text-text-secondary">
          {filteredCalls.length}개 항목 중 {Math.min(startIndex + 1, filteredCalls.length)}-{Math.min(startIndex + itemsPerPage, filteredCalls.length)} 표시
        </div>
        
        <div className="flex items-center gap-2 bg-light-bg px-4 py-1.5 rounded-full">
          <button
            className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Icon 
              icon={HiOutlineChevronLeft} 
              size={20} 
              className="text-current" 
            />
          </button>
          
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
            <button
              key={i + 1}
              className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                currentPage === i + 1 ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
              }`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          
          <button
            className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Icon 
              icon={HiOutlineChevronRight} 
              size={20} 
              className="text-current" 
            />
          </button>
        </div>
      </div>
    </div>
  )
}