// src/components/management/CTIPanel.tsx
// CTI 실시간 패널 - CID(발신자번호) 표시

'use client';

import React from 'react';
import { useCTI, CTIEvent } from '@/hooks/useCTI';

export const CTIPanel: React.FC = () => {
  const {
    connected,
    connecting,
    events,
    currentCall,
    error,
    clearCurrentCall,
    clearEvents,
  } = useCTI();

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    // 숫자만 추출
    const numbers = phone.replace(/\D/g, '');
    // 형식에 맞게 변환
    if (numbers.length === 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    } else if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      {/* 헤더 - 연결 상태 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">CTI (발신자표시)</h2>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connecting
                ? 'bg-yellow-500 animate-pulse'
                : connected
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}
          />
          <span
            className={`text-sm font-medium ${
              connecting
                ? 'text-yellow-600'
                : connected
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {connecting ? '연결 중...' : connected ? '연결됨' : '연결 안됨'}
          </span>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* 현재 통화 (전화가 왔을 때) */}
      {currentCall && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4 mb-6 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-blue-800 flex items-center">
              <span className="mr-2 text-2xl">📞</span>
              전화 수신 중
            </h3>
            <button
              onClick={clearCurrentCall}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              닫기
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-gray-600 w-20">발신번호:</span>
              <span className="font-bold text-2xl text-blue-900">
                {formatPhoneNumber(currentCall.callerNumber)}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-600 w-20">수신번호:</span>
              <span className="text-gray-800">
                {formatPhoneNumber(currentCall.calledNumber)}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-gray-600 w-20">시간:</span>
              <span className="text-gray-800">{formatTime(currentCall.timestamp)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 이벤트 로그 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">최근 통화 이벤트</h3>
        {events.length > 0 && (
          <button
            onClick={clearEvents}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            기록 삭제
          </button>
        )}
      </div>

      {/* 이벤트 목록 */}
      <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>아직 수신된 이벤트가 없습니다.</p>
            <p className="text-sm mt-1">전화가 오면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event: CTIEvent) => (
              <div
                key={event.id}
                className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        event.eventType === 'INCOMING_CALL'
                          ? 'bg-blue-100 text-blue-800'
                          : event.eventType === 'MISSED_CALL'
                          ? 'bg-red-100 text-red-800'
                          : event.eventType === 'CALL_ENDED'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {event.eventType === 'INCOMING_CALL'
                        ? '수신'
                        : event.eventType === 'MISSED_CALL'
                        ? '부재중'
                        : event.eventType === 'CALL_ENDED'
                        ? '종료'
                        : '응답'}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {formatPhoneNumber(event.callerNumber)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
                {event.calledNumber && (
                  <p className="text-xs text-gray-500 mt-1">
                    수신: {formatPhoneNumber(event.calledNumber)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 연결 안됨 상태에서 수동 재연결 안내 */}
      {!connected && !connecting && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            CTI 서버와 연결되지 않았습니다.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            페이지를 새로고침하면 자동으로 재연결됩니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default CTIPanel;
