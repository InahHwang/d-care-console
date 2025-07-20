// src/app/settings/page.tsx

'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import GoalSettings from '@/components/settings/GoalSettings'
import { 
  HiOutlineUserCircle, 
  HiOutlineOfficeBuilding, 
  HiOutlineTag
} from 'react-icons/hi'
import { Icon } from '@/components/common/Icon'

// 🔥 메시지 템플릿 관련 import 제거
// import TemplateSettings from '@/components/settings/TemplateSettings'
// import { HiOutlineTemplate } from 'react-icons/hi'

type SettingsTab = 'account' | 'clinic' | 'goals' // 🔥 'templates' 제거

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('goals')
  
  return (
    <AppLayout currentPage="settings">
      <div className="card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-6">설정</h2>
        
        {/* 탭 네비게이션 - 메시지 템플릿 탭 제거 */}
        <div className="flex border-b border-border mb-6 overflow-x-auto">
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'account' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('account')}
          >
            <Icon icon={HiOutlineUserCircle} size={16} />
            계정 설정
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'clinic' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('clinic')}
          >
            <Icon icon={HiOutlineOfficeBuilding} size={16} />
            병원 정보
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'goals' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('goals')}
          >
            <Icon icon={HiOutlineTag} size={16} />
            목표 설정
          </button>
          {/* 🔥 메시지 템플릿 탭 완전 제거 */}
        </div>
        
        {/* 탭 내용 - 메시지 템플릿 관련 제거 */}
        <div>
          {activeTab === 'account' && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary">계정 설정 준비 중</h3>
                <p className="mt-2 text-text-secondary">
                  이 기능은 개발 중입니다. 곧 이용 가능합니다.
                </p>
              </div>
            </div>
          )}
          
          {activeTab === 'clinic' && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary">병원 정보 설정 준비 중</h3>
                <p className="mt-2 text-text-secondary">
                  이 기능은 개발 중입니다. 곧 이용 가능합니다.
                </p>
              </div>
            </div>
          )}
          
          {activeTab === 'goals' && <GoalSettings />}
          
          {/* 🔥 메시지 템플릿 탭 내용 완전 제거 */}
        </div>
      </div>
    </AppLayout>
  )
}