// src/components/v2/settings/SMS-IntegrationSettings.tsx
'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Info,
} from 'lucide-react';

interface SMSSettings {
  senderNumber: string;
  senderName: string;
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  approvalNote?: string;
  isConfigured: boolean;
}

interface Props {
  settings: SMSSettings;
  onSave: (data: SMSSettings) => Promise<void>;
}

const APPROVAL_STATUS_CONFIG = {
  none: { label: '미등록', icon: AlertCircle, bgColor: 'bg-gray-100 text-gray-600' },
  pending: { label: '승인 대기', icon: Clock, bgColor: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '승인 완료', icon: CheckCircle, bgColor: 'bg-green-100 text-green-700' },
  rejected: { label: '승인 거부', icon: XCircle, bgColor: 'bg-red-100 text-red-700' },
} as const;

export default function SMSIntegrationSettings({ settings, onSave }: Props) {
  const [form, setForm] = useState<SMSSettings>({
    senderNumber: settings.senderNumber || '',
    senderName: settings.senderName || '',
    approvalStatus: settings.approvalStatus || 'none',
    approvalNote: settings.approvalNote || '',
    isConfigured: settings.isConfigured || false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!form.senderNumber || !form.senderName) return;
    setSaving(true);
    try {
      const data: SMSSettings = {
        ...form,
        senderNumber: form.senderNumber.replace(/[^0-9]/g, ''),
        // 첫 등록 시 자동으로 pending 상태
        approvalStatus: form.approvalStatus === 'none' ? 'pending' : form.approvalStatus,
        isConfigured: form.approvalStatus === 'approved',
      };
      await onSave(data);
      setForm(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const statusConfig = APPROVAL_STATUS_CONFIG[form.approvalStatus];
  const StatusIcon = statusConfig.icon;
  const isFormValid = form.senderNumber.replace(/[^0-9]/g, '').length >= 9 && form.senderName.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h3 className="font-medium text-gray-900">SMS 연동</h3>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* 안내 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-sm text-blue-800">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">SMS 발송을 위해 발신번호 등록이 필요합니다</p>
            <p className="text-blue-600 mt-1">
              통신서비스이용증명원을 준비하여 아래 이메일로 보내주세요.
              승인이 완료되면 SMS 발송 기능이 활성화됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 설정 폼 */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발신번호 *</label>
            <input
              type="text"
              value={form.senderNumber}
              onChange={(e) => setForm({ ...form, senderNumber: e.target.value })}
              placeholder="예: 031-567-2278"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <p className="mt-1 text-xs text-gray-500">SMS 발송 시 수신자에게 표시되는 번호</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">발신자명 *</label>
            <input
              type="text"
              value={form.senderName}
              onChange={(e) => setForm({ ...form, senderName: e.target.value })}
              placeholder="예: OO치과"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <p className="mt-1 text-xs text-gray-500">SMS 발송 시 사용할 병원명</p>
          </div>
        </div>

        {/* 통신서비스이용증명원 안내 */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <p className="text-sm font-medium text-gray-800">통신서비스이용증명원 제출 방법</p>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
            <li>통신사(KT, SK, LGU+)에 &quot;통신서비스이용증명원&quot; 발급을 요청하세요</li>
            <li>발급받은 서류를 아래 이메일로 보내주세요</li>
            <li>확인 후 1~2 영업일 내 승인 처리됩니다</li>
          </ol>
          <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-sm">
            <span className="text-gray-500">제출 이메일: </span>
            <span className="font-medium text-blue-600">support@dcare.com</span>
          </div>
        </div>

        {/* 승인 거부 사유 (거부 시만) */}
        {form.approvalStatus === 'rejected' && form.approvalNote && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <p className="font-medium">승인 거부 사유</p>
            <p className="mt-1">{form.approvalNote}</p>
          </div>
        )}

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !isFormValid}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-green-600 text-white hover:bg-green-700'
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
                {saving ? '저장 중...' : form.approvalStatus === 'none' ? '등록 요청' : 'SMS 설정 저장'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
