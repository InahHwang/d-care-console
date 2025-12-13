// src/components/management/FloatingCTIPanel.tsx
// 플로팅 CTI 패널 - SSE 기반 CID 표시 + 환자 상세 모달 자동 오픈

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { selectPatientWithContext } from '@/store/slices/patientsSlice';
import { openPatientFormWithPhone } from '@/store/slices/uiSlice';
import { useCTI, CTIEvent } from '@/hooks/useCTI';

// 통화기록 타입
interface CallLogRecord {
  _id: string;
  callId: string;
  callerNumber: string;
  calledNumber: string;
  callStatus: 'ringing' | 'answered' | 'missed' | 'ended';
  callStartTime?: string;
  ringTime: string;
  isMissed: boolean;
  patientId?: string;
  patientName?: string;
}

export const FloatingCTIPanel: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // 🔥 로그인 상태 확인
  const { isAuthenticated, isInitialized } = useSelector((state: RootState) => state.auth);

  const {
    connected,
    connecting,
    events,
    currentCall,
    error,
    clearCurrentCall,
  } = useCTI();

  // 🔥 DB에서 불러온 최근 통화기록
  const [recentCallLogs, setRecentCallLogs] = useState<CallLogRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // 🔥 최근 통화기록 불러오기
  const fetchRecentCallLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const response = await fetch('/api/call-logs?limit=20');
      const data = await response.json();
      if (data.success) {
        setRecentCallLogs(data.data);
      }
    } catch (err) {
      console.error('[CTI] 통화기록 조회 실패:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  // 🔥 컴포넌트 마운트 시 통화기록 불러오기
  useEffect(() => {
    fetchRecentCallLogs();
  }, [fetchRecentCallLogs]);

  // 🔥 새 전화가 오면 통화기록 갱신
  useEffect(() => {
    if (currentCall) {
      // 3초 후에 통화기록 갱신 (DB 저장 후)
      const timer = setTimeout(() => {
        fetchRecentCallLogs();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentCall, fetchRecentCallLogs]);

  // 🔥 기본 상태: 패널이 닫혀 있고, 작은 버튼만 보임
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // 이전 콜 ID를 추적하여 중복 모달 오픈 방지
  const lastOpenedCallIdRef = useRef<string | null>(null);

  // 전화 오면 패널 자동 열기 + 등록 환자면 모달 자동 오픈
  useEffect(() => {
    if (currentCall) {
      // 🔥 전화 오면 패널 자동 열기
      setIsPanelOpen(true);

      // 🔥 등록된 환자인 경우 환자 상세 모달 자동 오픈
      // 같은 콜에 대해 중복 오픈 방지
      if (currentCall.patient && currentCall.id !== lastOpenedCallIdRef.current) {
        lastOpenedCallIdRef.current = currentCall.id;
        console.log('[CTI] 등록 환자 전화 수신 - 모달 자동 오픈:', currentCall.patient.name);

        // 내원관리 컨텍스트로 환자 상세 모달 오픈
        dispatch(selectPatientWithContext(currentCall.patient.id, 'visit-management'));
      }
    }
  }, [currentCall, dispatch]);

  // 🔥 환자 상세보기 버튼 클릭 핸들러
  const handleOpenPatientDetail = (patientId: string) => {
    console.log('[CTI] 환자 상세보기 클릭:', patientId);
    dispatch(selectPatientWithContext(patientId, 'visit-management'));
  };

  // 🔥 신규 환자 등록 버튼 클릭 핸들러
  const handleRegisterNewPatient = (phoneNumber: string) => {
    console.log('[CTI] 신규 환자 등록 클릭:', phoneNumber);
    dispatch(openPatientFormWithPhone(phoneNumber));
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-';
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    } else if (numbers.length === 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
    }
    return phone;
  };

  // 🔥 로그인 안 된 상태면 렌더링하지 않음
  if (!isInitialized || !isAuthenticated) {
    return null;
  }

  // 🔥 기본 상태: 작은 버튼만 보임 (패널이 닫혀 있을 때)
  if (!isPanelOpen) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div
          onClick={() => setIsPanelOpen(true)}
          className="bg-white shadow-lg rounded-full p-3 cursor-pointer hover:shadow-xl transition-shadow border"
        >
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
            <span className="text-sm font-medium text-gray-700">발신자표시</span>
            {currentCall && (
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // 🔥 패널이 열려 있을 때
  return (
    <div className="fixed bottom-4 left-4 z-50 w-80">
      <div className="bg-white shadow-xl rounded-lg border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg border-b">
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
            <h3 className="text-sm font-semibold text-gray-800">
              발신자 표시
            </h3>
            {currentCall && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full animate-pulse">
                전화 수신
              </span>
            )}
          </div>
          <button
            onClick={() => setIsPanelOpen(false)}
            className="text-gray-500 hover:text-gray-700 p-1 rounded"
            title="닫기"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-2 bg-red-50 border-b border-red-200">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Current Call - 전화가 왔을 때 강조 표시 */}
        {currentCall && (
          <div className={`p-3 border-b ${currentCall.patient ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  {currentCall.patient ? (
                    <>
                      <p className="text-lg font-bold text-green-900">
                        {currentCall.patient.name}
                      </p>
                      <p className="text-sm text-green-700">
                        {formatPhoneNumber(currentCall.callerNumber)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-yellow-900">
                        {formatPhoneNumber(currentCall.callerNumber)}
                      </p>
                      <p className="text-sm text-yellow-700">신규 고객</p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTime(currentCall.timestamp)}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {/* 🔥 등록된 환자인 경우 상세보기 버튼 표시 */}
                  {currentCall.patient && (
                    <button
                      onClick={() => handleOpenPatientDetail(currentCall.patient!.id)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      상세보기
                    </button>
                  )}
                  {/* 🔥 신규 고객인 경우 환자 등록 버튼 표시 */}
                  {!currentCall.patient && (
                    <button
                      onClick={() => handleRegisterNewPatient(currentCall.callerNumber)}
                      className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                    >
                      환자 등록
                    </button>
                  )}
                  <button
                    onClick={clearCurrentCall}
                    className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                  >
                    닫기
                  </button>
                </div>
              </div>
              {currentCall.patient?.lastVisit && (
                <p className="text-xs text-gray-600">
                  최근 내원: {currentCall.patient.lastVisit}
                </p>
              )}
              {currentCall.patient?.notes && (
                <p className="text-xs text-gray-600 truncate">
                  메모: {currentCall.patient.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 패널 내용 - 항상 표시 */}
        <div className="p-3 space-y-3">
          {/* 🔥 최근 통화기록 (DB에서 불러옴) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700">
                최근 통화기록 ({recentCallLogs.length}건)
              </h4>
              <button
                onClick={fetchRecentCallLogs}
                disabled={loadingLogs}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
              >
                {loadingLogs ? '로딩...' : '새로고침'}
              </button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {recentCallLogs.map((log) => {
                // 부재중 여부 판단: isMissed이거나, 통화시작 없이 종료된 경우
                const isMissedCall = log.isMissed || (log.callStatus === 'ringing') || (!log.callStartTime && log.callStatus !== 'answered');

                return (
                  <div
                    key={log._id}
                    className="bg-gray-50 rounded p-2 hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => {
                      if (log.patientId && log.patientName) {
                        // 등록된 환자 - 상세 모달 열기
                        handleOpenPatientDetail(log.patientId);
                      } else {
                        // 미등록 - 신규 등록 모달 열기
                        handleRegisterNewPatient(log.callerNumber);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              isMissedCall
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isMissedCall ? '부재중' : '통화완료'}
                          </span>
                          {log.patientName ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              {log.patientName}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-600">
                              신규등록
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-600 font-medium mt-1 hover:underline">
                          {formatPhoneNumber(log.callerNumber)}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatTime(log.ringTime)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {recentCallLogs.length === 0 && !loadingLogs && (
                <p className="text-xs text-gray-500 text-center py-2">
                  통화기록이 없습니다
                </p>
              )}
              {loadingLogs && (
                <p className="text-xs text-gray-500 text-center py-2">
                  로딩 중...
                </p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">
                상태:{' '}
                {connecting
                  ? '연결 중...'
                  : connected
                  ? '연결됨'
                  : '연결 안됨'}
              </span>
              <span className="text-gray-500">Pusher</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingCTIPanel;
