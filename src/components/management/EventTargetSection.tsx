// src/components/management/EventTargetSection.tsx

'use client'

import { useState, useEffect } from 'react'
import { useAppDispatch } from '@/hooks/reduxHooks'
import { 
  Patient, 
  updateEventTargetInfo, 
  EventTargetInfo,
  EventTargetReason,
  EventCategory,
  selectPatient
} from '@/store/slices/patientsSlice'
import { 
  HiOutlineVolumeUp, 
  HiOutlineCheck, 
  HiOutlineTag, 
  HiOutlineCalendar,
  HiOutlineDocumentText,
  HiOutlineX,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineChevronDown,
  HiOutlineChevronUp
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { format } from 'date-fns'

// 이벤트 타겟 사유 옵션
const targetReasonOptions = [
  { value: 'price_hesitation', label: '가격 문의 후 망설임' },
  { value: 'treatment_consideration', label: '치료 방법 고민 중' },
  { value: 'scheduling_issue', label: '시간 조율 필요' },
  { value: 'competitor_comparison', label: '경쟁업체 비교 중' },
  { value: 'other', label: '기타 (직접 입력)' },
]

// 이벤트 카테고리 옵션
const eventCategoryOptions = [
  { value: 'discount', label: '할인 프로모션' },
  { value: 'new_treatment', label: '신규 치료법 안내' },
  { value: 'checkup', label: '정기 검진 리마인더' },
  { value: 'seasonal', label: '계절 이벤트' },
]

interface EventTargetSectionProps {
  patient: Patient
}

export default function EventTargetSection({ patient }: EventTargetSectionProps) {
  const dispatch = useAppDispatch()
  
  // 초기 이벤트 타겟 상태 설정
  const [isEventTarget, setIsEventTarget] = useState(
    patient?.eventTargetInfo?.isEventTarget || false
  )
  const [targetReason, setTargetReason] = useState<EventTargetReason>(
    patient?.eventTargetInfo?.targetReason || ''
  )
  const [customTargetReason, setCustomTargetReason] = useState(
    patient?.eventTargetInfo?.customTargetReason || ''
  )
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>(
    patient?.eventTargetInfo?.categories || []
  )
  const [scheduledDate, setScheduledDate] = useState(
    patient?.eventTargetInfo?.scheduledDate || format(new Date(), 'yyyy-MM-dd')
  )
  const [notes, setNotes] = useState(
    patient?.eventTargetInfo?.notes || ''
  )
  
  // 로딩 및 알림 상태
  const [isLoading, setIsLoading] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  
  // 편집 모드 상태 (true: 확장 폼, false: 요약 정보)
  const [isEditing, setIsEditing] = useState(!patient?.eventTargetInfo?.isEventTarget)
  
  // 삭제 확인 모달
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  // 환자 데이터가 변경되면 상태 업데이트
  useEffect(() => {
    if (patient?.eventTargetInfo) {
      setIsEventTarget(patient.eventTargetInfo.isEventTarget || false)
      setTargetReason(patient.eventTargetInfo.targetReason || '')
      setCustomTargetReason(patient.eventTargetInfo.customTargetReason || '')
      setSelectedCategories(patient.eventTargetInfo.categories || [])
      setScheduledDate(patient.eventTargetInfo.scheduledDate || format(new Date(), 'yyyy-MM-dd'))
      setNotes(patient.eventTargetInfo.notes || '')
      
      // 이벤트 타겟으로 설정되어 있고, 초기 로딩이면 편집 모드를 비활성화
      if (patient.eventTargetInfo.isEventTarget) {
        setIsEditing(false)
      }
    } else {
      // 환자 정보에 이벤트 타겟 정보가 없는 경우 초기화
      setIsEventTarget(false)
      setTargetReason('')
      setCustomTargetReason('')
      setSelectedCategories([])
      setScheduledDate(format(new Date(), 'yyyy-MM-dd'))
      setNotes('')
      setIsEditing(true)
    }
  }, [patient])
  
  // 타겟 사유 텍스트 가져오기
  const getReasonText = () => {
    if (targetReason === 'other' && customTargetReason) {
      return customTargetReason;
    }
    
    const option = targetReasonOptions.find(opt => opt.value === targetReason);
    return option?.label || '선택되지 않음';
  }
  
  // 이벤트 타겟 토글 처리
  const handleToggleEventTarget = async () => {
    // 종결 처리된 환자는 이벤트 타겟 설정 불가
    if (patient.isCompleted && !isEventTarget) {
      alert('종결 처리된 환자는 이벤트 타겟으로 설정할 수 없습니다.')
      return
    }
    
    const newIsEventTarget = !isEventTarget
    setIsEventTarget(newIsEventTarget)
    
    // 이벤트 타겟을 활성화하면 편집 모드로 전환
    if (newIsEventTarget) {
      setIsEditing(true)
      return;
    }
    
    // 이벤트 타겟을 해제하는 경우 간소화된 정보만 업데이트
    try {
      setIsLoading(true)
      
      await dispatch(updateEventTargetInfo({
        patientId: patient.id,
        eventTargetInfo: {
          isEventTarget: false,
          updatedAt: new Date().toISOString()
        }
      })).unwrap()
      
      // 환자 정보 최신화
      dispatch(selectPatient(patient.id))
      
      // 성공 메시지 표시
      setShowSuccessMessage(true)
      setTimeout(() => setShowSuccessMessage(false), 3000)
    } catch (error) {
      console.error('이벤트 타겟 해제 오류:', error)
      alert('이벤트 타겟 해제 중 오류가 발생했습니다.')
      // 실패 시 원상태로 복구
      setIsEventTarget(true)
    } finally {
      setIsLoading(false)
    }
  }
  
  // 카테고리 토글 처리
  const handleCategoryToggle = (categoryValue: EventCategory) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryValue)) {
        return prev.filter(c => c !== categoryValue)
      } else {
        return [...prev, categoryValue]
      }
    })
  }
  
  // 이벤트 타겟 정보 저장 처리
  const handleSaveEventTarget = async () => {
    // 종결 처리된 환자의 정보 업데이트 시 확인
    if (patient.isCompleted) {
      if (!confirm('종결 처리된 환자의 이벤트 타겟 정보를 수정하시겠습니까?')) {
        return
      }
    }
    
    // 유효성 검사
    if (targetReason === '') {
      alert('타겟 사유를 선택해주세요.')
      return
    }
    
    if (targetReason === 'other' && !customTargetReason.trim()) {
      alert('타겟 사유를 직접 입력해주세요.')
      return
    }
    
    if (selectedCategories.length === 0) {
      alert('최소 하나 이상의 이벤트 카테고리를 선택해주세요.')
      return
    }
    
    try {
      setIsLoading(true)
      
      // 이벤트 타겟 정보 준비
      const eventTargetInfo: Partial<EventTargetInfo> = {
        isEventTarget: true,
        targetReason,
        customTargetReason: targetReason === 'other' ? customTargetReason : undefined,
        categories: selectedCategories,
        scheduledDate,
        notes,
        updatedAt: new Date().toISOString()
      }
      
      // 첫 설정인 경우 생성일 추가
      if (!patient.eventTargetInfo?.createdAt) {
        eventTargetInfo.createdAt = new Date().toISOString()
      }
      
      // Redux 액션 디스패치
      await dispatch(updateEventTargetInfo({
        patientId: patient.id,
        eventTargetInfo
      })).unwrap()
      
      // 환자 정보 최신화
      dispatch(selectPatient(patient.id))
      
      // 성공 메시지 표시
      setShowSuccessMessage(true)
      setTimeout(() => setShowSuccessMessage(false), 3000)
      
      // 편집 모드 종료
      setIsEditing(false)
    } catch (error) {
      console.error('이벤트 타겟 정보 저장 오류:', error)
      alert('이벤트 타겟 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  
  // 삭제 처리
  const handleDeleteEventTarget = async () => {
    try {
      setIsLoading(true)
      
      // 이벤트 타겟 정보 초기화
      await dispatch(updateEventTargetInfo({
        patientId: patient.id,
        eventTargetInfo: {
          isEventTarget: false,
          targetReason: '',
          customTargetReason: '',
          categories: [],
          scheduledDate: '',
          notes: '',
          updatedAt: new Date().toISOString()
        }
      })).unwrap()
      
      // 환자 정보 최신화
      dispatch(selectPatient(patient.id))
      
      // 상태 초기화
      setIsEventTarget(false)
      setTargetReason('')
      setCustomTargetReason('')
      setSelectedCategories([])
      setScheduledDate(format(new Date(), 'yyyy-MM-dd'))
      setNotes('')
      
      // 편집 모드로 전환
      setIsEditing(true)
      
      // 모달 닫기
      setIsDeleteModalOpen(false)
      
      // 알림
      alert('이벤트 타겟 정보가 삭제되었습니다.')
    } catch (error) {
      console.error('이벤트 타겟 삭제 오류:', error)
      alert('이벤트 타겟 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className={`border rounded-lg transition-colors ${isEventTarget ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      {/* 헤더 영역 */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEventTarget ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
            <Icon icon={HiOutlineVolumeUp} size={20} />
          </div>
          <div>
            <h3 className={`text-md font-semibold ${isEventTarget ? 'text-blue-800' : 'text-text-primary'}`}>이벤트 타겟 관리</h3>
            <p className="text-sm text-text-secondary">특별 프로모션이나 이벤트에 적합한 환자로 관리합니다</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 수정 버튼 - 이벤트 타겟으로 지정된 경우에만 표시 */}
          {isEventTarget && !isEditing && (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-800"
                title="수정"
              >
                <Icon icon={HiOutlinePencil} size={18} />
              </button>
              
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-red-600 hover:text-red-800 ml-1"
                title="삭제"
              >
                <Icon icon={HiOutlineTrash} size={18} />
              </button>
            </>
          )}
          
          {/* 확장/축소 버튼 - 이벤트 타겟인 경우에만 표시 */}
          {isEventTarget && !isEditing && (
            <button 
              onClick={() => setIsEditing(!isEditing)} 
              className="text-blue-600 hover:text-blue-800 ml-1"
              title={isEditing ? "접기" : "펼치기"}
            >
              <Icon icon={isEditing ? HiOutlineChevronUp : HiOutlineChevronDown} size={18} />
            </button>
          )}
          
          {/* 토글 스위치 */}
          <span className="text-sm text-text-secondary ml-2">이벤트 타겟으로 지정</span>
          <button 
            onClick={handleToggleEventTarget}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEventTarget ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span
              className={`${isEventTarget ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
      </div>
      
      {/* 편집 모드 - 확장된 폼 */}
      {isEventTarget && isEditing && (
        <div className="px-5 py-4 border-t border-blue-200 space-y-4">
          {showSuccessMessage && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 flex items-center gap-2 text-green-800">
              <Icon icon={HiOutlineCheck} size={20} />
              <span>이벤트 타겟 정보가 저장되었습니다!</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">타겟 사유</label>
              <div className="relative">
                <select 
                  value={targetReason} 
                  onChange={(e) => setTargetReason(e.target.value as EventTargetReason)}
                  className="form-input pl-10 appearance-none"
                  disabled={isLoading}
                >
                  <option value="">타겟 사유 선택</option>
                  {targetReasonOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineTag} size={18} />
                </span>
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted pointer-events-none">
                  ▼
                </span>
              </div>
              {targetReason === 'other' && (
                <input 
                  type="text" 
                  value={customTargetReason} 
                  onChange={(e) => setCustomTargetReason(e.target.value)}
                  className="form-input mt-2 pl-4"
                  placeholder="직접 사유 입력..."
                  disabled={isLoading}
                />
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">발송 가능 시기</label>
              <div className="relative">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="form-input pl-10"
                  disabled={isLoading}
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                  <Icon icon={HiOutlineCalendar} size={18} />
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">이벤트 카테고리</label>
            <div className="flex flex-wrap gap-2">
              {eventCategoryOptions.map(category => (
                <button
                  key={category.value}
                  onClick={() => handleCategoryToggle(category.value as EventCategory)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                    selectedCategories.includes(category.value as EventCategory)
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-light-bg text-text-primary border border-border hover:bg-gray-200'
                  }`}
                >
                  {selectedCategories.includes(category.value as EventCategory) && (
                    <Icon icon={HiOutlineCheck} size={14} />
                  )}
                  {category.label}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">메모</label>
            <div className="relative">
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                className="form-input pl-10 min-h-[100px]"
                placeholder="이 환자에게 적합한 이벤트나 프로모션 정보를 메모하세요..."
                disabled={isLoading}
              />
              <span className="absolute left-3 top-3 text-text-muted">
                <Icon icon={HiOutlineDocumentText} size={18} />
              </span>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveEventTarget}
              disabled={isLoading}
              className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors flex items-center gap-2 ${
                isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  저장 중...
                </>
              ) : (
                <>
                  <Icon icon={HiOutlineCheck} size={16} />
                  타겟 정보 저장
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* 요약 정보 모드 - 축소된 정보 표시 */}
      {isEventTarget && !isEditing && (
        <div className="px-5 py-4 border-t border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-md border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">타겟 사유</p>
              <p className="text-text-primary mt-1">{getReasonText()}</p>
            </div>
            
            <div className="bg-white p-3 rounded-md border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">발송 가능 시기</p>
              <p className="text-text-primary mt-1">{scheduledDate || '-'}</p>
            </div>
            
            <div className="bg-white p-3 rounded-md border border-blue-100 md:col-span-2">
              <p className="text-sm text-blue-700 font-medium">이벤트 카테고리</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedCategories.length > 0 ? (
                  selectedCategories.map((category, idx) => {
                    const option = eventCategoryOptions.find(opt => opt.value === category);
                    return (
                      <span 
                        key={idx}
                        className="inline-block px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700"
                      >
                        {option?.label || category}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-text-secondary">선택된 카테고리 없음</span>
                )}
              </div>
            </div>
            
            {notes && (
              <div className="bg-white p-3 rounded-md border border-blue-100 md:col-span-2">
                <p className="text-sm text-blue-700 font-medium">메모</p>
                <p className="text-text-primary mt-1 text-sm whitespace-pre-line">{notes}</p>
              </div>
            )}
          </div>
          
          {/* 생성일/수정일 정보 */}
          {patient.eventTargetInfo?.createdAt && (
            <div className="mt-3 text-xs text-blue-600 flex justify-between">
              <span>생성: {new Date(patient.eventTargetInfo.createdAt).toLocaleDateString()}</span>
              {patient.eventTargetInfo?.updatedAt && (
                <span>수정: {new Date(patient.eventTargetInfo.updatedAt).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* 삭제 확인 모달 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">이벤트 타겟 삭제</h3>
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isLoading}
              >
                <Icon icon={HiOutlineX} size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-md mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <Icon icon={HiOutlineTrash} size={20} />
                  </div>
                  <div>
                    <p className="text-red-700 font-medium">이벤트 타겟 정보를 삭제하시겠습니까?</p>
                    <p className="text-sm text-red-600">
                      이 작업은 되돌릴 수 없으며, 이 환자의 모든 이벤트 타겟 정보가 삭제됩니다.
                    </p>
                  </div>
                </div>
                
                <div className="bg-light-bg p-4 rounded-md">
                  <div className="font-medium mb-1">삭제될 정보:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-text-secondary">타겟 사유:</div>
                    <div>{getReasonText()}</div>
                    <div className="text-text-secondary">발송 가능 시기:</div>
                    <div>{scheduledDate || '-'}</div>
                    <div className="text-text-secondary">카테고리:</div>
                    <div>
                      {selectedCategories.map((cat, idx) => {
                        const option = eventCategoryOptions.find(opt => opt.value === cat);
                        return idx === 0 ? option?.label || cat : `, ${option?.label || cat}`;
                      }).join('')}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeleteEventTarget}
                  disabled={isLoading}
                >
                  {isLoading ? '삭제 중...' : '삭제하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}