// src/components/v2/settings/CTI-IntegrationSettings.tsx
'use client';

import React, { useState } from 'react';
import {
  Phone,
  ChevronDown,
  ChevronUp,
  Info,
  Save,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CTISettings {
  productType: 'ims' | 'centrix' | 'soho' | '';
  apiId: string;
  apiPassword: string;
  phoneNumber: string;
  isConfigured: boolean;
}

interface Props {
  settings: CTISettings;
  onSave: (data: CTISettings) => Promise<void>;
}

const PRODUCT_OPTIONS = [
  { value: 'ims', label: 'IMS 실선', addon: '오픈API통화기본' },
  { value: 'centrix', label: 'IP 센트릭스', addon: 'CS API_통화기본' },
  { value: 'soho', label: 'SOHO', addon: 'CS API_통화기본' },
] as const;

export default function CTIIntegrationSettings({ settings, onSave }: Props) {
  const [form, setForm] = useState<CTISettings>({
    productType: settings.productType || '',
    apiId: settings.apiId || '',
    apiPassword: settings.apiPassword || '',
    phoneNumber: settings.phoneNumber || '',
    isConfigured: settings.isConfigured || false,
  });
  const [showGuide, setShowGuide] = useState(!settings.isConfigured);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!form.productType || !form.apiId || !form.apiPassword || !form.phoneNumber) return;
    setSaving(true);
    try {
      const data = { ...form, isConfigured: true };
      await onSave(data);
      setForm(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = form.productType && form.apiId && form.apiPassword && form.phoneNumber;
  const selectedProduct = PRODUCT_OPTIONS.find((p) => p.value === form.productType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-orange-600" />
          <h3 className="font-medium text-gray-900">CTI 연동 (SK 브로드밴드)</h3>
          {form.isConfigured && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              설정 완료
            </span>
          )}
        </div>
      </div>

      {/* 인라인 가이드 (접이식) */}
      <div className="border border-orange-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">SK 브로드밴드 오픈API 가입 가이드</span>
          </div>
          {showGuide ? <ChevronUp className="w-4 h-4 text-orange-600" /> : <ChevronDown className="w-4 h-4 text-orange-600" />}
        </button>
        {showGuide && (
          <div className="px-4 py-3 bg-white space-y-3 text-sm text-gray-700">
            <div className="space-y-2">
              <p className="font-medium text-gray-900">1단계: 오픈API 서비스 가입</p>
              <p>
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-orange-700">1600-0108</span>
                로 전화하여 <strong>&quot;오픈API서비스 가입&quot;</strong>을 신청하세요.
              </p>
              <p className="text-gray-500">
                지원 상품: IMS실선, 센트릭스, SOHO
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-gray-900">2단계: 부가서비스 가입</p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li><strong>IMS실선</strong> → 부가서비스: &quot;오픈API통화기본&quot;</li>
                <li><strong>센트릭스 / SOHO</strong> → 부가서비스: &quot;CS API_통화기본&quot;</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-gray-900">3단계: 계정 생성</p>
              <p>가입 처리 후 아래에서 상품을 선택하고, TTS/SMS 인증을 통해 로그인 ID와 비밀번호를 생성합니다.</p>
              <p className="text-gray-500">
                ※ 센트릭스를 사용하시면 일반적으로 &quot;IP 센트릭스&quot;를 선택하세요. 문제가 있으면 &quot;SOHO&quot;로 다시 시도해보세요.
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-gray-900">4단계: 아래 설정 입력</p>
              <p>생성된 계정 정보를 아래 폼에 입력하고 저장하면 CTIBridge가 자동으로 연결합니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* 설정 폼 */}
      <div className="space-y-4">
        {/* 상품 유형 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">SK 상품 유형 *</label>
          <div className="flex flex-wrap gap-3">
            {PRODUCT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg cursor-pointer transition-colors ${
                  form.productType === option.value
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="productType"
                  value={option.value}
                  checked={form.productType === option.value}
                  onChange={(e) => setForm({ ...form, productType: e.target.value as CTISettings['productType'] })}
                  className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium">{option.label}</span>
              </label>
            ))}
          </div>
          {selectedProduct && (
            <p className="mt-1.5 text-xs text-gray-500">
              부가서비스: <span className="font-medium">{selectedProduct.addon}</span>
            </p>
          )}
        </div>

        {/* API 계정 정보 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">로그인 ID *</label>
            <input
              type="text"
              value={form.apiId}
              onChange={(e) => setForm({ ...form, apiId: e.target.value })}
              placeholder="SK Open API 로그인 ID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.apiPassword}
                onChange={(e) => setForm({ ...form, apiPassword: e.target.value })}
                placeholder="SK Open API 비밀번호"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* 대표 전화번호 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">대표 전화번호 *</label>
          <input
            type="text"
            value={form.phoneNumber}
            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
            placeholder="예: 031-567-2278"
            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <p className="mt-1 text-xs text-gray-500">오픈API에 등록한 전화번호를 입력하세요.</p>
        </div>

        {/* 안내 */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          설정 저장 후 CTIBridge 서비스가 자동으로 SK 서버에 연결합니다.
          CTIBridge가 설치되지 않은 경우 관리자에게 문의하세요.
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !isFormValid}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-orange-600 text-white hover:bg-orange-700'
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
                {saving ? '저장 중...' : 'CTI 설정 저장'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
