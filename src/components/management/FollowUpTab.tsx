// src/components/management/FollowUpTab.tsx
// 환자 상세 모달 내 사후관리 탭

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Patient } from '@/store/slices/patientsSlice'
import { format, addDays, differenceInDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  HiOutlineCalendar,
  HiOutlineClock,
  HiOutlineCheck,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePaperAirplane,
  HiOutlineRefresh
} from 'react-icons/hi'
import { Icon } from '../common/Icon'

interface FollowUp {
  _id: string
  patientId: string
  patientName: string
  phoneNumber: string
  type: 'D+1' | 'D+3' | '1주' | '2주' | '1개월' | '3개월' | '커스텀'
  scheduledDate: string
  status: 'pending' | 'sent' | 'cancelled'
  sentAt?: string
  templateId?: string
  templateName?: string
  notes?: string
  createdAt: string
}

interface FollowUpTabProps {
  patient: Patient
}

const FOLLOW_UP_TYPES = [
  { value: 'D+1', label: 'D+1 (내원 다음날)', days: 1 },
  { value: 'D+3', label: 'D+3 (내원 3일 후)', days: 3 },
  { value: '1주', label: '1주 후', days: 7 },
  { value: '2주', label: '2주 후', days: 14 },
  { value: '1개월', label: '1개월 후', days: 30 },
  { value: '3개월', label: '3개월 후', days: 90 },
]

export default function FollowUpTab({ patient }: FollowUpTabProps) {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFollowUp, setNewFollowUp] = useState({
    type: 'D+1' as FollowUp['type'],
    scheduledDate: '',
    notes: ''
  })

  // 사후관리 목록 조회
  const fetchFollowUps = useCallback(async () => {
    try {
      setIsLoading(true)
      const patientId = patient._id || patient.id
      const response = await fetch(`/api/follow-up?patientId=${patientId}`)
      const data = await response.json()

      if (data.success) {
        setFollowUps(data.data || [])
      }
    } catch (error) {
      console.error('사후관리 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }, [patient._id, patient.id])

  useEffect(() => {
    fetchFollowUps()
  }, [fetchFollowUps])

  // 타입 변경 시 날짜 자동 계산
  const handleTypeChange = (type: FollowUp['type']) => {
    const typeInfo = FOLLOW_UP_TYPES.find(t => t.value === type)
    if (typeInfo) {
      const baseDate = patient.visitDate ? new Date(patient.visitDate) : new Date()
      const scheduledDate = addDays(baseDate, typeInfo.days)
      setNewFollowUp({
        ...newFollowUp,
        type,
        scheduledDate: format(scheduledDate, 'yyyy-MM-dd')
      })
    } else {
      setNewFollowUp({ ...newFollowUp, type })
    }
  }

  // 사후관리 등록
  const handleAddFollowUp = async () => {
    if (!newFollowUp.scheduledDate) {
      alert('발송 예정일을 선택해주세요.')
      return
    }

    try {
      const response = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient._id || patient.id,
          patientName: patient.name,
          phoneNumber: patient.phoneNumber,
          type: newFollowUp.type,
          scheduledDate: newFollowUp.scheduledDate,
          notes: newFollowUp.notes
        })
      })

      const data = await response.json()
      if (data.success) {
        alert('사후관리가 등록되었습니다.')
        setShowAddForm(false)
        setNewFollowUp({ type: 'D+1', scheduledDate: '', notes: '' })
        fetchFollowUps()
      } else {
        alert(data.error || '등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('사후관리 등록 실패:', error)
      alert('등록 중 오류가 발생했습니다.')
    }
  }

  // 사후관리 삭제
  const handleDeleteFollowUp = async (id: string) => {
    if (!confirm('이 사후관리 일정을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/follow-up?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        fetchFollowUps()
      } else {
        alert(data.error || '삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('사후관리 삭제 실패:', error)
    }
  }

  // 즉시 발송
  const handleSendNow = async (id: string) => {
    if (!confirm('지금 바로 발송하시겠습니까?')) return

    try {
      const response = await fetch('/api/follow-up', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'send' })
      })

      const data = await response.json()
      if (data.success) {
        alert('발송이 완료되었습니다.')
        fetchFollowUps()
      } else {
        alert(data.error || '발송에 실패했습니다.')
      }
    } catch (error) {
      console.error('발송 실패:', error)
      alert('발송 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: FollowUp['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">대기중</span>
      case 'sent':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">발송완료</span>
      case 'cancelled':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">취소됨</span>
      default:
        return null
    }
  }

  const getDaysUntil = (scheduledDate: string) => {
    const days = differenceInDays(new Date(scheduledDate), new Date())
    if (days < 0) return <span className="text-red-500">D{days}</span>
    if (days === 0) return <span className="text-orange-500">오늘</span>
    return <span className="text-blue-500">D-{days}</span>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">사후관리</h3>
          <p className="text-sm text-text-secondary">내원 후 환자 케어 문자 발송 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFollowUps}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="새로고침"
          >
            <Icon icon={HiOutlineRefresh} size={18} />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Icon icon={HiOutlinePlus} size={18} />
            <span>사후관리 추가</span>
          </button>
        </div>
      </div>

      {/* 내원 정보 */}
      {patient.visitDate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-800">
            <Icon icon={HiOutlineCalendar} size={18} />
            <span className="font-medium">내원일: {patient.visitDate}</span>
          </div>
        </div>
      )}

      {/* 등록 폼 */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900">새 사후관리 등록</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">타입</label>
              <select
                value={newFollowUp.type}
                onChange={(e) => handleTypeChange(e.target.value as FollowUp['type'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {FOLLOW_UP_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
                <option value="커스텀">커스텀</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">발송 예정일</label>
              <input
                type="date"
                value={newFollowUp.scheduledDate}
                onChange={(e) => setNewFollowUp({ ...newFollowUp, scheduledDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
            <textarea
              value={newFollowUp.notes}
              onChange={(e) => setNewFollowUp({ ...newFollowUp, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={2}
              placeholder="추가 메모를 입력하세요"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
            <button
              onClick={handleAddFollowUp}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
            >
              등록
            </button>
          </div>
        </div>
      )}

      {/* 사후관리 목록 */}
      {followUps.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Icon icon={HiOutlineClock} size={48} className="mx-auto mb-3 text-gray-300" />
          <p>등록된 사후관리 일정이 없습니다.</p>
          <p className="text-sm mt-1">위의 버튼을 눌러 사후관리를 추가해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map((followUp) => (
            <div
              key={followUp._id}
              className={`border rounded-lg p-4 ${
                followUp.status === 'sent'
                  ? 'bg-green-50 border-green-200'
                  : followUp.status === 'cancelled'
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-500">타입</span>
                    <span className="text-lg font-bold text-primary">{followUp.type}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {format(new Date(followUp.scheduledDate), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                      </span>
                      {followUp.status === 'pending' && getDaysUntil(followUp.scheduledDate)}
                      {getStatusBadge(followUp.status)}
                    </div>

                    {followUp.templateName && (
                      <p className="text-sm text-gray-600">템플릿: {followUp.templateName}</p>
                    )}

                    {followUp.notes && (
                      <p className="text-sm text-gray-500">{followUp.notes}</p>
                    )}

                    {followUp.sentAt && (
                      <p className="text-xs text-green-600 mt-1">
                        발송일시: {format(new Date(followUp.sentAt), 'yyyy-MM-dd HH:mm')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {followUp.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleSendNow(followUp._id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="즉시 발송"
                      >
                        <Icon icon={HiOutlinePaperAirplane} size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteFollowUp(followUp._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="삭제"
                      >
                        <Icon icon={HiOutlineTrash} size={18} />
                      </button>
                    </>
                  )}

                  {followUp.status === 'sent' && (
                    <div className="p-2 text-green-600">
                      <Icon icon={HiOutlineCheck} size={18} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 빠른 등록 버튼들 */}
      {!showAddForm && patient.visitDate && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">빠른 등록</h4>
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_TYPES.map(type => {
              const scheduledDate = addDays(new Date(patient.visitDate!), type.days)
              const isAlreadyAdded = followUps.some(f => f.type === type.value && f.status !== 'cancelled')

              return (
                <button
                  key={type.value}
                  onClick={async () => {
                    if (isAlreadyAdded) return

                    try {
                      const response = await fetch('/api/follow-up', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          patientId: patient._id || patient.id,
                          patientName: patient.name,
                          phoneNumber: patient.phoneNumber,
                          type: type.value,
                          scheduledDate: format(scheduledDate, 'yyyy-MM-dd')
                        })
                      })

                      const data = await response.json()
                      if (data.success) {
                        fetchFollowUps()
                      }
                    } catch (error) {
                      console.error('빠른 등록 실패:', error)
                    }
                  }}
                  disabled={isAlreadyAdded}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    isAlreadyAdded
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-primary hover:text-white hover:border-primary'
                  }`}
                >
                  {type.label}
                  {isAlreadyAdded && ' ✓'}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
