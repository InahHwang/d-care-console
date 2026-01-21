// src/app/widget-demo/page.tsx
// 채팅 위젯 데모 페이지 (테스트용)

'use client';

import React from 'react';
import { ChatWidget } from '@/components/widget/ChatWidget';

export default function WidgetDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 가상의 치과 홈페이지 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
              D
            </div>
            <span className="text-xl font-bold text-gray-800">디케어 치과</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-gray-600">
            <a href="#" className="hover:text-blue-500">진료안내</a>
            <a href="#" className="hover:text-blue-500">의료진</a>
            <a href="#" className="hover:text-blue-500">오시는 길</a>
            <a href="#" className="hover:text-blue-500">상담예약</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* 히어로 섹션 */}
        <section className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            건강한 미소를 위한<br />
            <span className="text-blue-500">프리미엄 치과 서비스</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            최신 장비와 전문 의료진이 여러분의 구강 건강을 책임집니다.
            임플란트, 교정, 미백 등 다양한 진료를 제공합니다.
          </p>
          <div className="flex justify-center gap-4">
            <button className="px-8 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors">
              온라인 예약
            </button>
            <button className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              진료 안내
            </button>
          </div>
        </section>

        {/* 서비스 카드 */}
        <section className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { title: '임플란트', desc: '자연치아와 같은 편안함', icon: '🦷' },
            { title: '치아교정', desc: '아름다운 미소 라인', icon: '😁' },
            { title: '심미치료', desc: '밝고 환한 미소', icon: '✨' },
          ].map((service) => (
            <div key={service.title} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
              <p className="text-gray-600">{service.desc}</p>
            </div>
          ))}
        </section>

        {/* 안내 문구 */}
        <section className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            💬 실시간 상담 서비스
          </h2>
          <p className="text-gray-600 mb-4">
            오른쪽 하단의 채팅 버튼을 클릭하여 실시간으로 상담받으세요!
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            상담사 대기중
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-gray-400 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-center text-sm">
            © 2024 디케어 치과. 이 페이지는 채팅 위젯 테스트용 데모 페이지입니다.
          </p>
        </div>
      </footer>

      {/* 채팅 위젯 */}
      <ChatWidget
        clinicName="디케어 치과"
        primaryColor="#3B82F6"
        welcomeMessage="안녕하세요! 디케어 치과입니다. 무엇을 도와드릴까요? 😊"
        position="bottom-right"
      />
    </div>
  );
}
