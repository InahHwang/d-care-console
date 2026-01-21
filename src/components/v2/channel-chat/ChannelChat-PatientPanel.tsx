'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Phone, Calendar, FileText, MessageSquare, User, ExternalLink, ThermometerSun, Sparkles, BookOpen } from 'lucide-react';
import { ChannelChatV2, PatientV2, ChatAIAnalysis, PATIENT_STATUS_CONFIG } from '@/types/v2';
import ManualSidePanel from '../manual/ManualSidePanel';

interface ChannelChatPatientPanelProps {
  chat: ChannelChatV2 | null;
  patient: PatientV2 | null;
  onMatchPatient: () => void;
  onRegisterPatient: () => void;
  onInputConsultation: () => void;
  onInsertManualText?: (text: string) => void;
}

type PanelTab = 'patient' | 'manual';

// 온도 표시 컴포넌트
function TemperatureBadge({ temperature }: { temperature: string }) {
  const config = {
    hot: { label: 'HOT', color: 'bg-red-100 text-red-700' },
    warm: { label: 'WARM', color: 'bg-amber-100 text-amber-700' },
    cold: { label: 'COLD', color: 'bg-blue-100 text-blue-700' },
  };
  const { label, color } = config[temperature as keyof typeof config] || config.cold;

  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>{label}</span>
  );
}

export function ChannelChatPatientPanel({
  chat,
  patient,
  onMatchPatient,
  onRegisterPatient,
  onInputConsultation,
  onInsertManualText,
}: ChannelChatPatientPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('patient');

  // 선택된 채팅이 없는 경우
  if (!chat) {
    return (
      <div className="w-80 bg-white border-l flex flex-col">
        {/* 탭 헤더 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('patient')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'patient'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User size={16} />
            환자 정보
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen size={16} />
            매뉴얼
          </button>
        </div>

        {activeTab === 'patient' ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-400 text-sm">
              대화방을 선택하면
              <br />
              환자 정보가 표시됩니다
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <ManualSidePanel
              isOpen={true}
              onClose={() => setActiveTab('patient')}
              onInsert={onInsertManualText}
              mode="chat"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l flex flex-col">
      {/* 탭 헤더 */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('patient')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'patient'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <User size={16} />
          환자 정보
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'manual'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={16} />
          매뉴얼
        </button>
      </div>

      {/* 매뉴얼 탭 */}
      {activeTab === 'manual' && (
        <div className="flex-1">
          <ManualSidePanel
            isOpen={true}
            onClose={() => setActiveTab('patient')}
            onInsert={onInsertManualText}
            mode="chat"
          />
        </div>
      )}

      {/* 환자 정보 탭 */}
      {activeTab === 'patient' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {patient ? (
            <>
              {/* 환자 기본 정보 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{patient.name}</div>
                    <div className="text-xs text-gray-500">{patient.phone}</div>
                  </div>
                </div>
                <TemperatureBadge temperature={patient.temperature} />
              </div>

              {/* 상태 */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-1 rounded-full ${PATIENT_STATUS_CONFIG[patient.status].bgColor}`}>
                  {PATIENT_STATUS_CONFIG[patient.status].label}
                </span>
                {patient.interest && (
                  <span className="text-xs text-gray-600">
                    관심: {patient.interest}
                  </span>
                )}
              </div>

              {/* 환자 상세 페이지 링크 */}
              <Link
                href={`/v2/patients/${patient._id}`}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                <span>환자 상세 보기</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {/* 빠른 액션 */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">빠른 액션</h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm rounded-lg hover:bg-green-100 transition-colors">
                  <Phone size={14} />
                  전화
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 text-sm rounded-lg hover:bg-purple-100 transition-colors">
                  <Calendar size={14} />
                  예약
                </button>
                <button className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-sm rounded-lg hover:bg-amber-100 transition-colors">
                  <FileText size={14} />
                  메모
                </button>
                <button
                  onClick={onInputConsultation}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <MessageSquare size={14} />
                  상담결과
                </button>
              </div>
            </div>

            {/* AI 분석 결과 */}
            {chat.aiAnalysis && (
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-purple-600" />
                  <h3 className="text-sm font-medium text-purple-700">AI 분석</h3>
                </div>
                <p className="text-sm text-gray-700">{chat.aiAnalysis.summary}</p>
                {chat.aiAnalysis.concerns.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {chat.aiAnalysis.concerns.map((concern, i) => (
                      <span key={i} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        {concern}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* 환자 미연결 상태 */
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm mb-4">연결된 환자가 없습니다</p>
            <div className="space-y-2">
              <button
                onClick={onMatchPatient}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                환자 검색/매칭
              </button>
              <button
                onClick={onRegisterPatient}
                className="w-full px-4 py-2.5 border border-blue-600 text-blue-600 text-sm rounded-lg hover:bg-blue-50 transition-colors"
              >
                신규 환자 등록
              </button>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

export default ChannelChatPatientPanel;
