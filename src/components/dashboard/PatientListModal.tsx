// src/components/dashboard/PatientListModal.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { RootState } from '@/store'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { fetchFilteredPatients, clearFilteredPatients, PatientFilterType, setSelectedPatient } from '@/store/slices/patientsSlice'
import { 
  HiOutlineX, 
  HiOutlinePhone, 
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineCheckCircle,
  HiOutlineCurrencyDollar
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { Patient } from '@/types/patient'
import PatientDetailModal from '../management/PatientDetailModal'

interface PatientListModalProps {
  isOpen: boolean
  onClose: () => void
  filterType: PatientFilterType
  title: string
}

const PatientListModal: React.FC<PatientListModalProps> = ({
  isOpen,
  onClose,
  filterType,
  title
}) => {
  const dispatch = useAppDispatch()
  const { filteredPatientsForModal, isLoading } = useAppSelector((state) => state.patients)
  
  // 🔥 환자 상세 모달 상태 추가
  const [isPatientDetailOpen, setIsPatientDetailOpen] = useState(false)

  useEffect(() => {
    if (isOpen && filterType) {
      // 필터 타입에 따라 환자 목록 조회
      dispatch(fetchFilteredPatients(filterType))
    }
    
    return () => {
      // 모달 닫힐 때 필터된 환자 목록 초기화
      if (!isOpen) {
        dispatch(clearFilteredPatients())
      }
    }
  }, [isOpen, filterType, dispatch])

  if (!isOpen) return null

  const getPatientStatusBadge = (patient: Patient) => {
    const { status } = patient
    
    const statusConfig = {
      '잠재고객': { color: 'bg-blue-100 text-blue-800', icon: HiOutlineUser },
      '콜백필요': { color: 'bg-yellow-100 text-yellow-800', icon: HiOutlinePhone },
      '예약확정': { color: 'bg-green-100 text-green-800', icon: HiOutlineCheckCircle },
      '부재중': { color: 'bg-gray-100 text-gray-800', icon: HiOutlinePhone },
      'VIP': { color: 'bg-purple-100 text-purple-800', icon: HiOutlineUser },
      '종결': { color: 'bg-red-100 text-red-800', icon: HiOutlineX }
    }

    const config = statusConfig[status] || statusConfig['잠재고객']
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon icon={config.icon} size={12} className="mr-1" />
        {status}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // 🔥 환자명 클릭 핸들러 추가
  const handlePatientNameClick = (patient: Patient) => {
    dispatch(setSelectedPatient(patient))
    setIsPatientDetailOpen(true)
  }

  // 🔥 환자 상세 모달 닫기 핸들러
  const handlePatientDetailClose = () => {
    setIsPatientDetailOpen(false)
  }

  // 🔥 예약전환율에 맞는 컬럼 설정 (문의일 → 관심분야로 변경)
  const getRelevantColumns = () => {
    switch (filterType) {
      case 'new_inquiry':
        return ['name', 'phone', 'consultationType', 'status', 'callInDate']
      case 'reservation_rate':
        // 🔥 변경: callInDate → interestedServices
        return ['name', 'phone', 'status', 'reservationDate', 'interestedServices']
      case 'visit_rate':
        return ['name', 'phone', 'status', 'visitDate', 'estimateAgreed']
      case 'treatment_rate':
        return ['name', 'phone', 'status', 'treatmentContent', 'patientReaction']
      default:
        return ['name', 'phone', 'status', 'callInDate']
    }
  }

  const columns = getRelevantColumns()

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
              <span className="bg-primary text-white px-2 py-1 rounded-full text-sm">
                {filteredPatientsForModal.length}명
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Icon icon={HiOutlineX} size={20} />
            </button>
          </div>

          {/* 콘텐츠 */}
          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-text-secondary">환자 목록을 불러오는 중...</div>
              </div>
            ) : filteredPatientsForModal.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-text-secondary">해당 조건의 환자가 없습니다.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.includes('name') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          환자명
                        </th>
                      )}
                      {columns.includes('phone') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          연락처
                        </th>
                      )}
                      {columns.includes('consultationType') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          상담유형
                        </th>
                      )}
                      {columns.includes('status') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          상태
                        </th>
                      )}
                      {columns.includes('callInDate') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          문의일
                        </th>
                      )}
                      {columns.includes('reservationDate') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          예약일
                        </th>
                      )}
                      {/* 🔥 관심분야 컬럼 추가 */}
                      {columns.includes('interestedServices') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          관심분야
                        </th>
                      )}
                      {columns.includes('visitDate') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          내원일
                        </th>
                      )}
                      {/* 🔥 견적동의 컬럼 추가 */}
                      {columns.includes('estimateAgreed') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          견적동의
                        </th>
                      )}
                      {/* 🔥 치료내용 컬럼 추가 */}
                      {columns.includes('treatmentContent') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          치료내용
                        </th>
                      )}
                      {/* 🔥 환자반응 컬럼 추가 */}
                      {columns.includes('patientReaction') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          환자반응
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPatientsForModal.map((patient) => (
                      <tr key={patient._id} className="hover:bg-gray-50">
                        {columns.includes('name') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {/* 🔥 환자명을 클릭 가능하게 수정 */}
                            <div 
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                              onClick={() => handlePatientNameClick(patient)}
                            >
                              {patient.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {patient.patientId}
                            </div>
                          </td>
                        )}
                        {columns.includes('phone') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {patient.phoneNumber}
                          </td>
                        )}
                        {columns.includes('consultationType') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              patient.consultationType === 'inbound' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              <Icon 
                                icon={patient.consultationType === 'inbound' ? HiOutlinePhone : HiOutlineCalendar} 
                                size={12} 
                                className="mr-1" 
                              />
                              {patient.consultationType === 'inbound' ? '인바운드' : '아웃바운드'}
                            </span>
                          </td>
                        )}
                        {columns.includes('status') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getPatientStatusBadge(patient)}
                          </td>
                        )}
                        {columns.includes('callInDate') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(patient.callInDate)}
                          </td>
                        )}
                        {columns.includes('reservationDate') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(patient.reservationDate || '')}
                          </td>
                        )}
                        {/* 🔥 관심분야 컬럼 데이터 추가 */}
                        {columns.includes('interestedServices') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                              {patient.interestedServices && patient.interestedServices.length > 0 ? (
                                patient.interestedServices.slice(0, 3).map((service, index) => (
                                  <span 
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-800"
                                  >
                                    {service}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                              {patient.interestedServices && patient.interestedServices.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{patient.interestedServices.length - 3}개
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {columns.includes('visitDate') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(patient.visitDate || '')}
                          </td>
                        )}
                        {/* 🔥 견적동의 컬럼 데이터 추가 */}
                        {columns.includes('estimateAgreed') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {patient.consultation?.estimateAgreed !== undefined ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                patient.consultation.estimateAgreed 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {patient.consultation.estimateAgreed ? '동의' : '미동의'}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        )}
                        {/* 🔥 치료내용 컬럼 데이터 추가 */}
                        {columns.includes('treatmentContent') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(() => {
                              const treatmentContent = (patient.postVisitConsultation as any)?.treatmentContent;
                              
                              if (!treatmentContent) {
                                return <span className="text-xs text-gray-400">미입력</span>;
                              }
                              
                              // 치료 내용별 색상 구분
                              const getColorClass = (content: string) => {
                                switch (content) {
                                  case '단일 임플란트':
                                    return 'bg-blue-100 text-blue-800';
                                  case '다수 임플란트':
                                    return 'bg-indigo-100 text-indigo-800';
                                  case '무치악 임플란트':
                                    return 'bg-purple-100 text-purple-800';
                                  case '틀니':
                                    return 'bg-green-100 text-green-800';
                                  case '라미네이트':
                                    return 'bg-pink-100 text-pink-800';
                                  case '충치치료':
                                    return 'bg-yellow-100 text-yellow-800';
                                  case '기타':
                                    return 'bg-gray-100 text-gray-800';
                                  default:
                                    return 'bg-gray-100 text-gray-800';
                                }
                              };
                              
                              return (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColorClass(treatmentContent)}`}>
                                  {treatmentContent}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        {/* 🔥 환자반응 컬럼 데이터 추가 */}
                        {columns.includes('patientReaction') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(() => {
                              const estimateInfo = patient.postVisitConsultation?.estimateInfo;
                              
                              if (!estimateInfo) {
                                return <span className="text-xs text-gray-400">미입력</span>;
                              }
                              
                              // 환자 반응별 색상 구분
                              const getReactionColor = (reaction: string) => {
                                switch (reaction) {
                                  case '동의해요(적당)':
                                    return 'bg-green-100 text-green-800';
                                  case '비싸요':
                                    return 'bg-red-100 text-red-800';
                                  case '생각보다 저렴해요':
                                    return 'bg-blue-100 text-blue-800';
                                  case '알 수 없음':
                                    return 'bg-gray-100 text-gray-800';
                                  default:
                                    return 'bg-gray-100 text-gray-800';
                                }
                              };

                              // 가격 표시 우선순위 로직
                              const getDisplayPrice = () => {
                                const regularPrice = estimateInfo.regularPrice || 0;
                                const discountPrice = estimateInfo.discountPrice || 0;
                                
                                if (discountPrice > 0) {
                                  return {
                                    price: discountPrice,
                                    label: '할인가'
                                  };
                                } else if (regularPrice > 0) {
                                  return {
                                    price: regularPrice,
                                    label: '정가'
                                  };
                                }
                                
                                return null;
                              };
                              
                              const priceInfo = getDisplayPrice();
                              
                              return (
                                <div className="flex flex-col space-y-1">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    getReactionColor(estimateInfo.patientReaction)
                                  }`}>
                                    {estimateInfo.patientReaction || '미설정'}
                                  </span>
                                  {priceInfo ? (
                                    <div className="text-xs text-gray-600">
                                      <span className="font-medium">
                                        {priceInfo.price.toLocaleString()}원
                                      </span>
                                      <span className="text-gray-500 ml-1">
                                        ({priceInfo.label})
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">
                                      가격 미입력
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-text-secondary">
              총 {filteredPatientsForModal.length}명의 환자
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* 🔥 환자 상세 모달 추가 */}
      {isPatientDetailOpen && <PatientDetailModal />}
    </>
  )
}

export default PatientListModal