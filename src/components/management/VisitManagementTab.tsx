// src/components/management/VisitManagementTab.tsx - 기록 이력 표시 개선
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks'
import { RootState } from '@/store'
import { Patient, PostVisitStatus } from '@/types/patient'
import { 
  HiOutlineClipboardList, 
  HiOutlineCalendar, 
  HiOutlineCurrencyDollar,
  HiOutlinePhone,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineExclamation,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineClock,
  HiOutlineDocumentText
} from 'react-icons/hi'
import { Icon } from '../common/Icon'
import EventTargetSection from './EventTargetSection'

interface VisitManagementTabProps {
  patient: Patient
}

export default function VisitManagementTab({ patient }: VisitManagementTabProps) {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector((state: RootState) => state.auth.user)
  
  // 기존 상태들...
  const [firstConsultationContent, setFirstConsultationContent] = useState('')
  const [treatmentCost, setTreatmentCost] = useState<number>(0)
  const [postVisitStatus, setPostVisitStatus] = useState<PostVisitStatus>('')
  const [treatmentStartDate, setTreatmentStartDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'installment' | 'lump_sum'>('lump_sum')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [terminationReason, setTerminationReason] = useState('')
  const [treatmentTiming, setTreatmentTiming] = useState<'immediate' | 'delayed'>('immediate')
  const [reminderCallbackDate, setReminderCallbackDate] = useState('')
  const [reminderNotes, setReminderNotes] = useState('')
  
  // 재콜백 필요 시 콜백 관리 상태
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('')
  const [visitCallbackReason, setVisitCallbackReason] = useState('')
  const [visitCallbackNotes, setVisitCallbackNotes] = useState('')
  
  // 콜백 처리 관련 상태들
  const [isEditingCallback, setIsEditingCallback] = useState(false)
  const [editingCallbackId, setEditingCallbackId] = useState('')
  const [showNextCallbackForm, setShowNextCallbackForm] = useState(false)
  const [nextCallbackDate, setNextCallbackDate] = useState('')
  const [nextCallbackTime, setNextCallbackTime] = useState('')
  const [nextCallbackNotes, setNextCallbackNotes] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  const [isLoading, setIsLoading] = useState(false)

  // 🆕 각 상태별 기록 존재 여부 확인 함수들
  const hasRecallbackRecord = useCallback(() => {
    return getVisitCallbacks().length > 0
  }, [patient?.callbackHistory, refreshTrigger])

  const hasTreatmentConsentRecord = useCallback(() => {
    return !!(patient?.postVisitConsultation?.treatmentConsentInfo?.treatmentStartDate ||
             patient?.postVisitConsultation?.treatmentConsentInfo?.consentNotes)
  }, [patient?.postVisitConsultation])

  const hasTreatmentStartRecord = useCallback(() => {
    return !!(patient?.postVisitConsultation?.paymentInfo?.paymentType ||
             patient?.postVisitConsultation?.nextVisitDate)
  }, [patient?.postVisitConsultation])

  const hasTerminationRecord = useCallback(() => {
    return !!(patient?.postVisitConsultation?.completionNotes)
  }, [patient?.postVisitConsultation])

  // 🆕 각 상태별 기록 요약 정보 생성 함수들
  const getRecallbackRecordSummary = useCallback(() => {
    const callbacks = getVisitCallbacks()
    if (callbacks.length === 0) return null
    
    const latestCallback = callbacks[callbacks.length - 1]
    return {
      lastSaved: latestCallback.createdAt || latestCallback.date,
      title: '콜백 등록 정보', // 🔧 제목 변경
      details: [
        `총 ${callbacks.length}개 콜백 등록`,
        `최근 콜백: ${latestCallback.type} (${latestCallback.status})`,
        latestCallback.notes ? `내용: ${latestCallback.notes.substring(0, 50)}${latestCallback.notes.length > 50 ? '...' : ''}` : ''
      ].filter(Boolean)
    }
  }, [patient?.callbackHistory, refreshTrigger])

  const getTreatmentConsentRecordSummary = useCallback(() => {
    const consentInfo = patient?.postVisitConsultation?.treatmentConsentInfo
    if (!consentInfo?.treatmentStartDate && !consentInfo?.consentNotes) return null
    
    // 🔧 안전한 타입 접근 방식
    const postVisitData = patient?.postVisitConsultation as any
    const treatmentTiming = (consentInfo as any)?.treatmentTiming || 'immediate'
    
    const details = [
      consentInfo.treatmentStartDate ? `치료 시작 예정일: ${consentInfo.treatmentStartDate}` : '',
      `치료 시작 시기: ${treatmentTiming === 'immediate' ? '즉시 시작' : '추후 시작'}`
    ]
    
    // 추후 시작인 경우 리마인더 정보 추가
    if (treatmentTiming === 'delayed') {
      const reminderDate = (consentInfo as any)?.reminderCallbackDate
      const reminderNotes = (consentInfo as any)?.reminderNotes
      
      if (reminderDate) {
        details.push(`리마인더 콜백 날짜: ${reminderDate}`)
      }
      if (reminderNotes) {
        details.push(`리마인더 내용: ${reminderNotes.substring(0, 100)}${reminderNotes.length > 100 ? '...' : ''}`)
      }
    }
    
    return {
      lastSaved: postVisitData?.updatedAt || patient?.updatedAt,
      title: '치료 동의 정보', // 🔧 제목 변경
      details: details.filter(Boolean)
    }
  }, [patient?.postVisitConsultation])

  const getTreatmentStartRecordSummary = useCallback(() => {
    const paymentInfo = patient?.postVisitConsultation?.paymentInfo
    const nextVisitDate = patient?.postVisitConsultation?.nextVisitDate
    if (!paymentInfo?.paymentType && !nextVisitDate) return null
    
    // 🔧 안전한 타입 접근 방식
    const postVisitData = patient?.postVisitConsultation as any
    
    return {
      lastSaved: postVisitData?.updatedAt || patient?.updatedAt,
      title: '치료 시작 정보', // 🔧 제목 변경
      details: [
        paymentInfo?.paymentType ? `결제 방식: ${paymentInfo.paymentType === 'lump_sum' ? '일시불' : '분할납'}` : '',
        nextVisitDate ? `치료 시작 예정일: ${nextVisitDate}` : '',
        paymentInfo?.downPayment ? `선입금: ${paymentInfo.downPayment.toLocaleString()}원` : ''
      ].filter(Boolean)
    }
  }, [patient?.postVisitConsultation])

  const getTerminationRecordSummary = useCallback(() => {
    const completionNotes = patient?.postVisitConsultation?.completionNotes
    if (!completionNotes) return null
    
    // 🔧 안전한 타입 접근 방식
    const postVisitData = patient?.postVisitConsultation as any
    
    return {
      lastSaved: postVisitData?.updatedAt || patient?.updatedAt,
      title: '종결 정보', // 🔧 제목 변경
      details: [
        `종결 사유: ${completionNotes.substring(0, 100)}${completionNotes.length > 100 ? '...' : ''}`
      ]
    }
  }, [patient?.postVisitConsultation])

  // 🆕 기록 요약 컴포넌트
  const RecordSummary = ({ record, title }: { record: any, title: string }) => {
    if (!record) return null
    
    const formatDate = (dateStr: string) => {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }
    
    return (
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-medium text-gray-800 flex items-center">
            <Icon icon={HiOutlineDocumentText} size={16} className="mr-2 text-blue-600" />
            {record.title} {/* 🔧 title 사용 */}
          </h5>
          <span className="text-xs text-gray-500">
            {formatDate(record.lastSaved)}
          </span>
        </div>
        <div className="space-y-1">
          {record.details.map((detail: string, index: number) => (
            <div key={index} className="text-xs text-gray-600">
              • {detail}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 환자 데이터 로드 (기존 코드)
  useEffect(() => {
    if (patient?.postVisitConsultation) {
      setFirstConsultationContent((patient.postVisitConsultation as any)?.firstVisitConsultationContent || '')
      setTreatmentCost(patient.postVisitConsultation.estimateInfo?.discountPrice || 0)
    }
    if (patient?.postVisitStatus) {
      setPostVisitStatus(patient.postVisitStatus)
    }
    
    // 기존 필드들 로드...
    const today = new Date().toISOString().split('T')[0]
    setCallbackDate(today)
    setCallbackTime('')
    setVisitCallbackReason('')
    setVisitCallbackNotes('')
    
    setNextCallbackDate(today)
    setNextCallbackTime('')
    setNextCallbackNotes('')
    setShowNextCallbackForm(false)
    setIsEditingCallback(false)
    setEditingCallbackId('')
    
    setTreatmentTiming('immediate')
    setReminderCallbackDate('')
    setReminderNotes('')
  }, [patient, refreshTrigger])

  // 유효성 검사 (기존 코드)
  const isFormValid = () => {
    if (!firstConsultationContent.trim()) return false
    if (!treatmentCost || treatmentCost <= 0) return false
    if (!postVisitStatus) return false
    
    if (postVisitStatus === '치료동의') {
      if (!treatmentStartDate) return false
      if (treatmentTiming === 'delayed' && (!reminderCallbackDate || !reminderNotes.trim())) return false
    }
    if (postVisitStatus === '치료시작' && !nextVisitDate) return false
    if (postVisitStatus === '종결' && !terminationReason.trim()) return false
    if (postVisitStatus === '재콜백필요' && (!callbackDate || !visitCallbackNotes.trim())) return false
    
    return true
  }

  // 내원 콜백 이력 필터링 함수 (무제한)
  const getVisitCallbacks = useCallback(() => {
    return patient?.callbackHistory?.filter(cb => 
      cb.isVisitManagementCallback === true && 
      cb.type && cb.type.startsWith('내원') && 
      cb.type.match(/\d+차$/) // 숫자차로 끝나는 것만
    ) || []
  }, [patient?.callbackHistory, refreshTrigger])

  // 다음 내원 콜백 타입 결정 함수 (무제한)
  const getNextVisitCallbackType = useCallback(() => {
    const currentVisitCallbacks = getVisitCallbacks()
    const completedCallbacks = currentVisitCallbacks.filter(cb => 
      cb.status === '완료' || cb.status === '부재중'
    )
    
    // 완료된 콜백들의 차수를 추출
    const completedNumbers = completedCallbacks.map(cb => {
      const match = cb.type.match(/내원(\d+)차/)
      return match ? parseInt(match[1]) : 0
    }).filter(num => num > 0)
    
    // 가장 높은 차수 + 1
    const maxNumber = completedNumbers.length > 0 ? Math.max(...completedNumbers) : 0
    return `내원${maxNumber + 1}차`
  }, [getVisitCallbacks])

  // 콜백 완료 처리 - 개선된 버전
  const handleCompleteCallback = async (callback: any) => {
    if (!confirm(`${callback.type} 콜백을 완료 처리하시겠습니까?`)) return
    
    try {
      const patientId = patient._id || patient.id
      const now = new Date()
      const completedDate = now.toISOString().split('T')[0]
      const completedTime = now.toTimeString().split(' ')[0].substring(0, 5)
      
      const response = await fetch(`/api/patients/${patientId}/callbacks/${callback.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: '완료',
          completedAt: now.toISOString(),
          completedDate,
          completedTime
        }),
      })
      
      if (!response.ok) throw new Error('콜백 완료 처리에 실패했습니다.')
      
      alert(`${callback.type} 콜백이 완료 처리되었습니다.`)
      
      setRefreshTrigger(prev => prev + 1)
      setShowNextCallbackForm(true) // 다음 콜백 폼 표시
      
    } catch (error) {
      console.error('콜백 완료 처리 실패:', error)
      alert('콜백 완료 처리에 실패했습니다.')
    }
  }

  // 콜백 부재중 처리 - 개선된 버전
  const handleMissedCallback = async (callback: any) => {
    if (!confirm(`${callback.type} 콜백을 부재중 처리하시겠습니까?`)) return
    
    try {
      const patientId = patient._id || patient.id
      const now = new Date()
      const completedDate = now.toISOString().split('T')[0]
      const completedTime = now.toTimeString().split(' ')[0].substring(0, 5)
      
      const response = await fetch(`/api/patients/${patientId}/callbacks/${callback.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: '부재중',
          completedAt: now.toISOString(),
          completedDate,
          completedTime
        }),
      })
      
      if (!response.ok) throw new Error('콜백 부재중 처리에 실패했습니다.')
      
      alert(`${callback.type} 콜백이 부재중 처리되었습니다.`)
      
      setRefreshTrigger(prev => prev + 1)
      setShowNextCallbackForm(true) // 다음 콜백 폼 표시
      
    } catch (error) {
      console.error('콜백 부재중 처리 실패:', error)
      alert('콜백 부재중 처리에 실패했습니다.')
    }
  }

  // 콜백 수정 시작
  const handleEditCallback = (callback: any) => {
    setVisitCallbackReason(callback.visitManagementReason || '')
    setVisitCallbackNotes(callback.notes || '')
    setCallbackDate(callback.date)
    setCallbackTime(callback.time || '')
    setIsEditingCallback(true)
    setEditingCallbackId(callback.id)
  }

  // 콜백 수정 저장
  const handleSaveCallbackEdit = async () => {
    try {
      const patientId = patient._id || patient.id
      
      const response = await fetch(`/api/patients/${patientId}/callbacks/${editingCallbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: callbackDate,
          time: callbackTime,
          notes: visitCallbackNotes,
          visitManagementReason: visitCallbackReason,
          updatedAt: new Date().toISOString()
        }),
      })
      
      if (!response.ok) throw new Error('콜백 수정에 실패했습니다.')
      
      alert('콜백이 수정되었습니다.')
      setIsEditingCallback(false)
      setEditingCallbackId('')
      
      setRefreshTrigger(prev => prev + 1)
      
    } catch (error) {
      console.error('콜백 수정 실패:', error)
      alert('콜백 수정에 실패했습니다.')
    }
  }

  // 콜백 삭제
  const handleDeleteCallback = async (callback: any) => {
    if (!confirm(`${callback.type} 콜백을 삭제하시겠습니까?\n\n⚠️ 삭제 후 새 콜백 등록 시 차수가 다시 계산됩니다.`)) return
    
    try {
      const patientId = patient._id || patient.id
      
      const response = await fetch(`/api/patients/${patientId}/callbacks/${callback.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('콜백 삭제에 실패했습니다.')
      
      alert(`${callback.type} 콜백이 삭제되었습니다.`)
      
      setRefreshTrigger(prev => prev + 1)
      
    } catch (error) {
      console.error('콜백 삭제 실패:', error)
      alert('콜백 삭제에 실패했습니다.')
    }
  }

  // 다음 콜백 등록
  const handleAddNextCallback = async () => {
    if (!nextCallbackNotes.trim()) {
      alert('상담 계획을 입력해주세요.')
      return
    }
    
    try {
      const patientId = patient._id || patient.id
      const nextType = getNextVisitCallbackType()
      
      const response = await fetch(`/api/patients/${patientId}/callbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: nextType,
          date: nextCallbackDate,
          time: nextCallbackTime || undefined,
          status: '예정',
          notes: nextCallbackNotes,
          isVisitManagementCallback: true,
          visitManagementReason: '연속 콜백'
        }),
      })
      
      if (!response.ok) throw new Error('다음 콜백 등록에 실패했습니다.')
      
      alert(`${nextType} 콜백이 등록되었습니다.`)
      setShowNextCallbackForm(false)
      setNextCallbackNotes('')
      setNextCallbackTime('')
      
      setRefreshTrigger(prev => prev + 1)
      
    } catch (error) {
      console.error('다음 콜백 등록 실패:', error)
      alert('다음 콜백 등록에 실패했습니다.')
    }
  }

  // 기존 handleSavePostVisitStatus 함수 (수정 없음)
  const handleSavePostVisitStatus = async () => {
    if (!isFormValid()) {
      alert('모든 필수 항목을 입력해주세요.')
      return
    }

    setIsLoading(true)
    try {
      const patientId = patient._id || patient.id
      const postVisitConsultation: any = {
        firstVisitConsultationContent: firstConsultationContent,
        estimateInfo: {
          discountPrice: treatmentCost,
          regularPrice: 0,
          discountEvent: '',
          patientReaction: ''
        }
      }

      if (postVisitStatus === '재콜백필요') {
        postVisitConsultation.nextCallbackDate = callbackDate
        postVisitConsultation.nextConsultationPlan = visitCallbackNotes
      } else if (postVisitStatus === '치료동의') {
        postVisitConsultation.treatmentConsentInfo = {
          treatmentStartDate,
          consentNotes: '치료에 동의하였습니다.',
          estimatedTreatmentPeriod: '',
          treatmentTiming,
          reminderCallbackDate: treatmentTiming === 'delayed' ? reminderCallbackDate : undefined,
          reminderNotes: treatmentTiming === 'delayed' ? reminderNotes : undefined
        }
      } else if (postVisitStatus === '치료시작') {
        postVisitConsultation.paymentInfo = {
          paymentType: paymentMethod,
          downPayment: paymentMethod === 'installment' ? 0 : undefined,
          installmentPlan: paymentMethod === 'installment' ? '분할납 계획' : undefined
        }
        postVisitConsultation.nextVisitDate = nextVisitDate
      } else if (postVisitStatus === '종결') {
        postVisitConsultation.completionNotes = terminationReason
      }

      const requestData: any = {
        postVisitStatus,
        postVisitConsultation,
        postVisitNotes: firstConsultationContent,
        nextVisitDate: postVisitStatus === '치료시작' ? nextVisitDate : undefined,
      }

      if (postVisitStatus === '재콜백필요') {
        requestData.visitCallbackData = {
          type: getNextVisitCallbackType(),
          date: callbackDate,
          time: callbackTime || undefined,
          status: '예정',
          notes: visitCallbackNotes,
          isVisitManagementCallback: true,
          visitManagementReason: visitCallbackReason
        }
      }

      if (postVisitStatus === '치료동의' && treatmentTiming === 'delayed') {
        requestData.reminderCallbackData = {
          type: '리마인더콜백',
          date: reminderCallbackDate,
          status: '예정',
          notes: `[치료 시작 리마인더 콜백]\n치료 시작 예정일: ${treatmentStartDate}\n\n리마인더 내용:\n${reminderNotes}`,
          isVisitManagementCallback: true,
          isReminderCallback: true,
          treatmentStartDate,
          visitManagementReason: '치료 시작 리마인더'
        }
      }

      const response = await fetch(`/api/patients/${patientId}/post-visit-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) throw new Error('저장에 실패했습니다.')

      alert('내원 후 상태가 저장되었습니다.')
      
      setRefreshTrigger(prev => prev + 1)
      
    } catch (error) {
      console.error('내원 후 상태 저장 실패:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 🆕 개선된 상태 옵션 - 기록 존재 여부 표시 포함
  const statusOptions = [
    { 
      value: '재콜백필요', 
      label: '재콜백 필요', 
      color: 'bg-yellow-100 text-yellow-800', 
      description: '추가 상담이 필요한 상태',
      hasRecord: hasRecallbackRecord(),
      recordSummary: getRecallbackRecordSummary()
    },
    { 
      value: '치료동의', 
      label: '치료 동의', 
      color: 'bg-blue-100 text-blue-800', 
      description: '치료에 동의했지만 아직 시작하지 않음',
      hasRecord: hasTreatmentConsentRecord(),
      recordSummary: getTreatmentConsentRecordSummary()
    },
    { 
      value: '치료시작', 
      label: '치료 시작', 
      color: 'bg-green-100 text-green-800', 
      description: '치료가 시작된 상태',
      hasRecord: hasTreatmentStartRecord(),
      recordSummary: getTreatmentStartRecordSummary()
    },
    { 
      value: '종결', 
      label: '종결', 
      color: 'bg-red-100 text-red-800', 
      description: '치료 완료 또는 종결',
      hasRecord: hasTerminationRecord(),
      recordSummary: getTerminationRecordSummary()
    },
  ]

  // 예정된 콜백이 있는지 확인
  const hasPendingCallbacks = getVisitCallbacks().some(cb => cb.status === '예정')

  // 🆕 현재 선택된 상태의 기록 요약 가져오기
  const currentStatusRecord = statusOptions.find(option => option.value === postVisitStatus)?.recordSummary

  return (
    <div className="space-y-6">
      {/* 내원 후 상태 관리 폼 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-text-primary">내원 후 상태 / 콜백 관리</h3>
          {!isFormValid() && (
            <div className="flex items-center text-red-600 text-sm">
              <Icon icon={HiOutlineExclamation} size={16} className="mr-1" />
              <span>필수 항목을 모두 입력해주세요</span>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          {/* 기존 필수 필드들 (내원 후 첫 상담 내용, 최종 치료 비용, 내원 후 상태) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내원 후 첫 상담 내용 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={firstConsultationContent}
              onChange={(e) => setFirstConsultationContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="내원 후 진행된 첫 상담 내용을 자세히 입력하세요..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              최종 치료 비용 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={treatmentCost === 0 ? '' : treatmentCost}
                onChange={(e) => setTreatmentCost(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="최종 확정된 치료 비용을 입력하세요"
                min="0"
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">원</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              내원 후 상태 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostVisitStatus(option.value as PostVisitStatus)}
                  className={`p-4 text-left rounded-lg border-2 transition-colors relative ${
                    postVisitStatus === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {/* 🆕 기록 존재 표시 점 */}
                  {option.hasRecord && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
                  )}
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${option.color}`}>
                      {option.label}
                    </span>
                    {postVisitStatus === option.value && (
                      <Icon icon={HiOutlineCheck} size={20} className="text-blue-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 🆕 선택된 상태의 기존 기록 표시 */}
          {currentStatusRecord && (
            <RecordSummary 
              record={currentStatusRecord} 
              title={statusOptions.find(option => option.value === postVisitStatus)?.label || ''}
            />
          )}

          {/* 재콜백 필요 시 추가 필드 - 개선된 내원 콜백 관리 */}
          {postVisitStatus === '재콜백필요' && (
            <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
              <h4 className="text-sm font-medium text-yellow-800 mb-3 flex items-center">
                <Icon icon={HiOutlinePhone} size={16} className="mr-2" />
                내원 콜백 관리
              </h4>
              
              {/* 개선된 내원 콜백 이력 표시 */}
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">내원 콜백 이력</h5>
                {getVisitCallbacks().length === 0 ? (
                  <div className="text-center py-2 text-gray-500 bg-gray-50 rounded text-xs">
                    등록된 내원 콜백이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getVisitCallbacks().map((callback) => (
                      <div 
                        key={callback.id}
                        className={`p-3 border rounded-lg text-xs ${
                          callback.status === '완료' 
                            ? 'border-green-200 bg-green-50' 
                            : callback.status === '부재중'
                            ? 'border-red-200 bg-red-50'
                            : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              callback.type?.includes('1차') ? 'bg-orange-100 text-orange-800' :
                              callback.type?.includes('2차') ? 'bg-yellow-100 text-yellow-800' :
                              callback.type?.includes('3차') ? 'bg-red-100 text-red-800' :
                              callback.type?.includes('4차') ? 'bg-purple-100 text-purple-800' :
                              callback.type?.includes('5차') ? 'bg-indigo-100 text-indigo-800' :
                              callback.type?.includes('6차') ? 'bg-pink-100 text-pink-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {callback.type}
                            </span>
                            {/* 🔧 원래 예정된 날짜/시간을 먼저 표시 */}
                            <span className="text-gray-600 font-medium">{callback.date}</span>
                            {callback.time && <span className="text-gray-600">{callback.time}</span>}
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              callback.status === '완료' ? 'bg-green-100 text-green-800' :
                              callback.status === '부재중' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {callback.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* 🆕 처리 날짜/시간 표시 (완료/부재중인 경우에만 - 우측에 배치) */}
                            {(callback.status === '완료' || callback.status === '부재중') && (callback.completedTime || callback.completedDate) && (
                              <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                <Icon icon={HiOutlineClock} size={12} className="mr-1" />
                                <span>
                                  처리: {callback.completedDate || callback.date} {callback.completedTime && callback.completedTime}
                                </span>
                              </div>
                            )}
                            
                            {/* 콜백 처리 버튼들 */}
                            {callback.status === '예정' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMissedCallback(callback)}
                                  className="px-2 py-1 text-xs text-white bg-orange-600 rounded hover:bg-orange-700"
                                  title="부재중 처리"
                                >
                                  부재중
                                </button>
                                <button
                                  onClick={() => handleCompleteCallback(callback)}
                                  className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                                  title="완료 처리"
                                >
                                  완료
                                </button>
                                <button
                                  onClick={() => handleEditCallback(callback)}
                                  className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                  title="수정"
                                >
                                  <Icon icon={HiOutlinePencil} size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteCallback(callback)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                  title="삭제"
                                >
                                  <Icon icon={HiOutlineTrash} size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 🔧 콜백 내용 표시 - 간소화 */}
                        {callback.notes && (
                          <div className="text-gray-700 text-xs mt-2 p-2 bg-white rounded border">
                            <span className="font-medium">상담 계획:</span> {callback.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 다음 콜백 등록 폼 (완료/부재중 처리 후 자동 표시) */}
              {showNextCallbackForm && (
                <div className="border-t pt-3 mb-4">
                  <h5 className="text-sm font-medium text-green-600 mb-3">
                    다음 내원 콜백 등록 ({getNextVisitCallbackType()})
                  </h5>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">콜백 날짜 <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={nextCallbackDate}
                          onChange={(e) => setNextCallbackDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">콜백 시간 (선택)</label>
                        <input
                          type="time"
                          value={nextCallbackTime}
                          onChange={(e) => setNextCallbackTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">상담 계획 <span className="text-red-500">*</span></label>
                      <textarea
                        value={nextCallbackNotes}
                        onChange={(e) => setNextCallbackNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        rows={3}
                        placeholder="다음 내원 콜백에서 진행할 상담 내용과 계획을 입력하세요..."
                        required
                      />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowNextCallbackForm(false)}
                        className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleAddNextCallback}
                        className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
                        disabled={!nextCallbackNotes.trim()}
                      >
                        {getNextVisitCallbackType()} 등록
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 새 콜백 등록 폼 (기존 방식 + 수정 모드) */}
              {(!hasPendingCallbacks || isEditingCallback) && !showNextCallbackForm && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-gray-600">
                      {isEditingCallback ? '내원 콜백 수정' : `새 내원 콜백 등록 (${getNextVisitCallbackType()})`}
                    </h5>
                    {isEditingCallback && (
                      <button
                        onClick={() => {
                          setIsEditingCallback(false)
                          setEditingCallbackId('')
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        취소
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">콜백 날짜 <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1 font-medium">콜백 시간 (선택)</label>
                        <input
                          type="time"
                          value={callbackTime}
                          onChange={(e) => setCallbackTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">상담 계획 <span className="text-red-500">*</span></label>
                      <textarea
                        value={visitCallbackNotes}
                        onChange={(e) => setVisitCallbackNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        rows={3}
                        placeholder="내원 후 콜백에서 진행할 상담 내용과 계획을 입력하세요..."
                        required
                      />
                    </div>
                    
                    {/* 수정 모드일 때는 별도 저장 버튼 */}
                    {isEditingCallback && (
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => {
                            setIsEditingCallback(false)
                            setEditingCallbackId('')
                          }}
                          className="px-3 py-1 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                        >
                          취소
                        </button>
                        <button
                          onClick={handleSaveCallbackEdit}
                          className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
                          disabled={!visitCallbackNotes.trim()}
                        >
                          수정 저장
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 기존 다른 상태별 추가 필드들 (치료동의, 치료시작, 종결) */}
          {postVisitStatus === '치료동의' && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center">
                <Icon icon={HiOutlineCheck} size={16} className="mr-2" />
                치료 동의 정보
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">치료 시작 예정일 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={treatmentStartDate}
                    onChange={(e) => setTreatmentStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">치료 시작 시기</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="immediate"
                        checked={treatmentTiming === 'immediate'}
                        onChange={(e) => setTreatmentTiming(e.target.value as 'immediate' | 'delayed')}
                        className="mr-2"
                      />
                      <span className="text-sm">즉시 시작</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="delayed"
                        checked={treatmentTiming === 'delayed'}
                        onChange={(e) => setTreatmentTiming(e.target.value as 'immediate' | 'delayed')}
                        className="mr-2"
                      />
                      <span className="text-sm">추후 시작 (리마인더 필요)</span>
                    </label>
                  </div>
                </div>
                
                {treatmentTiming === 'delayed' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">리마인더 콜백 날짜 <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={reminderCallbackDate}
                        onChange={(e) => setReminderCallbackDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-700 mb-1 font-medium">리마인더 내용 <span className="text-red-500">*</span></label>
                      <textarea
                        value={reminderNotes}
                        onChange={(e) => setReminderNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="치료 시작 전 환자에게 전달할 리마인더 내용을 입력하세요..."
                        required
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {postVisitStatus === '치료시작' && (
            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
              <h4 className="text-sm font-medium text-green-800 mb-3 flex items-center">
                <Icon icon={HiOutlineCurrencyDollar} size={16} className="mr-2" />
                치료 시작 정보
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-2 font-medium">결제 방식</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="lump_sum"
                        checked={paymentMethod === 'lump_sum'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'installment' | 'lump_sum')}
                        className="mr-2"
                      />
                      <span className="text-sm">일시불</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="installment"
                        checked={paymentMethod === 'installment'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'installment' | 'lump_sum')}
                        className="mr-2"
                      />
                      <span className="text-sm">분할납</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">치료 시작 예정일 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={nextVisitDate}
                    onChange={(e) => setNextVisitDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {postVisitStatus === '종결' && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h4 className="text-sm font-medium text-red-800 mb-3 flex items-center">
                <Icon icon={HiOutlineX} size={16} className="mr-2" />
                종결 정보
              </h4>
              
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">종결 사유 <span className="text-red-500">*</span></label>
                <textarea
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="치료 종결 사유를 자세히 입력하세요..."
                  required
                />
              </div>
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleSavePostVisitStatus}
              disabled={isLoading || !isFormValid()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <Icon icon={HiOutlineCheck} size={16} className="mr-2" />
                  저장
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 이벤트 타겟 관리 섹션 */}
      <EventTargetSection patient={patient} />
    </div>
  )
}