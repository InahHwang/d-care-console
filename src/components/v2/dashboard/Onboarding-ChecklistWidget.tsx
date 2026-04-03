// src/components/v2/dashboard/Onboarding-ChecklistWidget.tsx
'use client';

import { authFetch } from '@/utils/authFetch';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  Circle,
  Phone,
  MessageSquare,
  MessageCircle,
  Building,
  Users,
  ChevronRight,
  X,
} from 'lucide-react';

interface OnboardingItem {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  tab?: string; // settings 탭 이동용
}

interface SettingsData {
  clinicName?: string;
  cti?: { isConfigured?: boolean };
  sms?: { isConfigured?: boolean; approvalStatus?: string };
  channels?: {
    naver?: { isConfigured?: boolean };
    kakao?: { isConfigured?: boolean };
    instagram?: { isConfigured?: boolean };
  };
}

export default function OnboardingChecklistWidget() {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await authFetch('/api/v2/settings');
        const result = await response.json();
        if (result.success) {
          setSettings(result.data);
        }
      } catch {
        // 설정 조회 실패 시 위젯 숨김
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // 사용자 수 확인
  const [hasUsers, setHasUsers] = useState(false);
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await authFetch('/api/v2/users', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        // 2명 이상이면 상담사 등록 완료 (본인 + 1명)
        if (data.success && (data.users?.length || 0) >= 2) {
          setHasUsers(true);
        }
      } catch {
        // 무시
      }
    };
    fetchUsers();
  }, []);

  if (loading || !settings || dismissed) return null;

  const items: OnboardingItem[] = [
    {
      key: 'clinic',
      label: '기본 정보',
      description: '병원명 설정',
      icon: <Building className="w-4 h-4" />,
      completed: !!(settings.clinicName && settings.clinicName !== '내 병원'),
      tab: 'general',
    },
    {
      key: 'users',
      label: '상담사 등록',
      description: '상담사 초대/등록',
      icon: <Users className="w-4 h-4" />,
      completed: hasUsers,
      tab: 'invitations',
    },
    {
      key: 'cti',
      label: 'CTI 연동',
      description: 'SK 브로드밴드 전화 연동',
      icon: <Phone className="w-4 h-4" />,
      completed: !!settings.cti?.isConfigured,
      tab: 'integrations',
    },
    {
      key: 'sms',
      label: 'SMS 연동',
      description: '문자 발송 설정',
      icon: <MessageSquare className="w-4 h-4" />,
      completed: !!settings.sms?.isConfigured,
      tab: 'integrations',
    },
    {
      key: 'channels',
      label: '채널챗 연동',
      description: '네이버/카카오/인스타',
      icon: <MessageCircle className="w-4 h-4" />,
      completed: !!(
        settings.channels?.naver?.isConfigured ||
        settings.channels?.kakao?.isConfigured ||
        settings.channels?.instagram?.isConfigured
      ),
      tab: 'integrations',
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // 전부 완료 시 위젯 숨김
  if (completedCount === totalCount) return null;

  const handleItemClick = (item: OnboardingItem) => {
    if (item.tab) {
      router.push(`/v2/settings?tab=${item.tab}`);
    }
  };

  return (
    <div className="bg-gradient-to-r from-orange-50 to-indigo-50 border border-orange-200 rounded-xl p-5 relative">
      {/* 닫기 버튼 */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white/50 transition-colors"
        title="나중에 하기"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 헤더 */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">시스템 설정을 완료하세요</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          모든 설정을 완료하면 이 안내가 사라집니다
        </p>
      </div>

      {/* 프로그레스 바 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-600">
            {completedCount}/{totalCount} 완료
          </span>
          <span className="text-xs font-bold text-orange-600">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 체크리스트 항목 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => handleItemClick(item)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
              item.completed
                ? 'bg-white/60 text-gray-400'
                : 'bg-white hover:bg-white/90 hover:shadow-sm text-gray-700 cursor-pointer'
            }`}
          >
            {item.completed ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${item.completed ? 'line-through' : ''}`}>
                {item.label}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{item.description}</p>
            </div>
            {!item.completed && (
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
