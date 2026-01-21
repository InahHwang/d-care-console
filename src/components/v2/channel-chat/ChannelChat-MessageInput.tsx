'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';

interface ChannelChatMessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  insertText?: string;  // 외부에서 삽입할 텍스트
  onInsertComplete?: () => void;  // 삽입 완료 콜백
}

export function ChannelChatMessageInput({
  onSend,
  disabled = false,
  placeholder = '메시지를 입력하세요...',
  insertText,
  onInsertComplete,
}: ChannelChatMessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 외부에서 텍스트 삽입 시 처리
  useEffect(() => {
    if (insertText) {
      setMessage(prev => prev ? `${prev}\n${insertText}` : insertText);
      onInsertComplete?.();
      // 입력창에 포커스
      textareaRef.current?.focus();
      // textarea 높이 자동 조절
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
      }, 0);
    }
  }, [insertText, onInsertComplete]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage('');

    // textarea 높이 리셋
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter로 전송 (Shift+Enter는 줄바꿈)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="p-4 border-t bg-white">
      <div className="flex items-end gap-2">
        {/* 첨부 버튼 */}
        <button
          type="button"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="파일 첨부"
        >
          <Paperclip size={20} />
        </button>

        {/* 입력창 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2.5 pr-10 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ maxHeight: '120px' }}
          />
          <button
            type="button"
            className="absolute right-3 bottom-2.5 text-gray-400 hover:text-gray-600"
            title="이모지"
          >
            <Smile size={18} />
          </button>
        </div>

        {/* 전송 버튼 */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={20} />
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-2 text-center">
        Enter로 전송, Shift+Enter로 줄바꿈
      </p>
    </div>
  );
}

export default ChannelChatMessageInput;
