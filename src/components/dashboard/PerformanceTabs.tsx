// src/components/dashboard/PerformanceTabs.tsx
'use client'

import { useState } from 'react'
import { Icon } from '../common/Icon'
import { 
  HiOutlineCalendar, 
  HiOutlineChartBar,
  HiOutlineTrendingUp 
} from 'react-icons/hi'
import PerformanceCards from './PerformanceCards'
import CumulativeStats from './CumulativeStats'
import TrendAnalysis from './TrendAnalysis'

export type TabType = 'monthly' | 'cumulative' | 'trends'

interface PerformanceTabsProps {
  performance: any // 기존 performance 데이터
}

export default function PerformanceTabs({ performance }: PerformanceTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('monthly')

  // 🔍 강제 디버깅 로그
  console.log('🚨 PerformanceTabs 컴포넌트가 렌더링되었습니다!')
  console.log('🔍 현재 활성 탭:', activeTab)
  console.log('🔍 performance 데이터:', performance)

  const tabs = [
    {
      id: 'monthly' as TabType,
      label: '이번달',
      icon: HiOutlineCalendar,
      description: '이번달 실적 현황'
    },
    {
      id: 'cumulative' as TabType,
      label: '전체 누적',
      icon: HiOutlineChartBar,
      description: '전체 누적 실적'
    },
    {
      id: 'trends' as TabType,
      label: '트렌드 분석',
      icon: HiOutlineTrendingUp,
      description: '퍼널 & 월별 트렌드'
    }
  ]

  const renderTabContent = () => {
    console.log('🔍 탭 컨텐츠 렌더링:', activeTab)
    
    switch (activeTab) {
      case 'monthly':
        console.log('🔍 이번달 탭 렌더링')
        return <PerformanceCards performance={performance} />
      case 'cumulative':
        console.log('🔍 전체 누적 탭 렌더링')
        return <CumulativeStats />
      case 'trends':
        console.log('🔍 트렌드 분석 탭 렌더링')
        return <TrendAnalysis />
      default:
        return <PerformanceCards performance={performance} />
    }
  }

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                console.log('🔍 탭 클릭:', tab.id)
                setActiveTab(tab.id)
              }}
              className={`group inline-flex items-center px-1 py-4 border-b-2 font-medium text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'
              }`}
            >
              <Icon 
                icon={tab.icon} 
                size={18} 
                className={`mr-2 transition-colors duration-200 ${
                  activeTab === tab.id ? 'text-primary' : 'text-text-secondary group-hover:text-text-primary'
                }`}
              />
              <div className="text-left">
                <div className="font-medium">{tab.label}</div>
                <div className={`text-xs transition-colors duration-200 ${
                  activeTab === tab.id ? 'text-primary/70' : 'text-text-muted group-hover:text-text-secondary'
                }`}>
                  {tab.description}
                </div>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="animate-in fade-in-50 duration-200">
        {renderTabContent()}
      </div>
    </div>
  )
}