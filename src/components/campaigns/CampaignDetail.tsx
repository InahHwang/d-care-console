// src/components/campaigns/CampaignDetail.tsx
'use client'

import { useState, useEffect, Key } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { RootState } from '@/store'
import { 
  createCampaign, 
  clearCurrentCampaign,
  Campaign,
  CampaignStatus,
  CampaignTarget,
  CampaignMessage,
  updateCampaignStatus
} from '@/store/slices/campaignsSlice'
import {
  EventTargetReason
} from '@/store/slices/patientsSlice'
import { EventCategory } from '@/types/messageLog'
import { 
  HiOutlineX, 
  HiOutlineTag, 
  HiOutlineCalendar, 
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineClipboardCheck,
  HiOutlineTemplate,
  HiOutlineChatAlt,
  HiOutlineSearch,
  HiOutlineCheck
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { format } from 'date-fns'


// 이벤트 타겟 사유 옵션
const targetReasonOptions = [
    { value: 'price_hesitation', label: '가격 문의 후 망설임' },
    { value: 'treatment_consideration', label: '치료 방법 고민 중' },
    { value: 'scheduling_issue', label: '시간 조율 필요' },
    { value: 'competitor_comparison', label: '경쟁업체 비교 중' },
    { value: 'other', label: '기타' },
  ]
  
  // 이벤트 카테고리 옵션
  const eventCategoryOptions = [
    { value: 'discount', label: '할인 프로모션' },
    { value: 'new_treatment', label: '신규 치료법 안내' },
    { value: 'checkup', label: '정기 검진 리마인더' },
    { value: 'seasonal', label: '계절 이벤트' },
  ]

// 메시지 템플릿 옵션
const messageTemplateOptions = [
  { value: '할인 안내', label: '할인 안내', content: '안녕하세요, {{name}}님. {{discount}}% 할인 이벤트를 안내해 드립니다. 관심 있으신 {{treatment}} 시술을 특별 가격에 만나보세요.' },
  { value: '신규 치료법', label: '신규 치료법 안내', content: '{{name}}님 안녕하세요. 저희 치과에 새로운 {{treatment}} 시술이 도입되었습니다. 통증이 적고 회복이 빠른 장점이 있습니다.' },
  { value: '정기 검진', label: '정기 검진 안내', content: '{{name}}님, 마지막 검진 이후 6개월이 경과했습니다. 구강 건강을 위해 정기 검진을 받아보세요.' },
  { value: '계절 이벤트', label: '계절 이벤트', content: '{{season}} 맞이 특별 이벤트! {{name}}님을 위한 시술 패키지를 준비했습니다. 이번 기회를 놓치지 마세요.' },
]

export default function CampaignDetail() {
  const dispatch = useAppDispatch()
  const { currentCampaign, isLoading } = useAppSelector((state: RootState) => state.campaigns)
  const { patients } = useAppSelector((state: RootState) => state.patients)
  
  // 새 캠페인 생성 모드인지 확인
  const isNewCampaign = currentCampaign?.id === 'new'
  
  // 폼 상태
  const [formValues, setFormValues] = useState<{
    name: string;
    scheduledAt: string;
    notes: string;
    targetCriteria: {
      category: EventCategory[];
      reason: EventTargetReason[];
      customFilter: string;
    };
    message: {
      title: string;
      content: string;
      templateName: string;
    };
  }>({
    name: '',
    scheduledAt: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
    notes: '',
    targetCriteria: {
      category: [],
      reason: [],
      customFilter: '',
    },
    message: {
      title: '',
      content: '',
      templateName: '',
    }
  })
  
  // 대상자 수 계산
  const [targetCount, setTargetCount] = useState(0)
  
  // 오류 상태
  const [errors, setErrors] = useState({
    name: '',
    scheduledAt: '',
    message: {
      title: '',
      content: ''
    }
  })
  
  // 현재 선택된 캠페인 정보로 폼 초기화
  useEffect(() => {
    if (currentCampaign && !isNewCampaign) {
      setFormValues({
        name: currentCampaign.name,
        scheduledAt: currentCampaign.scheduledAt || format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
        notes: currentCampaign.notes || '',
        targetCriteria: {
          category: currentCampaign.targetCriteria?.category || [],
          reason: currentCampaign.targetCriteria?.reason || [],
          customFilter: currentCampaign.targetCriteria?.customFilter || '',
        },
        message: {
          title: currentCampaign.message?.title || '',
          content: currentCampaign.message?.content || '',
          templateName: currentCampaign.message?.templateName || '',
        }
      })
    } else {
      // 새 캠페인의 경우 기본값으로 초기화
      setFormValues({
        name: '',
        scheduledAt: format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'),
        notes: '',
        targetCriteria: {
          category: [],
          reason: [],
          customFilter: '',
        },
        message: {
          title: '',
          content: '',
          templateName: '',
        }
      })
    }
  }, [currentCampaign, isNewCampaign])
  
  // 타겟 환자 수 계산
  useEffect(() => {
    const { category, reason } = formValues.targetCriteria
    
    // 선택된 필터가 없으면 모든 이벤트 타겟 환자 수
    if (category.length === 0 && reason.length === 0) {
      const count = patients.filter(patient => 
        patient.eventTargetInfo?.isEventTarget === true
      ).length
      setTargetCount(count)
      return
    }
    
    // 필터에 맞는 이벤트 타겟 환자 수
    const filteredCount = patients.filter(patient => {
      if (!patient.eventTargetInfo?.isEventTarget) return false
      
      // 카테고리 필터 적용
      const categoryMatch = category.length === 0 || 
        (patient.eventTargetInfo.categories && 
          patient.eventTargetInfo.categories.some(cat => category.includes(cat)))
      
      // 사유 필터 적용
      const reasonMatch = reason.length === 0 || 
        reason.includes(patient.eventTargetInfo.targetReason || '')
      
      return categoryMatch && reasonMatch
    }).length
    
    setTargetCount(filteredCount)
  }, [patients, formValues.targetCriteria])
  
  // 이벤트 카테고리 토글
  const handleCategoryToggle = (category: EventCategory) => {
    setFormValues(prev => {
      const currentCategories = prev.targetCriteria.category
      let updatedCategories
      
      if (currentCategories.includes(category)) {
        updatedCategories = currentCategories.filter(c => c !== category)
      } else {
        updatedCategories = [...currentCategories, category]
      }
      
      return {
        ...prev,
        targetCriteria: {
          ...prev.targetCriteria,
          category: updatedCategories
        }
      }
    })
  }
  
  // 타겟 사유 토글
  const handleReasonToggle = (reason: EventTargetReason) => {
    setFormValues(prev => {
      const currentReasons = prev.targetCriteria.reason
      let updatedReasons
      
      if (currentReasons.includes(reason)) {
        updatedReasons = currentReasons.filter(r => r !== reason)
      } else {
        updatedReasons = [...currentReasons, reason]
      }
      
      return {
        ...prev,
        targetCriteria: {
          ...prev.targetCriteria,
          reason: updatedReasons
        }
      }
    })
  }
  
  // 메시지 템플릿 선택
  const handleTemplateSelect = (templateName: string) => {
    const template = messageTemplateOptions.find(t => t.value === templateName);
    
    if (template) {
      setFormValues(prev => ({
        ...prev,
        message: {
          title: template.label,
          content: template.content,
          templateName: template.value
        }
      }));
    }
  }
  
  // 기본 입력 필드 변경 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
    
    // 오류 메시지 초기화
    if (name === 'name' || name === 'scheduledAt') {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }
  
  // 메시지 필드 변경 처리
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    setFormValues(prev => ({
      ...prev,
      message: {
        ...prev.message,
        [name]: value
      }
    }))
    
    // 오류 메시지 초기화
    setErrors(prev => ({
      ...prev,
      message: {
        ...prev.message,
        [name]: ''
      }
    }))
  }
  
  // 모달 닫기
  const handleClose = () => {
    dispatch(clearCurrentCampaign())
  }
  
  // 캠페인 저장
  const handleSaveCampaign = async (status: CampaignStatus = 'draft') => {
    // 유효성 검사
    let isValid = true
    const newErrors = {
      name: '',
      scheduledAt: '',
      message: {
        title: '',
        content: ''
      }
    }
    
    if (!formValues.name.trim()) {
      newErrors.name = '캠페인 이름을 입력해주세요'
      isValid = false
    }
    
    if (status === 'scheduled' && !formValues.scheduledAt) {
      newErrors.scheduledAt = '발송 예약 일시를 입력해주세요'
      isValid = false
    }
    
    if (!formValues.message.title.trim()) {
      newErrors.message.title = '메시지 제목을 입력해주세요'
      isValid = false
    }
    
    if (!formValues.message.content.trim()) {
      newErrors.message.content = '메시지 내용을 입력해주세요'
      isValid = false
    }
    
    setErrors(newErrors)
    
    if (!isValid) return
    
    try {
      const campaignData = {
        name: formValues.name,
        status,
        scheduledAt: formValues.scheduledAt,
        targetCount,
        targetCriteria: formValues.targetCriteria as CampaignTarget,
        message: formValues.message as CampaignMessage,
        notes: formValues.notes,
        creator: '현재 사용자'  // 실제 구현 시 로그인한 사용자 정보 사용
      }
      
      await dispatch(createCampaign(campaignData)).unwrap()
      
      alert(status === 'draft' ? '캠페인이 임시 저장되었습니다.' : '캠페인이 예약되었습니다.')
      handleClose()
    } catch (error) {
      console.error('캠페인 저장 오류:', error)
      alert('캠페인 저장 중 오류가 발생했습니다.')
    }
  }
  
  // 캠페인 상태에 따른 배지 스타일
  const getStatusBadgeStyle = (status: CampaignStatus) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  // 캠페인 상태 한글 표시
  const getStatusLabel = (status: CampaignStatus) => {
    const statusMap: Record<CampaignStatus, string> = {
      draft: '임시 저장',
      scheduled: '예약됨',
      in_progress: '진행 중',
      completed: '완료됨',
      cancelled: '취소됨'
    };
    
    return statusMap[status] || status;
  }
  
  if (!currentCampaign) return null
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">
              {isNewCampaign ? '새 캠페인 생성' : `캠페인 상세: ${currentCampaign.name}`}
            </h2>
            {!isNewCampaign && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyle(currentCampaign.status)}`}>
                {getStatusLabel(currentCampaign.status)}
              </span>
            )}
          </div>
          <button 
            className="text-text-secondary hover:text-text-primary" 
            onClick={handleClose}
          >
            <Icon icon={HiOutlineX} size={20} />
          </button>
        </div>
        
        {/* 모달 바디 */}
        <div className="p-6">
          {/* 읽기 전용 모드 (새 캠페인이 아니고 임시 저장 상태도 아닌 경우) */}
          {!isNewCampaign && currentCampaign.status !== 'draft' ? (
            <div className="space-y-6">
              {/* 기본 정보 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">기본 정보</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 캠페인 이름 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineDocumentText} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">캠페인 이름</p>
                      <p className="text-text-primary">{currentCampaign.name}</p>
                    </div>
                  </div>
                  
                  {/* 상태 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineClipboardCheck} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">상태</p>
                      <p className="text-text-primary">{getStatusLabel(currentCampaign.status)}</p>
                    </div>
                  </div>
                  
                  {/* 생성일 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineCalendar} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">생성일</p>
                      <p className="text-text-primary">{currentCampaign.createdAt?.split('T')[0] || '-'}</p>
                    </div>
                  </div>
                  
                  {/* 예약일 */}
                  {currentCampaign.scheduledAt && (
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon={HiOutlineCalendar} 
                        size={18} 
                        className="text-text-muted mt-0.5" 
                      />
                      <div>
                        <p className="text-sm text-text-secondary">예약일</p>
                        <p className="text-text-primary">{currentCampaign.scheduledAt.replace('T', ' ') || '-'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 완료일 */}
                  {currentCampaign.completedAt && (
                    <div className="flex items-start gap-2">
                      <Icon 
                        icon={HiOutlineCalendar} 
                        size={18} 
                        className="text-text-muted mt-0.5" 
                      />
                      <div>
                        <p className="text-sm text-text-secondary">완료일</p>
                        <p className="text-text-primary">{currentCampaign.completedAt.replace('T', ' ') || '-'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 대상자 수 */}
                  <div className="flex items-start gap-2">
                    <Icon 
                      icon={HiOutlineUsers} 
                      size={18} 
                      className="text-text-muted mt-0.5" 
                    />
                    <div>
                      <p className="text-sm text-text-secondary">대상자 수</p>
                      <p className="text-text-primary">{currentCampaign.targetCount}명</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 대상자 필터 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">대상자 필터</h3>
                
                <div className="space-y-4">
                  {/* 카테고리 필터 */}
                  <div>
                    <p className="text-sm text-text-secondary mb-2">이벤트 카테고리</p>
                    <div className="flex flex-wrap gap-2">
                      {currentCampaign.targetCriteria.category?.length ? (
                        currentCampaign.targetCriteria.category.map((category: string, index: Key | null | undefined) => {
                          const option = eventCategoryOptions.find(opt => opt.value === category)
                          return (
                            <span 
                              key={index}
                              className="inline-block px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              {option?.label || category}
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-text-secondary">모든 카테고리</span>
                      )}
                    </div>
                  </div>
                  
                  {/* 사유 필터 */}
                  <div>
                    <p className="text-sm text-text-secondary mb-2">타겟 사유</p>
                    <div className="flex flex-wrap gap-2">
                      {currentCampaign.targetCriteria.reason?.length ? (
                        currentCampaign.targetCriteria.reason.map((reason: string, index: Key | null | undefined) => {
                          const option = targetReasonOptions.find(opt => opt.value === reason)
                          return (
                            <span 
                              key={index}
                              className="inline-block px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                            >
                              {option?.label || reason}
                            </span>
                          )
                        })
                      ) : (
                        <span className="text-text-secondary">모든 사유</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 메시지 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">메시지 내용</h3>
                
                <div className="space-y-4">
                  {/* 메시지 템플릿 */}
                  {currentCampaign.message.templateName && (
                    <div>
                      <p className="text-sm text-text-secondary mb-1">템플릿</p>
                      <div className="flex items-center gap-2">
                        <Icon 
                          icon={HiOutlineTemplate} 
                          size={16} 
                          className="text-text-muted" 
                        />
                        <span className="text-text-primary">{currentCampaign.message.templateName}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* 메시지 제목 */}
                  <div>
                    <p className="text-sm text-text-secondary mb-1">제목</p>
                    <p className="text-text-primary font-medium">{currentCampaign.message.title}</p>
                  </div>
                  
                  {/* 메시지 내용 */}
                  <div>
                    <p className="text-sm text-text-secondary mb-1">내용</p>
                    <div className="p-4 bg-light-bg rounded-md whitespace-pre-line">
                      {currentCampaign.message.content}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 메모 카드 */}
              {currentCampaign.notes && (
                <div className="card">
                  <h3 className="text-md font-semibold text-text-primary mb-4">메모</h3>
                  <p className="text-text-primary whitespace-pre-line">{currentCampaign.notes}</p>
                </div>
              )}
            </div>
          ) : (
            /* 편집 모드 (새 캠페인이거나 임시 저장 상태인 경우) */
            <div className="space-y-6">
              {/* 기본 정보 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">기본 정보</h3>
                
                <div className="space-y-4">
                  {/* 캠페인 이름 */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
                      캠페인 이름 <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formValues.name}
                      onChange={handleChange}
                      className={`form-input w-full ${errors.name ? 'border-error' : ''}`}
                      placeholder="5월 할인 이벤트 안내"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-error">{errors.name}</p>
                    )}
                  </div>
                  
                  {/* 예약 일시 */}
                  <div>
                    <label htmlFor="scheduledAt" className="block text-sm font-medium text-text-primary mb-1">
                      예약 일시 <span className="text-error">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      id="scheduledAt"
                      name="scheduledAt"
                      value={formValues.scheduledAt}
                      onChange={handleChange}
                      className={`form-input w-full ${errors.scheduledAt ? 'border-error' : ''}`}
                    />
                    {errors.scheduledAt && (
                      <p className="mt-1 text-sm text-error">{errors.scheduledAt}</p>
                    )}
                  </div>
                  
                  {/* 메모 */}
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium text-text-primary mb-1">
                      메모
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formValues.notes}
                      onChange={handleChange}
                      className="form-input w-full min-h-[100px]"
                      placeholder="캠페인과 관련된 메모를 입력하세요..."
                    />
                  </div>
                </div>
              </div>
              
              {/* 대상자 필터 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">대상자 필터</h3>
                
                <div className="space-y-4">
                  {/* 필터 요약 정보 */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Icon icon={HiOutlineUsers} size={20} />
                    </div>
                    <div>
                      <h4 className="text-blue-800 font-medium">현재 대상자 수: {targetCount}명</h4>
                      <p className="text-sm text-blue-600">
                        이벤트 타겟으로 지정된 환자 중 아래 필터 조건에 맞는 환자들에게 메시지가 발송됩니다.
                      </p>
                    </div>
                  </div>
                  
                  {/* 이벤트 카테고리 필터 */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      이벤트 카테고리 필터
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {eventCategoryOptions.map(category => (
                        <button
                          key={category.value}
                          onClick={() => handleCategoryToggle(category.value as EventCategory)}
                          className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                            formValues.targetCriteria.category.includes(category.value as EventCategory)
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-light-bg text-text-primary border border-border hover:bg-gray-200'
                          }`}
                        >
                          {formValues.targetCriteria.category.includes(category.value as EventCategory) && (
                            <Icon icon={HiOutlineCheck} size={14} />
                          )}
                          {category.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      선택하지 않으면 모든 카테고리가 대상이 됩니다.
                    </p>
                  </div>
                  
                  {/* 타겟 사유 필터 */}
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      타겟 사유 필터
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {targetReasonOptions.map(reason => (
                        <button
                          key={reason.value}
                          onClick={() => handleReasonToggle(reason.value as EventTargetReason)}
                          className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                            formValues.targetCriteria.reason.includes(reason.value as EventTargetReason)
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-light-bg text-text-primary border border-border hover:bg-gray-200'
                          }`}
                        >
                          {formValues.targetCriteria.reason.includes(reason.value as EventTargetReason) && (
                            <Icon icon={HiOutlineCheck} size={14} />
                          )}
                          {reason.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      선택하지 않으면 모든 사유가 대상이 됩니다.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 메시지 작성 카드 */}
              <div className="card">
                <h3 className="text-md font-semibold text-text-primary mb-4">메시지 작성</h3>
                
                <div className="space-y-4">
                  {/* 템플릿 선택 */}
                  <div>
                    <label htmlFor="templateName" className="block text-sm font-medium text-text-primary mb-1">
                      메시지 템플릿
                    </label>
                    <div className="relative">
                      <select
                        id="templateName"
                        value={formValues.message.templateName}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                        className="form-input w-full pl-10 appearance-none"
                      >
                        <option value="">템플릿 선택...</option>
                        {messageTemplateOptions.map(template => (
                          <option key={template.value} value={template.value}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                        <Icon icon={HiOutlineTemplate} size={18} />
                      </span>
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-muted pointer-events-none">
                        ▼
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      템플릿을 선택하면 기본 메시지가 자동으로 입력됩니다.
                    </p>
                  </div>
                  
                  {/* 메시지 제목 */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-text-primary mb-1">
                      메시지 제목 <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="title"
                        name="title"
                        value={formValues.message.title}
                        onChange={handleMessageChange}
                        className={`form-input w-full pl-10 ${errors.message.title ? 'border-error' : ''}`}
                        placeholder="5월 특별 할인 안내"
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted">
                        <Icon icon={HiOutlineChatAlt} size={18} />
                      </span>
                    </div>
                    {errors.message.title && (
                      <p className="mt-1 text-sm text-error">{errors.message.title}</p>
                    )}
                  </div>
                  
                  {/* 메시지 내용 */}
                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-text-primary mb-1">
                      메시지 내용 <span className="text-error">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        id="content"
                        name="content"
                        value={formValues.message.content}
                        onChange={handleMessageChange}
                        className={`form-input w-full min-h-[150px] pl-10 ${errors.message.content ? 'border-error' : ''}`}
                        placeholder="안녕하세요, {{name}}님. 5월 가정의 달을 맞아 임플란트 시술을 20% 할인된 가격에 제공해드립니다."
                      />
                      <span className="absolute left-3 top-3 text-text-muted">
                        <Icon icon={HiOutlineDocumentText} size={18} />
                      </span>
                    </div>
                    {errors.message.content && (
                      <p className="mt-1 text-sm text-error">{errors.message.content}</p>
                    )}
                    <p className="mt-1 text-xs text-text-secondary">
                    {"{{name}}, {{discount}}, {{treatment}} 등의 변수는 실제 발송 시 환자 정보로 대체됩니다."}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 버튼 영역 */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn bg-gray-600 hover:bg-gray-700 text-white"
                  onClick={() => handleSaveCampaign('draft')}
                  disabled={isLoading}
                >
                  {isLoading ? '저장 중...' : '임시 저장'}
                </button>
                <button
                  type="button"
                  className="btn bg-primary hover:bg-primary/90 text-white"
                  onClick={() => handleSaveCampaign('scheduled')}
                  disabled={isLoading}
                >
                  {isLoading ? '저장 중...' : '예약하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}