'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, XCircle, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface MessageLog {
  _id?: string;
  id?: string;
  patientId: string;
  patientName: string;
  phoneNumber: string;
  content: string;
  messageType: 'SMS' | 'LMS' | 'MMS';
  status: 'success' | 'failed';
  errorMessage?: string;
  templateName?: string;
  createdAt: string;
}

interface MessageHistoryCardProps {
  patientId: string;
  patientPhone: string;
  className?: string;
}

export function MessageHistoryCard({ patientId, patientPhone, className = '' }: MessageHistoryCardProps) {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageLog | null>(null);

  // 문자 이력 조회
  useEffect(() => {
    if (patientId || patientPhone) {
      fetchMessages();
    }
  }, [patientId, patientPhone]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/messages/log');
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        // 해당 환자의 메시지만 필터링 (patientId 또는 phoneNumber로)
        const patientMessages = data.data.filter((log: MessageLog) =>
          log.patientId === patientId || log.phoneNumber === patientPhone
        );

        // 최신순 정렬
        patientMessages.sort((a: MessageLog, b: MessageLog) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setMessages(patientMessages);
      }
    } catch (error) {
      console.error('문자 이력 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'M/d HH:mm', { locale: ko });
    } catch {
      return '-';
    }
  };

  const displayMessages = isExpanded ? messages : messages.slice(0, 3);

  return (
    <div className={`bg-white rounded-xl border ${className}`}>
      {/* 헤더 */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-500" />
          <h3 className="font-bold text-gray-900">문자 발송 이력</h3>
          <span className="text-sm text-gray-500">({messages.length}건)</span>
        </div>
      </div>

      {/* 목록 */}
      <div className="divide-y">
        {isLoading ? (
          <div className="p-6 text-center text-gray-400">로딩 중...</div>
        ) : messages.length === 0 ? (
          <div className="p-6 text-center text-gray-400">발송된 문자가 없습니다</div>
        ) : (
          displayMessages.map((msg) => (
            <div
              key={msg._id || msg.id}
              className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => setSelectedMessage(selectedMessage?.id === msg.id ? null : msg)}
            >
              <div className="flex items-start gap-3">
                {/* 상태 아이콘 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.status === 'success' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {msg.status === 'success' ? (
                    <CheckCircle size={14} className="text-green-600" />
                  ) : (
                    <XCircle size={14} className="text-red-600" />
                  )}
                </div>

                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {/* 메시지 타입 */}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      msg.messageType === 'SMS' ? 'bg-blue-100 text-blue-700' :
                      msg.messageType === 'LMS' ? 'bg-purple-100 text-purple-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {msg.messageType}
                    </span>

                    {/* 상태 */}
                    <span className={`text-xs ${
                      msg.status === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {msg.status === 'success' ? '발송완료' : '발송실패'}
                    </span>

                    {/* 날짜 */}
                    <span className="text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(msg.createdAt)}
                    </span>

                    {/* 템플릿명 */}
                    {msg.templateName && (
                      <span className="text-xs text-gray-400">
                        [{msg.templateName}]
                      </span>
                    )}
                  </div>

                  {/* 미리보기 */}
                  <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                    {msg.content}
                  </p>

                  {/* 선택된 메시지 상세 */}
                  {selectedMessage?.id === msg.id && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      {msg.status === 'failed' && msg.errorMessage && (
                        <p className="mt-2 text-xs text-red-500">
                          오류: {msg.errorMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 더보기 */}
      {messages.length > 3 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 text-sm text-blue-600 hover:bg-gray-50 flex items-center justify-center gap-1 border-t"
        >
          <span>{isExpanded ? '접기' : `더보기 (${messages.length - 3}건)`}</span>
          <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

export default MessageHistoryCard;
