'use client';

import React from 'react';
import { Sparkles, ThermometerSun, Target, MessageCircle, AlertCircle } from 'lucide-react';
import { ChatAIAnalysis } from '@/types/v2';

interface ChannelChatAIAnalysisCardProps {
  analysis: ChatAIAnalysis;
  className?: string;
}

export function ChannelChatAIAnalysisCard({ analysis, className = '' }: ChannelChatAIAnalysisCardProps) {
  const temperatureConfig = {
    hot: { label: 'HOT', color: 'text-red-600', bg: 'bg-red-100' },
    warm: { label: 'WARM', color: 'text-amber-600', bg: 'bg-amber-100' },
    cold: { label: 'COLD', color: 'text-blue-600', bg: 'bg-blue-100' },
  };

  const followUpConfig = {
    '콜백필요': { color: 'bg-amber-100 text-amber-700', icon: '📞' },
    '예약확정': { color: 'bg-green-100 text-green-700', icon: '✅' },
    '종결': { color: 'bg-gray-100 text-gray-700', icon: '✔️' },
  };

  const tempConfig = temperatureConfig[analysis.temperature];
  const followConfig = followUpConfig[analysis.followUp];

  return (
    <div className={`bg-purple-50 rounded-xl p-4 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-purple-600" />
        <h3 className="text-sm font-medium text-purple-700">AI 분석 결과</h3>
        <span className="ml-auto text-xs text-purple-400">
          신뢰도 {Math.round(analysis.confidence * 100)}%
        </span>
      </div>

      {/* 요약 */}
      <p className="text-sm text-gray-700 mb-3">{analysis.summary}</p>

      {/* 태그들 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* 관심 치료 */}
        <div className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
          <Target size={12} />
          <span>{analysis.interest}</span>
        </div>

        {/* 온도 */}
        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${tempConfig.bg} ${tempConfig.color}`}>
          <ThermometerSun size={12} />
          <span>{tempConfig.label}</span>
        </div>

        {/* 후속 조치 */}
        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${followConfig.color}`}>
          <span>{followConfig.icon}</span>
          <span>{analysis.followUp}</span>
        </div>
      </div>

      {/* 우려 사항 */}
      {analysis.concerns.length > 0 && (
        <div className="border-t border-purple-100 pt-2">
          <div className="flex items-center gap-1 text-xs text-purple-600 mb-1">
            <AlertCircle size={12} />
            <span>고객 우려사항</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {analysis.concerns.map((concern, index) => (
              <span
                key={index}
                className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded"
              >
                {concern}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChannelChatAIAnalysisCard;
