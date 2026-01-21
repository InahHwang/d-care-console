'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, User, Phone, Check } from 'lucide-react';
import { PatientV2, PATIENT_STATUS_CONFIG } from '@/types/v2';

interface ChannelChatPatientMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatch: (patientId: string) => void;
  initialPhone?: string;
}

export function ChannelChatPatientMatchModal({
  isOpen,
  onClose,
  onMatch,
  initialPhone = '',
}: ChannelChatPatientMatchModalProps) {
  const [searchQuery, setSearchQuery] = useState(initialPhone);
  const [patients, setPatients] = useState<PatientV2[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 환자 검색
  const searchPatients = async (query: string) => {
    if (!query.trim()) {
      setPatients([]);
      return;
    }

    setIsLoading(true);
    try {
      // period=all로 전체 기간 검색, status 파라미터 없이 모든 상태 포함
      const res = await fetch(`/api/v2/patients?search=${encodeURIComponent(query)}&limit=10&period=all`);
      const data = await res.json();
      // API는 { patients: [...] } 형식으로 반환
      if (data.patients) {
        setPatients(data.patients);
      }
    } catch (error) {
      console.error('환자 검색 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 전화번호로 검색
  useEffect(() => {
    if (isOpen && initialPhone) {
      setSearchQuery(initialPhone);
      searchPatients(initialPhone);
    }
  }, [isOpen, initialPhone]);

  // 검색어 디바운싱
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 모달 닫기 시 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setPatients([]);
      setSelectedPatientId(null);
    }
  }, [isOpen]);

  const handleMatch = () => {
    if (selectedPatientId) {
      onMatch(selectedPatientId);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">환자 검색/매칭</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="이름 또는 전화번호로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* 검색 결과 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">검색 중...</div>
          ) : patients.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {searchQuery ? '검색 결과가 없습니다' : '이름 또는 전화번호를 입력하세요'}
            </div>
          ) : (
            <div className="space-y-2">
              {patients.map((patient) => {
                // API는 id 또는 _id로 반환할 수 있음
                const patientId = (patient as { id?: string }).id || patient._id?.toString();
                return (
                <button
                  key={patientId}
                  onClick={() => setSelectedPatientId(patientId || null)}
                  className={`w-full p-3 rounded-xl text-left transition-colors flex items-center gap-3 ${
                    selectedPatientId === patientId
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User size={20} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{patient.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${PATIENT_STATUS_CONFIG[patient.status].bgColor}`}>
                        {PATIENT_STATUS_CONFIG[patient.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <Phone size={12} />
                      <span>{patient.phone}</span>
                    </div>
                  </div>
                  {selectedPatientId === patientId && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleMatch}
            disabled={!selectedPatientId}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            매칭하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChannelChatPatientMatchModal;
