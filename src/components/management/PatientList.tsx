// src/components/management/PatientList.tsx

'use client'

import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { setPage, selectPatient, Patient, toggleVisitConfirmation } from '@/store/slices/patientsSlice'
import { openDeleteConfirm } from '@/store/slices/uiSlice'
import { IconType } from 'react-icons'
import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineArrowUp, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { useState, useEffect } from 'react'
import PatientDetailModal from './PatientDetailModal'

interface PatientListProps {
  isLoading?: boolean
}

const PatientStatusBadge = ({ status }: { status: string }) => {
  const colorMap: Record<string, string> = {
    '잠재고객': 'bg-blue-100 text-blue-800',
    '콜백필요': 'bg-yellow-100 text-yellow-800',
    '부재중': 'bg-red-100 text-red-800',
    '활성고객': 'bg-green-100 text-green-800',
    'VIP': 'bg-purple-100 text-purple-800',
    '예약확정': 'bg-indigo-100 text-indigo-800',
    '종결': 'bg-gray-100 text-gray-800',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

// 총 콜백 횟수 표시를 위한 컴포넌트
const CallbackCountBadge = ({ patient }: { patient: Patient }) => {
  // 완료된 콜백만 카운트
  const completedCallbacks = patient.callbackHistory?.filter(cb => cb.status === '완료').length || 0;
  // 예정된 콜백 카운트
  const scheduledCallbacks = patient.callbackHistory?.filter(cb => cb.status === '예정').length || 0;
  
  // 종결 여부와 관계없이 항상 실제 콜백 횟수 표시
  if (completedCallbacks === 0) {
    return <span className="text-text-secondary">-</span>;
  }
  
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        {completedCallbacks}
      </span>
      {scheduledCallbacks > 0 && (
        <span className="text-xs text-blue-600">
          (+{scheduledCallbacks})
        </span>
      )}
    </div>
  );
};

export default function PatientList({ isLoading = false }: PatientListProps) {
  const dispatch = useDispatch<AppDispatch>()
  
  // 클라이언트 사이드 마운트 여부를 확인하기 위한 상태 추가
  const [isMounted, setIsMounted] = useState(false)
  
  const { 
    filteredPatients, 
    pagination: { currentPage, totalPages, itemsPerPage, totalItems },
    filters,
    selectedPatient,
  } = useSelector((state: RootState) => state.patients)
  
  // 컴포넌트가 마운트되면 상태 업데이트
  useEffect(() => {
    console.log('PatientList 컴포넌트 마운트됨');
    setIsMounted(true);
  }, [])
  
  console.log('PatientList 렌더링 - isMounted:', isMounted);
  console.log('filteredPatients 수:', filteredPatients.length);
  
  // 현재 표시될 환자 목록
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredPatients.length)
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex)
  
  // 페이지 변경 핸들러
  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  // 디테일 보기 핸들러
  const handleViewDetails = (patient: Patient) => {
    // _id가 undefined일 수 있으므로 체크 후 사용
    if (patient._id) {
      dispatch(selectPatient(patient._id))
    } else if (patient.id) {
      // 대체 ID 사용
      dispatch(selectPatient(patient.id))
    }
  }
  
  // 내원 확정 토글 핸들러
  const handleToggleVisitConfirmation = (patient: Patient, e: React.MouseEvent) => {
  e.stopPropagation() // 이벤트 버블링 방지
  
  // _id가 undefined일 수 있으므로 체크 후 사용
  if (patient._id) {
    dispatch(toggleVisitConfirmation(patient._id))
  } else if (patient.id) {
    // 대체 ID 사용
    dispatch(toggleVisitConfirmation(patient.id))
  }
}
  
  return (
    <>
      <div className="card p-0 w-full">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] table-auto">
            {/* 테이블 헤더 */}
            <thead>
              <tr className="bg-light-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">환자 ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">나이</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">지역</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">연락처</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">관심 분야</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">최근 상담</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">총 콜백 횟수</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">내원 확정</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary">액션</th>
              </tr>
            </thead>
            
            {/* 테이블 바디 */}
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-secondary">
                    불러오는 중...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-text-secondary">
                    {filters.searchTerm ? (
                      <>검색 결과가 없습니다: <strong>{filters.searchTerm}</strong></>
                    ) : (
                      '등록된 환자가 없습니다.'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => {
                  // 콜백 히스토리 확인 - 부재중 콜백이 있는지
                  if (patient.callbackHistory && patient.callbackHistory.length > 0) {
                    const absentCallbacks = patient.callbackHistory.filter(cb => cb.status === '부재중');
                    if (absentCallbacks.length > 0) {
                      console.log('부재중 콜백이 있는 환자:', patient._id, patient.name, '- 상태:', patient.status);
                    }
                  }
                  // 특수 환자 강조 표시 (VIP, 미응답 등)
                  const rowColor = 
                    patient.status === 'VIP' ? 'bg-purple-50/30' :
                    patient.status === '부재중' ? 'bg-red-50/30' : // 미응답 -> 부재중으로 변경
                    patient.status === '콜백필요' ? 'bg-yellow-50/30' :
                    '';
                  
                  // 홍길동은 특별히 이름을 강조
                  const isVip = patient.name === '홍길동' || patient.status === 'VIP';

                  // 환자 레코드에 _id 또는 id가 있는지 확인
                  const patientId = patient._id || patient.id || '';
                  
                  return (
                    <tr 
                      key={patient._id} 
                      className={`border-b border-border last:border-0 ${rowColor} hover:bg-light-bg/50 transition-colors duration-150`}
                    >
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.patientId}
                      </td>
                      <td className={`px-4 py-4 text-sm font-medium ${isVip ? 'text-purple-800' : 'text-text-primary'}`}>
                        <button 
                          onClick={() => handleViewDetails(patient)}
                          className="hover:underline"
                        >
                          {patient.name}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.age || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.region ? (
                          <>
                            {patient.region.province}
                            {patient.region.city && ` ${patient.region.city}`}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.phoneNumber}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {patient.interestedServices.map((service, idx) => (
                            <span 
                              key={idx}
                              className="inline-block px-2 py-1 rounded-full text-xs bg-light-bg text-text-primary"
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">
                        {patient.lastConsultation}
                      </td>
                      <td className="px-4 py-4">
                        <PatientStatusBadge status={patient.status} />
                      </td>
                      <td className="px-4 py-4">
                        <CallbackCountBadge patient={patient} />
                      </td>
                      {/* 내원 확정 셀 추가 */}
                      <td className="px-4 py-4 text-center">
                        <button
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-150 ${
                            patient.visitConfirmed 
                              ? 'bg-green-500 text-white hover:bg-green-600' 
                              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }`}
                          onClick={(e) => handleToggleVisitConfirmation(patient, e)}
                          title={patient.visitConfirmed ? "내원 확정 취소" : "내원 확정"}
                        >
                          <Icon 
                            icon={HiOutlineCheck} 
                            size={16} 
                          />
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors duration-150"
                            onClick={() => handleViewDetails(patient)}
                            title="상세 정보"
                          >
                            <Icon 
                              icon={HiOutlineArrowUp} 
                              size={16} 
                              className="transform rotate-45" 
                            />
                          </button>
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-error text-white hover:bg-error/90 transition-colors duration-150"
                            // 환자 ID 체크 추가
                            onClick={() => patientId && dispatch(openDeleteConfirm(patientId))}
                            title="환자 삭제"
                          >
                            <Icon 
                              icon={HiOutlineTrash} 
                              size={16} 
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* 페이지네이션 */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-text-secondary mb-4 sm:mb-0">
            총 {totalItems}개 항목 중 {Math.min(startIndex + 1, totalItems)}-{Math.min(endIndex, totalItems)} 표시
          </div>
          
          <div className="flex items-center gap-2 bg-light-bg px-4 py-1.5 rounded-full">
            <button
              className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <Icon 
                icon={HiOutlineChevronLeft} 
                size={20} 
                className="text-current" 
              />
            </button>
            
            {totalPages <= 5 ? (
              // 5페이지 이하일 때는 모든 페이지 표시
              Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                    currentPage === i + 1 ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => handlePageChange(i + 1)}
                >
                  {i + 1}
                </button>
              ))
            ) : (
              // 5페이지 초과일 때는 1, 2, 3, ..., 마지막 페이지 형태로 표시
              <>
                {[1, 2, 3].map((page) => (
                  <button
                    key={page}
                    className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                      currentPage === page ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                    }`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))}
                
                <span className="text-text-secondary">...</span>
                
                <button
                  className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                    currentPage === totalPages ? 'bg-primary text-white' : 'text-text-secondary hover:bg-gray-200'
                  }`}
                  onClick={() => handlePageChange(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}
            
            <button
              className="p-1 text-text-secondary disabled:text-text-muted disabled:cursor-not-allowed"
              onClick={() => handlePageChange(currentPage + 1)}
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
      
      {/* 환자 상세 모달 추가 */}
      {selectedPatient && <PatientDetailModal />}
    </>
  )
}