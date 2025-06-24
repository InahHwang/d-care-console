// src/components/management/CancelVisitConfirmationModal.tsx

'use client'

import { useState } from 'react'
import { HiOutlineX, HiOutlineExclamationCircle } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { Patient } from '@/types/patient'

interface CancelVisitConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  patient: Patient | null
  isLoading?: boolean
}

export default function CancelVisitConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  patient,
  isLoading = false
}: CancelVisitConfirmationModalProps) {
  const [cancelReason, setCancelReason] = useState('')

  const handleConfirm = () => {
    onConfirm(cancelReason || '관리자 취소')
  }

  const handleClose = () => {
    if (!isLoading) {
      setCancelReason('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 relative">
        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600">취소 처리 중...</span>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Icon icon={HiOutlineExclamationCircle} size={24} className="text-red-500" />
            <h2 className="text-xl font-bold text-gray-900">내원확정 취소</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <Icon icon={HiOutlineX} size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 환자 정보 */}
        {patient && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{patient.name}</h3>
                <p className="text-sm text-gray-600">{patient.phoneNumber}</p>
                {patient.visitDate && (
                  <p className="text-sm text-red-600 mt-1">
                    현재 내원일: {patient.visitDate}
                    {patient.reservationTime && ` ${patient.reservationTime}`}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  내원확정
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 경고 메시지 */}
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
          <div className="flex">
            <Icon icon={HiOutlineExclamationCircle} size={20} className="text-yellow-400 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>주의:</strong> 내원확정을 취소하면 다음과 같이 처리됩니다.
              </p>
              <ul className="text-xs text-yellow-600 mt-2 space-y-1">
                <li>• 내원확정 상태가 해제됩니다</li>
                <li>• 예약 정보가 있다면 "예약확정" 상태로 되돌아갑니다</li>
                <li>• 취소 이력이 콜백 히스토리에 기록됩니다</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 취소 사유 입력 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            취소 사유 (선택사항)
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            disabled={isLoading}
            placeholder="내원확정을 취소하는 이유를 입력해주세요..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 resize-none"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            사유를 입력하지 않으면 "관리자 취소"로 기록됩니다.
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className="flex space-x-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            내원확정 취소
          </button>
        </div>
      </div>
    </div>
  )
}