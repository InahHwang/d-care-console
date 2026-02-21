'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';

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

  // 템플릿 목록 조회
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success || Array.isArray(data)) {
        setTemplates(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error('템플릿 조회 실패:', error);
    }
  };

  // 템플릿 선택 시 내용 채우기
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // [환자명] 치환
      const personalizedContent = template.content.replace(/\[환자명\]/g, patientName);
      setContent(personalizedContent);
    }
  };

  // 문자 발송
  const handleSend = async () => {
    if (!content.trim()) {
      alert('메시지 내용을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      // 1. 문자 발송
      const sendRes = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          phoneNumber: patientPhone,
          content,
          messageType: 'LMS', // 자동 결정됨
        }),
      });

      const sendData = await sendRes.json();

      // 2. 발송 로그 저장
      await fetch('/api/messages/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          phoneNumber: patientPhone,
          content,
          messageType: sendData.actualType || 'SMS',
          status: sendData.success ? 'success' : 'failed',
          errorMessage: sendData.success ? '' : sendData.message,
          templateName: templates.find(t => t.id === selectedTemplateId)?.title || templates.find(t => t.id === selectedTemplateId)?.name || '',
        }),
      });

      if (sendData.success) {
        alert('문자가 발송되었습니다.');
        setContent('');
        setSelectedTemplateId('');
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
  const messageType = byteLength <= 90 ? 'SMS' : 'LMS';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">문자 발송</h2>
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
                템플릿 선택 <span className="text-gray-400 text-xs">(선택)</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">직접 입력</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title || template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 메시지 내용 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">메시지 내용</label>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded ${
                  messageType === 'SMS' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
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
              placeholder="메시지 내용을 입력하세요..."
              className="w-full h-48 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* 안내 문구 */}
          <div className="text-xs text-gray-400 space-y-1">
            <p>• SMS: 90바이트 이하 (한글 약 30자)</p>
            <p>• LMS: 90바이트 초과 ~ 2000바이트 (한글 약 670자)</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
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
