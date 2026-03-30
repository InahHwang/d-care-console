// src/components/v2/settings/ChannelChat-IntegrationSettings.tsx
'use client';

import React, { useState } from 'react';
import {
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Save,
  CheckCircle,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';

interface NaverSettings {
  enabled: boolean;
  authToken: string;
  isConfigured: boolean;
}

interface KakaoSettings {
  enabled: boolean;
  apiToken: string;
  isConfigured: boolean;
}

interface InstagramSettings {
  enabled: boolean;
  accessToken: string;
  pageId: string;
  webhookVerifyToken: string;
  isConfigured: boolean;
}

interface ChannelSettings {
  naver?: NaverSettings;
  kakao?: KakaoSettings;
  instagram?: InstagramSettings;
}

interface Props {
  settings: ChannelSettings;
  onSave: (data: ChannelSettings) => Promise<void>;
}

const DEFAULT_NAVER: NaverSettings = { enabled: false, authToken: '', isConfigured: false };
const DEFAULT_KAKAO: KakaoSettings = { enabled: false, apiToken: '', isConfigured: false };
const DEFAULT_INSTAGRAM: InstagramSettings = { enabled: false, accessToken: '', pageId: '', webhookVerifyToken: '', isConfigured: false };

export default function ChannelChatIntegrationSettings({ settings, onSave }: Props) {
  const [form, setForm] = useState<ChannelSettings>({
    naver: { ...DEFAULT_NAVER, ...settings.naver },
    kakao: { ...DEFAULT_KAKAO, ...settings.kakao },
    instagram: { ...DEFAULT_INSTAGRAM, ...settings.instagram },
  });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    naver: form.naver?.enabled || false,
    kakao: form.kakao?.enabled || false,
    instagram: form.instagram?.enabled || false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: ChannelSettings = {
        naver: {
          ...form.naver!,
          isConfigured: !!(form.naver?.enabled && form.naver.authToken),
        },
        kakao: {
          ...form.kakao!,
          isConfigured: !!(form.kakao?.enabled && form.kakao.apiToken),
        },
        instagram: {
          ...form.instagram!,
          isConfigured: !!(form.instagram?.enabled && form.instagram.accessToken && form.instagram.pageId),
        },
      };
      await onSave(data);
      setForm(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const configuredCount = [form.naver, form.kakao, form.instagram].filter(
    (ch) => ch?.isConfigured
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-purple-600" />
          <h3 className="font-medium text-gray-900">채널챗 연동</h3>
          {configuredCount > 0 && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {configuredCount}개 연동
            </span>
          )}
        </div>
      </div>

      {/* 네이버 톡톡 */}
      <ChannelSection
        title="네이버 톡톡"
        color="green"
        isOpen={openSections.naver}
        onToggle={() => toggleSection('naver')}
        enabled={form.naver?.enabled || false}
        isConfigured={form.naver?.isConfigured || false}
        onToggleEnabled={(enabled) => setForm({ ...form, naver: { ...form.naver!, enabled } })}
      >
        <GuideBox>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>네이버톡톡 파트너센터 (partner.talk.naver.com) 접속</li>
            <li>개발자도구 → 챗봇 API 설정</li>
            <li>&quot;이벤트 받을 URL&quot;에 아래 웹훅 URL 입력</li>
            <li>이벤트 선택: send, open, leave 체크</li>
            <li>&quot;보내기 API&quot; 섹션에서 Authorization 생성</li>
            <li>생성된 토큰을 아래에 입력</li>
          </ol>
        </GuideBox>
        <WebhookURLDisplay path="/api/v2/webhooks/naver" />
        <TokenInput
          label="Authorization 토큰"
          value={form.naver?.authToken || ''}
          onChange={(authToken) => setForm({ ...form, naver: { ...form.naver!, authToken } })}
          placeholder="네이버톡톡 보내기 API Authorization"
        />
      </ChannelSection>

      {/* 카카오 비즈니스 */}
      <ChannelSection
        title="카카오 비즈니스"
        color="yellow"
        isOpen={openSections.kakao}
        onToggle={() => toggleSection('kakao')}
        enabled={form.kakao?.enabled || false}
        isConfigured={form.kakao?.isConfigured || false}
        onToggleEnabled={(enabled) => setForm({ ...form, kakao: { ...form.kakao!, enabled } })}
      >
        <GuideBox>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>카카오 비즈니스 (business.kakao.com) → 카카오톡 채널 생성</li>
            <li>카카오 디벨로퍼스 (developers.kakao.com) → 앱 생성</li>
            <li>앱 설정 → 카카오톡 채널 연결</li>
            <li>챗봇 관리자센터에서 스킬 서버 URL에 아래 웹훅 URL 설정</li>
            <li>(선택) 상담톡 계약 시 API 토큰 입력</li>
          </ol>
          <p className="mt-2 text-xs text-gray-500">
            ※ 챗봇 스킬 서버 방식으로 동작합니다. 실시간 발송이 필요하면 상담톡 API 계약이 필요합니다.
          </p>
        </GuideBox>
        <WebhookURLDisplay path="/api/v2/webhooks/kakao" />
        <TokenInput
          label="상담톡 API 토큰 (선택)"
          value={form.kakao?.apiToken || ''}
          onChange={(apiToken) => setForm({ ...form, kakao: { ...form.kakao!, apiToken } })}
          placeholder="상담톡 계약 시 발급받은 API 토큰"
        />
      </ChannelSection>

      {/* 인스타그램 */}
      <ChannelSection
        title="인스타그램 DM"
        color="pink"
        isOpen={openSections.instagram}
        onToggle={() => toggleSection('instagram')}
        enabled={form.instagram?.enabled || false}
        isConfigured={form.instagram?.isConfigured || false}
        onToggleEnabled={(enabled) => setForm({ ...form, instagram: { ...form.instagram!, enabled } })}
      >
        <GuideBox>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            <li>Meta 개발자 포털 (developers.facebook.com) → 앱 생성</li>
            <li>Instagram Graph API 추가</li>
            <li>Instagram 비즈니스 계정과 Facebook 페이지 연결</li>
            <li>웹훅 설정: 아래 URL, Verify Token 입력</li>
            <li>구독 필드: messages, messaging_postbacks 선택</li>
            <li>앱 검수 제출 (messages 권한)</li>
          </ol>
          <p className="mt-2 text-xs text-gray-500">
            ※ 인스타그램 DM은 24시간 응답 제한이 있습니다. 고객 메시지 수신 후 24시간 이내에만 응답 가능합니다.
          </p>
        </GuideBox>
        <WebhookURLDisplay path="/api/v2/webhooks/instagram" />
        <TokenInput
          label="Page Access Token *"
          value={form.instagram?.accessToken || ''}
          onChange={(accessToken) => setForm({ ...form, instagram: { ...form.instagram!, accessToken } })}
          placeholder="장기 토큰 권장"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Instagram Business Account ID *</label>
            <input
              type="text"
              value={form.instagram?.pageId || ''}
              onChange={(e) => setForm({ ...form, instagram: { ...form.instagram!, pageId: e.target.value } })}
              placeholder="숫자 ID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Webhook Verify Token *</label>
            <input
              type="text"
              value={form.instagram?.webhookVerifyToken || ''}
              onChange={(e) => setForm({ ...form, instagram: { ...form.instagram!, webhookVerifyToken: e.target.value } })}
              placeholder="웹훅 검증용 임의 문자열"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
        </div>
      </ChannelSection>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" />
              저장 완료
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '채널 설정 저장'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// --- 하위 컴포넌트 ---

function ChannelSection({
  title,
  color,
  isOpen,
  onToggle,
  enabled,
  isConfigured,
  onToggleEnabled,
  children,
}: {
  title: string;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  enabled: boolean;
  isConfigured: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
    pink: 'border-pink-200 bg-pink-50',
  };
  const headerColor = colorMap[color] || colorMap.green;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 ${headerColor} hover:opacity-90 transition-colors text-left`}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {isConfigured && (
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">연동됨</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-xs text-gray-600">활성화</span>
          </label>
          {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 py-4 space-y-3 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

function GuideBox({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">설정 가이드</span>
        </div>
        {show ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {show && <div className="px-3 py-2 bg-white">{children}</div>}
    </div>
  );
}

function WebhookURLDisplay({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const fullUrl = `${baseUrl}${path}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 복사 실패 무시
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">웹훅 URL</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono truncate">
          {fullUrl}
        </code>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </div>
  );
}

function TokenInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
