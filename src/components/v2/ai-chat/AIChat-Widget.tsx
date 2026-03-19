// src/components/v2/ai-chat/AIChat-Widget.tsx
// 플로팅 AI 채팅 위젯 — 레이아웃에 1줄로 추가

'use client';

import React, { useState, lazy, Suspense } from 'react';
import { Sparkles } from 'lucide-react';

const AIChatWindow = lazy(() => import('./AIChat-Window'));

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-[60] ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 rotate-45 scale-90'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 scale-100 hover:scale-110'
        }`}
        title="AI 어시스턴트"
      >
        <Sparkles className="w-5 h-5 text-white" />
      </button>

      {/* 채팅 윈도우 */}
      {isOpen && (
        <Suspense fallback={null}>
          <AIChatWindow onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
