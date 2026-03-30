// src/components/management/ReservationDateModal.tsx
// 🔥 기존 기능 100% 유지 + 실시간 데이터 동기화만 추가

'use client'

import { useState } from 'react'
import { HiOutlineX, HiOutlineCalendar } from 'react-icons/hi'
import { Icon } from '../common/Icon'
import { Patient } from '@/types/patient'
// 🔥 데이터 동기화 유틸리티 import 추가 (기존 기능에 영향 없음)
import { PatientDataSync } from '@/utils/dataSync'

interface ReservationDateModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reservationDate: string, reservationTime: string) => void
  patient: Patient | null
  isLoading?: boolean
}

export default function ReservationDateModal({
  isOpen,
  onClose,
  onConfirm,
  patient,
  isLoading = false
}: ReservationDateModalProps) {
  const [reservationDate, setReservationDate] = useState('')
  const [reservationTime, setReservationTime] = useState('')
  const [errors, setErrors] = useState<{date?: string, time?: string}>({})

  // 🔥 환자 상태에 따른 모달 타이틀과 메시지 결정 (기존 로직 그대로 유지)
  const getModalInfo = () => {
    if (!patient) {
      return {
        title: '예약일시 입력',
        description: '예약일시를 입력해주세요.',
        dateLabel: '예약일',
        timeLabel: '예약시간',
        instruction: '예약완료 → 내원확정 순서로 자동 처리됩니다.',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-400',
        textColor: 'text-orange-700'
      };
    }

    // 환자 상태가 "예약확정"인 경우 (이 케이스는 실제로는 발생하지 않지만 안전장치)
    if (patient.status === '예약확정') {
      return {
        title: '내원 일자 입력',
        description: '이미 예약이 확정된 환자의 실제 내원 일자를 입력해주세요.',
        dateLabel: '실제 내원일',
        timeLabel: '실제 내원시간',
        instruction: '예약된 일정과 다른 날짜에 내원한 경우 실제 내원 일자를 기록합니다.',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-400',
        textColor: 'text-green-700'
      };
    }

    // 기타 모든 경우 (갑작스러운 내원 - 잠재고객, 콜백필요, 부재중, VIP, 종결 등)
    return {
      title: '내원 일자 입력',
      description: '예정에 없던 갑작스러운 내원을 위해 내원 일자를 입력해주세요.',
      dateLabel: '내원일',
      timeLabel: '내원시간',
      instruction: '예약 과정 없이 바로 내원확정 처리됩니다. (과거 날짜 선택 가능)',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-400',
      textColor: 'text-orange-700'
    };
  };

  const modalInfo = getModalInfo();

  // 모달이 열릴 때마다 상태 초기화 (기존 로직 그대로 유지)
  const handleModalOpen = () => {
    if (isOpen) {
      setReservationDate('')
      setReservationTime('')
      setErrors({})
    }
  }

  // 모달이 열릴 때 상태 초기화 (useEffect 대신 조건부 실행) (기존 로직 그대로 유지)
  if (isOpen && !reservationDate && !reservationTime) {
    // 초기값 설정 (오늘 날짜와 현재 시간 기준)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const currentHour = today.getHours()
    const defaultTime = currentHour >= 9 && currentHour < 18 
      ? `${String(currentHour + 1).padStart(2, '0')}:00`
      : '10:00'
    
    setReservationDate(todayStr)
    setReservationTime(defaultTime)
  }

  // 폼 검증 (기존 로직 그대로 유지)
  const validateForm = () => {
    const newErrors: {date?: string, time?: string} = {}
    
    if (!reservationDate) {
      newErrors.date = `${modalInfo.dateLabel}을 선택해주세요`
    }
    
    if (!reservationTime) {
      newErrors.time = `${modalInfo.timeLabel}을 선택해주세요`
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 🔥 확인 버튼 핸들러 - 기존 로직 + 데이터 동기화 트리거만 추가
  const handleConfirm = () => {
    if (validateForm()) {
      // 🔥 기존 onConfirm 호출 (기존 로직 그대로)
      onConfirm(reservationDate, reservationTime)
      
      // 🔥 성공 후 데이터 동기화 트리거 (새로 추가된 부분 - 기존 기능에 영향 없음)
      if (patient) {
        PatientDataSync.onUpdate(patient._id || patient.id, 'ReservationDateModal', {
          reservationDate,
          reservationTime,
          action: 'reservation_update'
        })
      }
    }
  }

  // 모달 닫기 (기존 로직 그대로 유지)
  const handleClose = () => {
    if (!isLoading) {
      setReservationDate('')
      setReservationTime('')
      setErrors({})
      onClose()
    }
  }

  if (!isOpen) return null

  // 시간 옵션 생성 (09:00 ~ 18:00, 30분 단위) (기존 로직 그대로 유지)
  const timeOptions = []
  for (let hour = 9; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      timeOptions.push(timeStr)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 relative">
        {/* 로딩 오버레이 (기존 UI 그대로 유지) */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600">처리 중...</span>
            </div>
          </div>
        )}

        {/* 🔥 헤더 - 동적 타이틀 적용 (기존 UI 그대로 유지) */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Icon icon={HiOutlineCalendar} size={24} className="text-orange-500" />
            <h2 className="text-xl font-bold text-gray-900">{modalInfo.title}</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <Icon icon={HiOutlineX} size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 환자 정보 (기존 UI 그대로 유지) */}
        {patient && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{patient.name}</h3>
                <p className="text-sm text-gray-600">{patient.phoneNumber}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {patient.status}
                </span>
                {/* 🔥 예약 정보가 있으면 표시 */}
                {patient.reservationDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    기존 예약: {patient.reservationDate} {patient.reservationTime}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 🔥 안내 메시지 - 동적 설명 및 색상 적용 (기존 UI 그대로 유지) */}
        <div className={`mb-6 p-4 ${modalInfo.bgColor} border-l-4 ${modalInfo.borderColor}`}>
          <div className="flex">
            <div className="ml-3">
              <p className={`text-sm ${modalInfo.textColor}`}>
                <strong>{modalInfo.title}</strong>을 위해 일시를 입력해주세요.
                <br />
                <span className="text-xs">
                  {modalInfo.description}
                </span>
                <br />
                <span className="text-xs font-medium mt-1 block">
                  💡 {modalInfo.instruction}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 🔥 날짜 입력 - 동적 라벨 적용 (기존 UI 그대로 유지) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {modalInfo.dateLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={reservationDate}
            onChange={(e) => {
              setReservationDate(e.target.value)
              if (errors.date) setErrors({...errors, date: undefined})
            }}
            disabled={isLoading}
            // 🔥 min 속성 제거 - 과거 날짜 선택 가능
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${
              errors.date ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.date && (
            <p className="mt-1 text-sm text-red-600">{errors.date}</p>
          )}
        </div>

        {/* 🔥 시간 입력 - 동적 라벨 적용 (기존 UI 그대로 유지) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {modalInfo.timeLabel} <span className="text-red-500">*</span>
          </label>
          <select
            value={reservationTime}
            onChange={(e) => {
              setReservationTime(e.target.value)
              if (errors.time) setErrors({...errors, time: undefined})
            }}
            disabled={isLoading}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${
              errors.time ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">시간을 선택하세요</option>
            {timeOptions.map(time => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          {errors.time && (
            <p className="mt-1 text-sm text-red-600">{errors.time}</p>
          )}
        </div>

        {/* 버튼 영역 (기존 UI 그대로 유지) */}
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
            className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}