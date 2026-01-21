// src/app/v2/settings/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/v2/layout/PageHeader';
import PatientCategorySettings from '@/components/settings/PatientCategorySettings';
import {
  Settings,
  Phone,
  Sparkles,
  Bell,
  Target,
  Save,
  CheckCircle,
  Building,
  Tags,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import ManualSettings from '@/components/v2/settings/ManualSettings';
import RecallSettings from '@/components/v2/settings/RecallSettings';

interface SettingsData {
  clinicName: string;
  cti: {
    enabled: boolean;
    serverUrl: string;
    agentId: string;
  };
  ai: {
    enabled: boolean;
    autoAnalysis: boolean;
    model: string;
  };
  notifications: {
    missedCall: boolean;
    newPatient: boolean;
    callback: boolean;
  };
  targets: {
    monthlyRevenue: number;
    dailyCalls: number;
    conversionRate: number;
  };
}

type TabType = 'general' | 'categories' | 'manuals' | 'recall';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/v2/settings');
      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/v2/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (path: string, value: unknown) => {
    if (!settings) return;

    const keys = path.split('.');
    const newSettings = { ...settings };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = newSettings;

    for (let i = 0; i < keys.length - 1; i++) {
      obj[keys[i]] = { ...obj[keys[i]] };
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;

    setSettings(newSettings);
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="설정" subtitle="시스템 설정을 관리하세요" />
        <div className="mt-6 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <PageHeader title="설정" subtitle="시스템 설정을 관리하세요" />
        <div className="mt-6 text-center text-red-500">설정을 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="설정"
        subtitle="시스템 설정을 관리하세요"
        action={activeTab === 'general' ? {
          label: saving ? '저장 중...' : saved ? '저장됨' : '저장',
          icon: saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />,
          onClick: handleSave,
        } : undefined}
      />

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'general'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Settings className="w-4 h-4" />
          일반 설정
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'categories'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Tags className="w-4 h-4" />
          카테고리 관리
        </button>
        <button
          onClick={() => setActiveTab('manuals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'manuals'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          상담 매뉴얼
        </button>
        <button
          onClick={() => setActiveTab('recall')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'recall'
              ? 'bg-white border border-b-white border-gray-200 -mb-[3px] text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          리콜 발송 설정
        </button>
      </div>

      {/* 카테고리 관리 탭 */}
      {activeTab === 'categories' && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <PatientCategorySettings />
        </section>
      )}

      {/* 상담 매뉴얼 탭 */}
      {activeTab === 'manuals' && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <ManualSettings />
        </section>
      )}

      {/* 리콜 발송 설정 탭 */}
      {activeTab === 'recall' && (
        <section className="bg-white rounded-xl border border-gray-100 p-6">
          <RecallSettings />
        </section>
      )}

      {/* 일반 설정 탭 */}
      {activeTab === 'general' && (
        <>
        {/* 기본 정보 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
          <Building className="w-5 h-5" />
          기본 정보
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              병원 이름
            </label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => updateSettings('clinicName', e.target.value)}
              className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* CTI 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Phone className="w-5 h-5" />
            CTI 연동
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.cti.enabled}
              onChange={(e) => updateSettings('cti.enabled', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">활성화</span>
          </label>
        </div>

        {settings.cti.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CTI 서버 URL
              </label>
              <input
                type="text"
                value={settings.cti.serverUrl}
                onChange={(e) => updateSettings('cti.serverUrl', e.target.value)}
                placeholder="ws://localhost:5100"
                className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담사 ID
              </label>
              <input
                type="text"
                value={settings.cti.agentId}
                onChange={(e) => updateSettings('cti.agentId', e.target.value)}
                placeholder="agent001"
                className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}
      </section>

      {/* AI 분석 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Sparkles className="w-5 h-5" />
            AI 분석
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.ai.enabled}
              onChange={(e) => updateSettings('ai.enabled', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">활성화</span>
          </label>
        </div>

        {settings.ai.enabled && (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai.autoAnalysis}
                  onChange={(e) => updateSettings('ai.autoAnalysis', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">통화 종료 후 자동 분석</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI 모델
              </label>
              <select
                value={settings.ai.model}
                onChange={(e) => updateSettings('ai.model', e.target.value)}
                className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="gpt-4o-mini">GPT-4o Mini (빠름, 저렴)</option>
                <option value="gpt-4o">GPT-4o (정확함)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo (균형)</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* 알림 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
          <Bell className="w-5 h-5" />
          알림 설정
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.missedCall}
              onChange={(e) => updateSettings('notifications.missedCall', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">부재중 전화 알림</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.newPatient}
              onChange={(e) => updateSettings('notifications.newPatient', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">신규 환자 등록 알림</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.callback}
              onChange={(e) => updateSettings('notifications.callback', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">콜백 일정 알림</span>
          </label>
        </div>
      </section>

      {/* 목표 설정 */}
      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-2 text-gray-700 font-medium mb-4">
          <Target className="w-5 h-5" />
          목표 설정
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              월 매출 목표 (만원)
            </label>
            <input
              type="number"
              value={settings.targets.monthlyRevenue}
              onChange={(e) => updateSettings('targets.monthlyRevenue', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              일 통화 목표 (건)
            </label>
            <input
              type="number"
              value={settings.targets.dailyCalls}
              onChange={(e) => updateSettings('targets.dailyCalls', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              전환율 목표 (%)
            </label>
            <input
              type="number"
              value={settings.targets.conversionRate}
              onChange={(e) => updateSettings('targets.conversionRate', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              min={0}
              max={100}
            />
          </div>
        </div>
      </section>

      {/* 저장 버튼 (하단 고정) */}
      <div className="sticky bottom-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          } disabled:opacity-50`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-5 h-5" />
              저장 완료
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {saving ? '저장 중...' : '변경사항 저장'}
            </>
          )}
        </button>
      </div>
        </>
      )}
    </div>
  );
}
