// src/components/management/PatientDetailModal.tsx - 활동 로그 실시간 업데이트 개선

'use client'

import { useState, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { RootState } from '@/store'
import { clearSelectedPatient, Patient } from '@/store/slices/patientsSlice'
import { HiOutlineX, HiOutlinePhone, HiOutlineCalendar, HiOutlineUser, HiOutlineLocationMarker, HiOutlineCake, HiOutlineClipboardList, HiOutlinePencil, HiOutlineCheck, HiOutlineStop, HiOutlineRefresh, HiOutlineGlobeAlt, HiOutlineUserGroup } from 'react-icons/hi'
import { FiPhone, FiPhoneCall } from 'react-icons/fi'
import { formatDistance } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { Icon } from '../common/Icon'
import CallbackManagement from './CallbackManagement'
import PatientEditForm from './PatientEditForm'
import PatientMessageHistory from './PatientMessageHistory'
import MessageSendModal from './MessageSendModal'

export default function PatientDetailModal() {
  const dispatch = useAppDispatch()
  const selectedPatient = useAppSelector((state: RootState) => state.patients.selectedPatient)
  const isLoading = useAppSelector((state: RootState) => state.patients.isLoading)
  
  // 🔥 활동 로그 업데이트 트리거를 위한 상태
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // 탭 상태 관리
  const [activeTab, setActiveTab] = useState('환자정보')
  
  // 환자 수정 모달 상태
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // 문자 발송 모달 상태
  const [isMessageSendModalOpen, setIsMessageSendModalOpen] = useState(false)
  
  // 선택된 환자 변경 감지
  useEffect(() => {
    if (selectedPatient) {
      console.log('환자 상세 정보 표시:', selectedPatient.name);
      // 🔥 환자가 변경되면 새로고침 트리거 초기화
      setRefreshTrigger(0);
    }
  }, [selectedPatient]);
  
  // 탭 변경 핸들러
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    console.log('탭 변경:', newTab);
  }
  
  // 모달 닫기
  const handleClose = () => {
    dispatch(clearSelectedPatient())
  }
  
  // 환자 수정 모달 열기
  const handleOpenEditModal = () => {
    console.log('환자 정보 수정 모달 열기');
    setIsEditModalOpen(true)
  }
  
  // 🔥 환자 수정 완료 처리 - 활동 로그 새로고침 트리거 추가
  const handleEditSuccess = () => {
    // 환자 정보 탭으로 돌아가기
    setActiveTab('환자정보')
    console.log('🔥 환자 정보 수정 완료 - 활동 로그 새로고침 트리거');
    
    // 🔥 활동 로그 새로고침을 위한 트리거 업데이트
    setRefreshTrigger(prev => prev + 1);
    
    // 약간의 지연 후 추가 새로고침 (로그 기록이 완료될 시간 확보)
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
      console.log('🔥 지연된 활동 로그 새로고침 트리거');
    }, 1000);
  }
  
  // 문자 발송 완료 핸들러
  const handleMessageSendComplete = () => {
    // 필요한 경우 환자 상태 업데이트 또는 메시지 갱신
    // 문자 내역 탭으로 전환
    setActiveTab('문자내역')
    console.log('문자 발송 완료');
  }
  
  // 문자 발송 모달 열기
  const handleOpenMessageModal = () => {
    console.log('문자 발송 모달 열기');
    setIsMessageSendModalOpen(true)
  }
  
  // 기본 정보가 없으면 렌더링하지 않음
  if (!selectedPatient) return null
  
  // 콜백 필요 여부 확인
  const needsCallback = selectedPatient.status === '콜백필요' || selectedPatient.status === '부재중'
  

  // 예약 완료 여부 확인 함수 수정
  const isReservationCompleted = (patient: Patient) => {
    const result = patient.isCompleted && 
          patient.completedReason && 
          patient.completedReason.includes('[예약완료]');
    
    // 디버깅 로그 추가
    if (result && patient.completedReason) {
      console.log('=== 예약 완료 환자 디버깅 ===');
      console.log('completedReason:', patient.completedReason);
      console.log('contains newline:', patient.completedReason.includes('\n'));
      console.log('completedReason length:', patient.completedReason.length);
      console.log('completedReason split by \\n:', patient.completedReason.split('\n'));
    }
    
    return result;
  };

  // 예약 완료 상담 내용 추출 함수 수정
  const getReservationConsultationNotes = (patient: Patient) => {
    if (!patient.completedReason) return '';
    
    // 공백으로 분할해서 처리 (현재는 줄바꿈이 없이 저장되고 있음)
    const text = patient.completedReason;
    
    // [예약완료] 예약일시: YYYY-MM-DD HH:MM 뒤의 내용을 상담 내용으로 처리
    const match = text.match(/\[예약완료\]\s*예약일시:\s*[\d-]+\s+[\d:]+\s*(.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return '';
  };

  // 예약 정보 추출 함수 수정
  const getReservationInfo = (patient: Patient) => {
    if (!patient.completedReason) return '';
    
    // [예약완료] 예약일시: YYYY-MM-DD HH:MM 부분만 추출
    const match = patient.completedReason.match(/\[예약완료\]\s*(예약일시:\s*[\d-]+\s+[\d:]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    return '';
  };

  // 종결 상태 여부 확인 - 명시적으로 체크 (수정)
  const isCompleted = selectedPatient.isCompleted === true || selectedPatient.status === '종결';
  
  // 마지막 상담 일자 기준 경과 시간
  const lastConsultationDate = new Date(selectedPatient.lastConsultation)
  const timeSinceLastConsultation = selectedPatient.lastConsultation && selectedPatient.lastConsultation !== ''
  ? formatDistance(
      new Date(selectedPatient.lastConsultation),
      new Date(),
      { addSuffix: true, locale: ko }
    )
  : '';

// 첫 상담 이후 경과 시간 - 값이 있는 경우에만 계산
const timeSinceFirstConsult = selectedPatient.firstConsultDate && selectedPatient.firstConsultDate !== ''
  ? formatDistance(
      new Date(selectedPatient.firstConsultDate),
      new Date(),
      { addSuffix: true, locale: ko }
    )
  : '';
  
  // 환자 상태에 따른 뱃지 색상
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      '잠재고객': 'bg-blue-100 text-blue-800',
      '콜백필요': 'bg-yellow-100 text-yellow-800',
      '부재중': 'bg-orange-100 text-orange-800',
      '활성고객': 'bg-green-100 text-green-800',
      'VIP': 'bg-purple-100 text-purple-800',
      '예약확정': 'bg-indigo-100 text-indigo-800',
      '종결': 'bg-gray-100 text-gray-800', // 종결 상태 추가
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }
  
  // 환자 상태 뱃지
  const StatusBadge = ({ status }: { status: string }) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status}
    </span>
  )
  
  // 리마인더 상태 뱃지
  const ReminderBadge = ({ status }: { status: string }) => {
    if (status === '-') {
      return <span className="text-text-secondary">-</span>
    }
  
    const colorMap: Record<string, string> = {
      '초기': 'text-text-secondary',
      '1차': 'bg-orange-100 text-orange-800',
      '2차': 'bg-orange-200 text-orange-900',
      '3차': 'bg-red-100 text-red-800',
      '4차': 'bg-red-200 text-red-900',
      '5차': 'bg-red-300 text-red-900',
    }
  
    const isNumeric = ['1차', '2차', '3차', '4차', '5차'].includes(status)
  
    if (isNumeric) {
      return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${colorMap[status]}`}>
          {status.charAt(0)}
        </span>
      )
    }
  
    return <span className={`text-sm ${colorMap[status]}`}>{status}</span>
  }

  // 유입경로 표시 텍스트
  const getReferralSourceText = (source?: string) => {
    if (!source || source === '') return '-';
    return source;
  }

  // 담당자 정보 표시 함수
  const getUserDisplayName = (userId?: string, userName?: string) => {
    if (!userId && !userName) return '-';
    if (userName) return userName;
    if (userId === 'system') return '시스템';
    return userId || '-';
  }

  // 마지막 수정 시간 포맷팅
  const formatLastModified = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return formatDistance(new Date(dateString), new Date(), { 
        addSuffix: true, 
        locale: ko 
      });
    } catch {
      return dateString;
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              환자 상세: {selectedPatient.name}
            </h2>
            <StatusBadge status={selectedPatient.status} />
            <ReminderBadge status={selectedPatient.reminderStatus} />
            {/* 상담 타입 뱃지 추가 */}
            <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              (selectedPatient.consultationType || 'outbound') === 'inbound' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {(selectedPatient.consultationType || 'outbound') === 'inbound' ? (
                <>
                  <FiPhone className="w-3 h-3 mr-1" />
                  인바운드
                </>
              ) : (
                <>
                  <FiPhoneCall className="w-3 h-3 mr-1" />
                  아웃바운드
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 문자 발송 버튼 추가 */}
            <button 
              className="text-primary hover:text-primary-dark flex items-center gap-1"
              onClick={handleOpenMessageModal}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">문자 발송</span>
            </button>
            <button 
              className="text-text-secondary hover:text-primary flex items-center gap-1"
              onClick={handleOpenEditModal}
            >
              <Icon icon={HiOutlinePencil} size={18} />
              <span className="text-sm">수정</span>
            </button>
            <button 
              className="text-text-secondary hover:text-text-primary ml-4" 
              onClick={handleClose}
            >
              <Icon icon={HiOutlineX} size={20} />
            </button>
          </div>
        </div>
        
        {/* 탭 메뉴 - 문자내역 탭 추가 */}
        <div className="px-6 pt-4 border-b border-border flex items-center">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '환자정보'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('환자정보')}
          >
            환자 정보
            {activeTab === '환자정보' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '콜백관리'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('콜백관리')}
          >
            콜백 관리
            {activeTab === '콜백관리' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
              activeTab === '문자내역'
                ? 'text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => handleTabChange('문자내역')}
          >
            문자내역
            {activeTab === '문자내역' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
        </div>
        
        {/* 모달 바디 */}
        <div className="p-6">
          {/* 환자 기본 정보 탭 */}
          {activeTab === '환자정보' && (
            <div className="space-y-6">
              {/* 기본 정보 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">기본 정보</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 환자 ID */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineUser} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">환자 ID</p>
                      <p className="text-text-primary">{selectedPatient.patientId}</p>
                    </div>
                  </div>
                  
                  {/* 연락처 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlinePhone} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">연락처</p>
                      <p className="text-text-primary">{selectedPatient.phoneNumber}</p>
                    </div>
                  </div>

                  {/* 상담 타입 정보 추가 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={(selectedPatient.consultationType || 'outbound') === 'inbound' ? FiPhone : FiPhoneCall} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">상담 타입</p>
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary">
                          {(selectedPatient.consultationType || 'outbound') === 'inbound' ? '인바운드' : '아웃바운드'}
                        </p>
                        {/* 🔥 변경 버튼 추가 */}
                        <button
                          className="text-xs text-primary hover:text-primary-dark underline"
                          onClick={handleOpenEditModal}
                          title="상담 타입을 변경하려면 수정 모달에서 변경할 수 있습니다"
                        >
                          변경
                        </button>
                        {selectedPatient.consultationType === 'inbound' && selectedPatient.inboundPhoneNumber && (
                          <span className="text-xs text-gray-500">
                            (입력번호: {selectedPatient.inboundPhoneNumber})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 유입경로 정보 추가 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineGlobeAlt} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">유입경로</p>
                      <p className="text-text-primary">{getReferralSourceText(selectedPatient.referralSource)}</p>
                    </div>
                  </div>
                  
                  {/* 나이 */}
                  {selectedPatient.age && (
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon={HiOutlineCake} 
                        size={18} 
                        className="text-text-muted mt-0.5" 
                      />
                      <div>
                        <p className="text-sm text-text-secondary">나이</p>
                        <p className="text-text-primary">{selectedPatient.age}세</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 지역 */}
                  {selectedPatient.region && (
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon={HiOutlineLocationMarker} 
                        size={18} 
                        className="text-text-muted mt-0.5" 
                      />
                      <div>
                        <p className="text-sm text-text-secondary">거주지역</p>
                        <p className="text-text-primary">
                          {selectedPatient.region.province}
                          {selectedPatient.region.city && ` ${selectedPatient.region.city}`}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* 콜 유입 날짜 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">콜 유입 날짜</p>
                      <p className="text-text-primary">{selectedPatient.callInDate}</p>
                    </div>
                  </div>
                  
                  {/* 첫 상담 날짜 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">첫 상담 날짜</p>
                      <p className="text-text-primary">
                        {selectedPatient.firstConsultDate && selectedPatient.firstConsultDate !== '' 
                          ? `${selectedPatient.firstConsultDate} (${timeSinceFirstConsult})`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 마지막 상담 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">마지막 상담</p>
                      <p className="text-text-primary">
                        {selectedPatient.lastConsultation && selectedPatient.lastConsultation !== '' 
                          ? `${selectedPatient.lastConsultation} (${timeSinceLastConsultation})`
                          : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {/* 관심 분야 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineClipboardList} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">관심 분야</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedPatient.interestedServices.map((service, index) => (
                          <span 
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-light-bg text-text-primary"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 담당자 정보 카드 추가 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">담당자 정보</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 등록 담당자 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineUserGroup} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">등록 담당자</p>
                      <p className="text-text-primary">
                        {getUserDisplayName(selectedPatient.createdBy, selectedPatient.createdByName)}
                      </p>
                      {selectedPatient.createdAt && (
                        <p className="text-xs text-text-muted">
                          {selectedPatient.createdAt} 등록
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* 최종 수정자 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlinePencil} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">최종 수정자</p>
                      <p className="text-text-primary">
                        {getUserDisplayName(selectedPatient.lastModifiedBy, selectedPatient.lastModifiedByName)}
                      </p>
                      {selectedPatient.lastModifiedAt && (
                        <p className="text-xs text-text-muted">
                          {formatLastModified(selectedPatient.lastModifiedAt)} 수정
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 메모 카드 */}
              {selectedPatient.notes && (
                <div className="card">
                  <h3 className="text-md font-semibold text-text-primary mb-4">메모</h3>
                  <p className="text-text-primary whitespace-pre-line">{selectedPatient.notes}</p>
                </div>
              )}

              {/* 콜백 필요 알림 - 종결 처리되지 않은 경우에만 표시 */}
              {needsCallback && !isCompleted && (
                <div className="card bg-yellow-50 border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-md font-semibold text-yellow-800 mb-1">콜백 필요</h3>
                      <p className="text-yellow-600">이 환자는 콜백이 필요합니다. 콜백 관리 탭에서 다음 콜백을 예약해주세요.</p>
                    </div>
                    <button
                      className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition-colors"
                      onClick={() => handleTabChange('콜백관리')}
                    >
                      콜백 관리로 이동
                    </button>
                  </div>
                </div>
              )}

              {/* 종결 처리 알림 - 종결 처리된 경우에만 표시 (수정된 부분) */}
              {isCompleted && (
                <div className={`card ${
                  isReservationCompleted(selectedPatient)
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${
                      isReservationCompleted(selectedPatient)
                        ? 'bg-green-200 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                    } flex items-center justify-center`}>
                      <Icon icon={isReservationCompleted(selectedPatient) ? HiOutlineCheck : HiOutlineStop} size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-md font-semibold ${
                        isReservationCompleted(selectedPatient) ? 'text-green-800' : 'text-gray-800'
                      }`}>
                        {isReservationCompleted(selectedPatient)
                          ? '이 환자는 예약 완료되었습니다'
                          : '이 환자는 종결 처리되었습니다'}
                      </h3>
                      
                      {/* 예약 정보와 상담 내용을 모두 표시 */}
                      {isReservationCompleted(selectedPatient) ? (
                        <div className="mt-1 space-y-2">
                          {/* 예약 정보 표시 */}
                          {getReservationInfo(selectedPatient) && (
                            <p className="text-sm text-green-600 font-medium">
                              {getReservationInfo(selectedPatient)}
                            </p>
                          )}
                          
                          {/* 상담 내용 표시 */}
                          {getReservationConsultationNotes(selectedPatient) && (
                            <p className="text-sm text-green-600">
                              상담내용: {getReservationConsultationNotes(selectedPatient)}
                            </p>
                          )}
                        </div>
                      ) : selectedPatient.completedReason ? (
                        // 일반 종결인 경우 기존 방식 유지
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                          상담내용: {selectedPatient.completedReason}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">
                          {isReservationCompleted(selectedPatient)
                            ? '예약 정보가 기록되지 않았습니다.'
                            : '종결 사유가 기록되지 않았습니다.'}
                        </p>
                      )}
                      
                      {selectedPatient.completedAt && (
                        <p className={`text-xs ${
                          isReservationCompleted(selectedPatient) ? 'text-green-500' : 'text-gray-500'
                        } mt-2`}>
                          {isReservationCompleted(selectedPatient) ? '예약 확정일: ' : '종결일: '}{selectedPatient.completedAt}
                        </p>
                      )}
                    </div>
                    <button
                      className={`px-4 py-2 ${
                        isReservationCompleted(selectedPatient)
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-gray-500 hover:bg-gray-600'
                      } text-white rounded-md transition-colors flex items-center gap-2`}
                      onClick={() => handleTabChange('콜백관리')}
                    >
                      <Icon icon={HiOutlineRefresh} size={18} />
                      <span>{isReservationCompleted(selectedPatient) ? '예약 취소' : '종결 취소'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 콜백 관리 탭 */}
          {activeTab === '콜백관리' && (
            <CallbackManagement patient={selectedPatient} />
          )}
          
          {/* 문자내역 탭 */}
          {activeTab === '문자내역' && (
            <PatientMessageHistory patient={selectedPatient} />
          )}
        </div>
      </div>
      
      {/* 🔥 환자 수정 모달 - refreshTrigger를 key로 전달하여 강제 리렌더링 */}
      {isEditModalOpen && (
        <PatientEditForm 
          key={`edit-${selectedPatient._id}-${refreshTrigger}`} // 🔥 key 추가로 강제 리렌더링
          patient={selectedPatient} 
          onClose={() => setIsEditModalOpen(false)} 
          onSuccess={handleEditSuccess}
        />
      )}
      
      {/* 문자 발송 모달 */}
      {isMessageSendModalOpen && (
        <MessageSendModal 
          isOpen={isMessageSendModalOpen}
          onClose={() => setIsMessageSendModalOpen(false)}
          selectedPatients={[selectedPatient]}
          onSendComplete={handleMessageSendComplete}
        />
      )}
    </div>
  )
}