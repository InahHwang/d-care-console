// src/components/test/CallbackHistoryV2.tsx
// 콜백 기록 컴포넌트 (1/2/3차 표시)

'use client'

import React, { useState } from 'react'
import { CallbackRecord, CallbackResult } from '@/types/patientV2'

interface CallbackHistoryV2Props {
  callbacks: CallbackRecord[]
  type: 'preVisit' | 'postVisit'  // 전화상담 / 내원후
  onAddCallback?: (callback: Omit<CallbackRecord, 'attempt' | 'createdAt'>) => void
  readonly?: boolean
}

const CALLBACK_RESULTS: { value: CallbackResult; label: string; color: string }[] = [
  { value: '통화완료', label: '통화완료', color: 'bg-blue-100 text-blue-800' },
  { value: '부재중', label: '부재중', color: 'bg-gray-100 text-gray-800' },
  { value: '콜백재요청', label: '콜백 재요청', color: 'bg-yellow-100 text-yellow-800' },
  { value: '예약확정', label: '예약확정', color: 'bg-green-100 text-green-800' },
  { value: '예약취소', label: '예약취소', color: 'bg-red-100 text-red-800' },
  { value: '치료동의', label: '치료동의', color: 'bg-emerald-100 text-emerald-800' },
  { value: '치료거부', label: '치료거부', color: 'bg-red-100 text-red-800' },
  { value: '보류', label: '보류', color: 'bg-orange-100 text-orange-800' },
]

export default function CallbackHistoryV2({
  callbacks,
  type,
  onAddCallback,
  readonly = false
}: CallbackHistoryV2Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [newCallback, setNewCallback] = useState<{
    result: CallbackResult
    notes: string
  }>({
    result: '통화완료',
    notes: ''
  })

  const typeLabel = type === 'preVisit' ? '전화상담' : '내원후'

  const handleSubmit = () => {
    if (!onAddCallback) return

    const now = new Date()
    onAddCallback({
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().substring(0, 5),
      result: newCallback.result,
      notes: newCallback.notes,
      counselorId: '' // API에서 채워짐
    })

    setNewCallback({ result: '통화완료', notes: '' })
    setIsAdding(false)
  }

  const getResultStyle = (result: CallbackResult) => {
    const found = CALLBACK_RESULTS.find(r => r.value === result)
    return found?.color || 'bg-gray-100 text-gray-800'
  }

  const getAttemptLabel = (attempt: number) => {
    if (attempt === 1) return '1차'
    if (attempt === 2) return '2차'
    if (attempt === 3) return '3차'
    return `${attempt}차`
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          {typeLabel} 콜백 기록 ({callbacks.length}회)
        </h4>
        {!readonly && onAddCallback && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {isAdding ? '취소' : '+ 콜백 추가'}
          </button>
        )}
      </div>

      {/* 콜백 추가 폼 */}
      {isAdding && (
        <div className="p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
          <div className="text-xs font-medium text-blue-700">
            {getAttemptLabel(callbacks.length + 1)} 콜백 등록
          </div>

          <div className="flex flex-wrap gap-1">
            {CALLBACK_RESULTS.map(r => (
              <button
                key={r.value}
                onClick={() => setNewCallback({ ...newCallback, result: r.value })}
                className={`text-xs px-2 py-1 rounded ${
                  newCallback.result === r.value
                    ? 'ring-2 ring-blue-500 ' + r.color
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <textarea
            value={newCallback.notes}
            onChange={(e) => setNewCallback({ ...newCallback, notes: e.target.value })}
            placeholder="상담 메모..."
            className="w-full text-sm p-2 border rounded resize-none"
            rows={2}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              등록
            </button>
          </div>
        </div>
      )}

      {/* 콜백 기록 목록 */}
      {callbacks.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4">
          콜백 기록이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {callbacks.map((callback, index) => (
            <div
              key={index}
              className="p-2 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded">
                    {getAttemptLabel(callback.attempt)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getResultStyle(callback.result)}`}>
                    {callback.result}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {callback.date} {callback.time}
                </div>
              </div>

              {callback.notes && (
                <div className="text-xs text-gray-600 mt-1 pl-1">
                  {callback.notes}
                </div>
              )}

              {callback.counselorName && (
                <div className="text-xs text-gray-400 mt-1 pl-1">
                  담당: {callback.counselorName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 콜백 요약 */}
      {callbacks.length > 0 && (
        <div className="text-xs text-gray-500 border-t pt-2">
          총 {callbacks.length}회 콜백 |
          마지막: {callbacks[callbacks.length - 1].date} ({callbacks[callbacks.length - 1].result})
        </div>
      )}
    </div>
  )
}
