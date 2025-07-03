//src/components/dashboard/TodayCallsTable.tsx

'use client'

import { useState } from 'react'
import { Call } from '@/store/slices/callsSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { selectPatient } from '@/store/slices/patientsSlice'
import { RootState } from '@/store'
import { HiOutlineSearch, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineEye } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import Link from 'next/link'

interface TodayCallsTableProps {
  calls?: Call[]
  isLoading?: boolean
}

export default function TodayCallsTable({ calls = [], isLoading = false }: TodayCallsTableProps) {
  // 🔥 임시 디버깅 로그 추가
  console.log('🔥 TodaysCallsTable 디버깅:', {
    calls,
    callsLength: calls.length,
    isLoading,
    callsType: typeof calls,
    firstCall: calls[0] || null
  });

  const dispatch = useAppDispatch()
  const patients = useAppSelector((state: RootState) => state.patients.patients)

  // 🔥 환자 데이터도 확인
    console.log('🔥 환자 데이터 확인:', {
      patientsLength: patients.length,
      오늘날짜: new Date().toISOString().split('T')[0],
      환자콜백예시: patients.slice(0, 3).map(p => ({
        name: p.name,
        callbackHistory: p.callbackHistory || [],
        nextCallbackDate: p.nextCallbackDate
      }))
    });

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<string>('전체')
  
  const itemsPerPage = 5
  
  // 환자 정보 조회 헬퍼 함수
  const getPatientInfo = (patientId: string) => {
    return patients.find(patient => patient.id === patientId || patient.patientId === patientId)
  }
  
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
  
  // 환자 상세보기 모달 열기
  const handleViewPatientDetails = (call: Call) => {
    const patient = getPatientInfo(call.patientId)
    
    if (patient) {
      // 환자 정보가 있는 경우 환자 ID로 선택
      dispatch(selectPatient(patient.id))
    } else {
      // 환자 정보가 없는 경우 patientId로 시도
      // 만약 selectPatient가 ID만 받는다면, 환자 데이터가 없는 경우 처리 필요
      console.warn(`환자 정보를 찾을 수 없습니다. patientId: ${call.patientId}`);
      // 일단 patientId로 시도해보고, 실패하면 다른 방법 필요
      dispatch(selectPatient(call.patientId))
    }
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
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">나이</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">지역</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">상태</th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-text-secondary">시도</th>
              <th className="px-4 py-2 text-center text-sm font-semibold text-text-secondary">상세보기</th>
            </tr>
          </thead>
          
          {/* 테이블 바디 */}
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">
                  불러오는 중...
                </td>
              </tr>
            ) : paginatedCalls.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-secondary">
                  오늘 예정된 콜이 없습니다.
                </td>
              </tr>
            ) : (
              paginatedCalls.map((call) => {
                // 해당 환자 정보 조회
                const patient = getPatientInfo(call.patientId)
                
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
                      {patient?.age ? `${patient.age}세` : '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-text-secondary">
                      {patient?.region ? (
                        <span>
                          {patient.region.province}
                          {patient.region.city && ` ${patient.region.city}`}
                        </span>
                      ) : '-'}
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
                        onClick={() => handleViewPatientDetails(call)}
                        title="환자 상세보기"
                      >
                        <Icon 
                          icon={HiOutlineEye} 
                          size={16} 
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
      
      {/* 하단 링크 - 모든 콜 보기 */}
      {filteredCalls.length > 0 && (
        <div className="pt-4 mt-2 border-t border-border flex justify-between items-center">
          <span className="text-sm text-text-secondary">
            총 {filteredCalls.length}개의 콜이 예정되어 있습니다.
          </span>
          <Link 
            href="/management" 
            className="text-sm text-primary hover:text-primary-dark font-medium transition-colors"
          >
            모든 콜 보기 →
          </Link>
        </div>
      )}
    </div>
  )
}