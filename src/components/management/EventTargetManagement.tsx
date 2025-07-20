// src/components/management/EventTargetManagement.tsx

'use client'

import { useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDispatch } from 'react-redux'
import { setCurrentMenuItem } from '@/store/slices/uiSlice'
import EventTargetList from './EventTargetList'
import MessageLogModal from './MessageLogModal'
import TemplateSettings from '../settings/TemplateSettings' // 🔥 TemplateSettings 사용 (템플릿+카테고리 관리 모두 포함)

export default function EventTargetManagement() {
  const dispatch = useDispatch()
  const searchParams = useSearchParams()
  
  const [activeTab, setActiveTab] = useState('이벤트 타겟')

  // 탭 변경 핸들러
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    dispatch(setCurrentMenuItem(tab))
  }, [dispatch])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">이벤트타겟관리</h1>
          <p className="text-sm text-gray-600 mt-1">이벤트 타겟 관리, 문자 발송 내역 및 메시지 템플릿을 관리할 수 있습니다</p>
        </div>
      </div>

      {/* 탭 메뉴 - 3번째 탭 추가 */}
      <div className="card p-0 mb-6">
        <div className="flex items-center overflow-x-auto">
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === '이벤트 타겟'
                ? 'text-primary bg-primary/10 rounded-t-lg'
                : 'text-text-secondary hover:bg-light-bg'
            }`}
            onClick={() => handleTabChange('이벤트 타겟')}
          >
            이벤트 타겟
            {activeTab === '이벤트 타겟' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === '문자발송 내역'
                ? 'text-primary bg-primary/10 rounded-t-lg'
                : 'text-text-secondary hover:bg-light-bg'
            }`}
            onClick={() => handleTabChange('문자발송 내역')}
          >
            문자발송 내역
            {activeTab === '문자발송 내역' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
          {/* 🆕 메시지 템플릿 탭 추가 */}
          <button
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === '메시지 템플릿'
                ? 'text-primary bg-primary/10 rounded-t-lg'
                : 'text-text-secondary hover:bg-light-bg'
            }`}
            onClick={() => handleTabChange('메시지 템플릿')}
          >
            메시지 템플릿
            {activeTab === '메시지 템플릿' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
            )}
          </button>
        </div>
      </div>

      {/* 콘텐츠 영역 - TemplateSettings 사용으로 템플릿+카테고리 관리 모두 포함 */}
      <div>
        {activeTab === '이벤트 타겟' && <EventTargetList />}
        {activeTab === '문자발송 내역' && <MessageLogModal isOpen={true} onClose={() => {}} embedded={true} />}
        {/* 🔥 TemplateSettings 사용 - 템플릿 관리와 카테고리 관리 둘 다 포함 */}
        {activeTab === '메시지 템플릿' && <TemplateSettings />}
      </div>
    </div>
  )
}