// src/components/common/ToothSelector.tsx - 치아 선택 UI 컴포넌트

'use client'

import React, { useState, useCallback } from 'react'

// 치아 번호 데이터 (FDI 국제 표기법)
const teethData = {
  upperPermanent: {
    right: [18, 17, 16, 15, 14, 13, 12, 11],
    left: [21, 22, 23, 24, 25, 26, 27, 28]
  },
  lowerPermanent: {
    right: [48, 47, 46, 45, 44, 43, 42, 41],
    left: [31, 32, 33, 34, 35, 36, 37, 38]
  },
  upperPrimary: {
    right: [55, 54, 53, 52, 51],
    left: [61, 62, 63, 64, 65]
  },
  lowerPrimary: {
    right: [85, 84, 83, 82, 81],
    left: [71, 72, 73, 74, 75]
  }
}

const allPermanentTeeth = [
  ...teethData.upperPermanent.right,
  ...teethData.upperPermanent.left,
  ...teethData.lowerPermanent.right,
  ...teethData.lowerPermanent.left
]

const upperTeeth = [
  ...teethData.upperPermanent.right,
  ...teethData.upperPermanent.left
]

const lowerTeeth = [
  ...teethData.lowerPermanent.right,
  ...teethData.lowerPermanent.left
]

interface ToothSelectorProps {
  selectedTeeth: number[]
  onChange: (teeth: number[]) => void
  disabled?: boolean
  unknown?: boolean
  onUnknownChange?: (unknown: boolean) => void
}

export default function ToothSelector({
  selectedTeeth,
  onChange,
  disabled = false,
  unknown = false,
  onUnknownChange
}: ToothSelectorProps) {
  const [showPrimary, setShowPrimary] = useState(false)

  const toggleTooth = useCallback((toothNum: number) => {
    if (disabled || unknown) return

    const newTeeth = selectedTeeth.includes(toothNum)
      ? selectedTeeth.filter(t => t !== toothNum)
      : [...selectedTeeth, toothNum]
    onChange(newTeeth)
  }, [selectedTeeth, onChange, disabled, unknown])

  const toggleUnknown = useCallback(() => {
    if (disabled) return
    const newUnknown = !unknown
    if (newUnknown) {
      // 미확인 선택 시 치아 선택 초기화
      onChange([])
    }
    onUnknownChange?.(newUnknown)
  }, [unknown, onChange, onUnknownChange, disabled])

  const toggleTeethGroup = useCallback((teeth: number[]) => {
    if (disabled || unknown) return

    const allSelected = teeth.every(t => selectedTeeth.includes(t))
    if (allSelected) {
      onChange(selectedTeeth.filter(t => !teeth.includes(t)))
    } else {
      const newTeeth = teeth.filter(t => !selectedTeeth.includes(t))
      onChange([...selectedTeeth, ...newTeeth])
    }
  }, [selectedTeeth, onChange, disabled, unknown])

  const isGroupFullySelected = useCallback((teeth: number[]) => {
    return teeth.every(t => selectedTeeth.includes(t))
  }, [selectedTeeth])

  const ToothButton = ({ num, size = 'normal' }: { num: number; size?: 'normal' | 'small' }) => {
    const isSelected = selectedTeeth.includes(num)
    const sizeClasses = size === 'small'
      ? 'w-6 h-6 text-xs'
      : 'w-7 h-7 text-xs'

    return (
      <button
        type="button"
        onClick={() => toggleTooth(num)}
        disabled={disabled || unknown}
        className={`
          ${sizeClasses} rounded font-medium transition-all flex-shrink-0
          ${unknown
            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
            : isSelected
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {num}
      </button>
    )
  }

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">불편한 치아 선택</h3>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showPrimary}
            onChange={(e) => setShowPrimary(e.target.checked)}
            disabled={disabled}
            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          유치 표시
        </label>
      </div>

      {/* 치아 차트 */}
      <div className="p-4 space-y-2">

        {/* 상악 영구치 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleTeethGroup(upperTeeth)}
            disabled={disabled || unknown}
            className={`w-14 text-xs font-bold text-left flex-shrink-0 transition-colors ${
              unknown
                ? 'text-gray-300 cursor-not-allowed'
                : isGroupFullySelected(upperTeeth)
                  ? 'text-rose-600'
                  : 'text-gray-700 hover:text-rose-600'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            상악
          </button>
          <div className="flex gap-0.5">
            {teethData.upperPermanent.right.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
          <div className="w-px h-6 bg-gray-400"></div>
          <div className="flex gap-0.5">
            {teethData.upperPermanent.left.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
        </div>

        {/* 상악 유치 */}
        {showPrimary && (
          <div className="flex items-center gap-2">
            <div className="w-14 text-xs text-gray-500 text-left flex-shrink-0">유치</div>
            <div className="flex gap-0.5 justify-end" style={{ width: '168px' }}>
              {teethData.upperPrimary.right.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
            <div className="w-px h-5 bg-gray-300"></div>
            <div className="flex gap-0.5">
              {teethData.upperPrimary.left.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
          </div>
        )}

        {/* 구분선 + 전체선택 */}
        <div className="flex items-center gap-2 py-1">
          <button
            type="button"
            onClick={() => toggleTeethGroup(allPermanentTeeth)}
            disabled={disabled || unknown}
            className={`w-14 text-xs font-bold text-left flex-shrink-0 transition-colors ${
              unknown
                ? 'text-gray-300 cursor-not-allowed'
                : isGroupFullySelected(allPermanentTeeth)
                  ? 'text-blue-600'
                  : 'text-gray-700 hover:text-blue-600'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            {isGroupFullySelected(allPermanentTeeth) ? '전체해제' : '전체선택'}
          </button>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* 하악 유치 */}
        {showPrimary && (
          <div className="flex items-center gap-2">
            <div className="w-14 text-xs text-gray-500 text-left flex-shrink-0">유치</div>
            <div className="flex gap-0.5 justify-end" style={{ width: '168px' }}>
              {teethData.lowerPrimary.right.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
            <div className="w-px h-5 bg-gray-300"></div>
            <div className="flex gap-0.5">
              {teethData.lowerPrimary.left.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
          </div>
        )}

        {/* 하악 영구치 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleTeethGroup(lowerTeeth)}
            disabled={disabled || unknown}
            className={`w-14 text-xs font-bold text-left flex-shrink-0 transition-colors ${
              unknown
                ? 'text-gray-300 cursor-not-allowed'
                : isGroupFullySelected(lowerTeeth)
                  ? 'text-rose-600'
                  : 'text-gray-700 hover:text-rose-600'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
          >
            하악
          </button>
          <div className="flex gap-0.5">
            {teethData.lowerPermanent.right.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
          <div className="w-px h-6 bg-gray-400"></div>
          <div className="flex gap-0.5">
            {teethData.lowerPermanent.left.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
        </div>
      </div>

      {/* 미확인 옵션 */}
      {onUnknownChange && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            type="button"
            onClick={toggleUnknown}
            disabled={disabled}
            className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
              unknown
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-dashed border-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {unknown ? '✓ 미확인 (치아 번호 확인 안됨)' : '❓ 치아 번호 미확인'}
          </button>
        </div>
      )}

      {/* 선택된 치아 표시 */}
      <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 rounded-b-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-600 font-medium">선택된 치아</span>
            <div className="mt-1">
              {unknown ? (
                <span className="px-3 py-1 bg-amber-500 text-white text-xs rounded-full font-medium">
                  미확인
                </span>
              ) : selectedTeeth.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {[...selectedTeeth].sort((a, b) => a - b).map(num => (
                    <span
                      key={num}
                      className="px-1.5 py-0.5 bg-rose-600 text-white text-xs rounded font-medium"
                    >
                      #{num}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 text-xs">치아를 선택해주세요</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            {unknown ? (
              <span className="text-lg font-bold text-amber-500">-</span>
            ) : (
              <>
                <span className="text-xl font-bold text-blue-600">{selectedTeeth.length}</span>
                <span className="text-xs text-blue-500 ml-1">개</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 치아 번호 배열을 포맷팅된 문자열로 변환하는 유틸리티 함수
export function formatSelectedTeeth(teeth: number[], treatmentType?: string): string {
  if (!teeth || teeth.length === 0) return ''

  const sorted = [...teeth].sort((a, b) => a - b)
  const teethStr = sorted.map(t => `#${t}`).join(', ')
  const countStr = `(${teeth.length}본)`

  if (treatmentType) {
    return `${treatmentType} ${teethStr} ${countStr}`
  }

  return `${teethStr} ${countStr}`
}

// 치아 번호 문자열을 배열로 파싱하는 유틸리티 함수 (기존 데이터 호환용)
export function parseTeethFromString(str: string): number[] {
  if (!str) return []

  // "#36, #37" 형태에서 숫자만 추출
  const matches = str.match(/#(\d+)/g)
  if (!matches) return []

  return matches.map(m => parseInt(m.replace('#', ''), 10)).filter(n => !isNaN(n))
}
