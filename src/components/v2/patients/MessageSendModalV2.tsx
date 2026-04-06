'use client';

import { authFetch } from '@/utils/authFetch';
import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, MessageSquare, ImageIcon } from 'lucide-react';

interface MessageSendModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  patientPhone: string;
  onSuccess?: () => void;
}

interface Template {
  id: string;
  title: string;  // API에서 title 사용
  name?: string;  // 하위 호환
  content: string;
  category?: string;
  type?: 'SMS' | 'LMS' | 'MMS' | 'RCS';
  imageUrl?: string;
}

export function MessageSendModalV2({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientPhone,
  onSuccess,
}: MessageSendModalV2Props) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');

  // 템플릿 목록 조회
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const res = await authFetch('/api/v2/templates');
      const data = await res.json();
      if (data.success || Array.isArray(data)) {
        setTemplates(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error('템플릿 조회 실패:', error);
    }
  };

  // 템플릿 선택 시 내용 + 이미지 채우기
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // [환자명] ���환
      const personalizedContent = template.content.replace(/\[환���명\]/g, patientName);
      setContent(personalizedContent);
      setImageUrl(template.imageUrl || '');
    } else {
      setImageUrl('');
    }
  };

  // 문자 발송
  const handleSend = async () => {
    if (!content.trim()) {
      alert('메시지 내���을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      // 메시지 타입 결정: 이미지 있으면 MMS, 아니면 바이트 기반 SMS/LMS
      const sendMessageType = imageUrl ? 'MMS' : (byteLength <= 90 ? 'SMS' : 'LMS');

      // 1. 문자 발송
      const sendRes = await authFetch('/api/v2/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          phoneNumber: patientPhone,
          content,
          messageType: sendMessageType,
          imageUrl: imageUrl || undefined,
        }),
      });

      const sendData = await sendRes.json();

      // 2. 발송 로그 저장
      await authFetch('/api/v2/messages/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          phoneNumber: patientPhone,
          content,
          messageType: sendData.actualType || sendMessageType,
          status: sendData.success ? 'success' : 'failed',
          errorMessage: sendData.success ? '' : sendData.message,
          templateName: templates.find(t => t.id === selectedTemplateId)?.title || templates.find(t => t.id === selectedTemplateId)?.name || '',
          imageUrl: imageUrl || undefined,
        }),
      });

      if (sendData.success) {
        alert('문자가 발송되었습���다.');
        setContent('');
        setSelectedTemplateId('');
        setImageUrl('');
        onSuccess?.();
        onClose();
      } else {
        alert(`발송 실패: ${sendData.message}`);
      }
    } catch (error) {
      console.error('문자 발송 오류:', error);
      alert('문자 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  // 바이트 계산 (한글 3바이트)
  const getByteLength = (text: string) => {
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      bytes += text.charCodeAt(i) > 127 ? 3 : 1;
    }
    return bytes;
  };

  const byteLength = getByteLength(content);
  const messageType = imageUrl ? 'MMS' : (byteLength <= 90 ? 'SMS' : 'LMS');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">��자 발송</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 수신자 정보 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500">수신자:</span>
                <span className="ml-2 font-medium text-gray-900">{patientName}</span>
              </div>
              <span className="text-sm text-gray-500">{patientPhone}</span>
            </div>
          </div>

          {/* 템플릿 선택 */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                템플릿 선택 <span className="text-gray-400 text-xs">(���택)</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">직접 입력</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.type && template.type !== 'SMS' && template.type !== 'LMS' ? `[${template.type}] ` : ''}
                    {template.title || template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MMS 이미지 미리보기 */}
          {imageUrl && (
            <div className="relative">
              <div className="flex items-center gap-1 mb-1">
                <ImageIcon size={14} className="text-green-600" />
                <span className="text-xs text-green-600 font-medium">MMS 이미지</span>
              </div>
              <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={imageUrl}
                  alt="MMS 이미지"
                  className="w-full max-h-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <button
                onClick={() => setImageUrl('')}
                className="absolute top-6 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                title="이미지 제거"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* 메시지 내용 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">메시지 내용</label>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded ${
                  messageType === 'SMS' ? 'bg-orange-100 text-orange-700' :
                  messageType === 'MMS' ? 'bg-green-100 text-green-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {messageType}
                </span>
                <span className={byteLength > 2000 ? 'text-red-500' : 'text-gray-500'}>
                  {byteLength}/2000 bytes
                </span>
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="메시지 내���을 입력하세요..."
              className="w-full h-48 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
          </div>

          {/* 안내 문구 */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>• SMS: 90바이트 이하 (한글 약 30자)</p>
            <p>• LMS: 90바이트 초과 ~ 2000바이트 (한글 약 670자)</p>
            <p>• MMS: 이미지 포함 (JPG, 200KB 이하)</p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !content.trim() || byteLength > 2000}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                발송 중...
              </>
            ) : (
              <>
                <Send size={16} />
                발송
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageSendModalV2;
