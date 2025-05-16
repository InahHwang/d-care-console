//src/app/settings/page.tsx

'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import TemplateSettings from '@/components/settings/TemplateSettings'
import { HiOutlineTemplate, HiOutlineUserCircle, HiOutlineOfficeBuilding } from 'react-icons/hi'
import { Icon } from '@/components/common/Icon'

type SettingsTab = 'account' | 'clinic' | 'templates'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('templates')
  
  return (
    <AppLayout currentPage="settings">
      <div className="card p-6">
        <h2 className="text-xl font-bold text-text-primary mb-6">설정</h2>
        
        {/* 탭 네비게이션 */}
        <div className="flex border-b border-border mb-6">
          <button
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-1.5 ${
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
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-1.5 ${
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
            className={`px-4 py-2 font-medium text-sm border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'templates' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            <Icon icon={HiOutlineTemplate} size={16} />
            메시지 템플릿
          </button>
        </div>
        
        {/* 탭 내용 */}
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
          
          {activeTab === 'templates' && <TemplateSettings />}
        </div>
      </div>
    </AppLayout>
  )
}