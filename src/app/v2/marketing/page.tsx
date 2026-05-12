// src/app/v2/marketing/page.tsx
// 마케팅 메뉴 — 광고비 대비 매출(ROAS) 분석

'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { TrendingUp, DollarSign, BarChart3, FileText } from 'lucide-react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import {
  MarketingOverviewTab,
  MarketingCostsTab,
  MarketingChannelsTab,
  MarketingReportsTab,
} from '@/components/v2/marketing-analytics';

type TabKey = 'overview' | 'costs' | 'channels' | 'reports';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '개요', icon: <TrendingUp size={16} /> },
  { key: 'costs', label: '광고비 관리', icon: <DollarSign size={16} /> },
  { key: 'channels', label: '채널 분석', icon: <BarChart3 size={16} /> },
  { key: 'reports', label: '월별 리포트', icon: <FileText size={16} /> },
];

export default function MarketingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 광고비/리포트 탭은 년 단위, 개요/채널은 월 단위
  const needsMonth = activeTab === 'overview' || activeTab === 'channels';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="마케팅"
        subtitle="광고비 대비 매출(ROAS)과 채널별 성과를 추적합니다."
      />

      {/* 기간 선택 */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        {needsMonth && (
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        )}
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 내용 */}
      <div>
        {activeTab === 'overview' && <MarketingOverviewTab year={year} month={month} />}
        {activeTab === 'costs' && <MarketingCostsTab year={year} />}
        {activeTab === 'channels' && <MarketingChannelsTab year={year} month={month} />}
        {activeTab === 'reports' && <MarketingReportsTab year={year} />}
      </div>
    </div>
  );
}
