// src/app/v2/patients/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Calendar,
  MessageSquare,
  Edit2,
  Trash2,
  Sparkles,
  Clock,
  Save,
  X,
  History,
  User,
  XCircle,
  RotateCcw,
  Wallet,
  CircleDollarSign,
} from 'lucide-react';
import { Card } from '@/components/v2/ui/Card';
import { StatusBadge } from '@/components/v2/ui/Badge';
import { PatientStatus, ClosedReason, CLOSED_REASON_OPTIONS } from '@/types/v2';
import { StatusChangeModal, StatusChangeData } from '@/components/v2/patients/StatusChangeModal';
import { CallDetailModal } from '@/components/v2/patients/CallDetailModal';
import { ClosePatientModal } from '@/components/v2/patients/ClosePatientModal';
import { useAppSelector } from '@/hooks/reduxHooks';

// 상태 진행 단계 정의 (7단계 퍼널)
const statusSteps: Array<{ id: PatientStatus; label: string; color: string }> = [
  { id: 'consulting', label: '전화상담', color: 'bg-blue-500' },
  { id: 'reserved', label: '내원예약', color: 'bg-purple-500' },
  { id: 'visited', label: '내원완료', color: 'bg-amber-500' },
  { id: 'treatmentBooked', label: '치료예약', color: 'bg-teal-500' },
  { id: 'treatment', label: '치료중', color: 'bg-emerald-500' },
  { id: 'completed', label: '치료완료', color: 'bg-green-500' },
  { id: 'followup', label: '사후관리', color: 'bg-slate-500' },
];

interface CallLog {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  summary: string;
  classification: string;
}

interface StatusHistoryEntry {
  from: PatientStatus;
  to: PatientStatus;
  eventDate: string;
  changedAt: string;
  changedBy?: string;
  reason?: ClosedReason;
}

// 예약 상태 목록 (미래 일정)
const RESERVATION_STATUSES: PatientStatus[] = ['reserved', 'treatmentBooked'];

// 상태별 날짜 라벨
const DATE_LABELS: Record<PatientStatus, string> = {
  consulting: '상담일',
  reserved: '예약일',
  visited: '내원일',
  treatmentBooked: '예약일',
  treatment: '치료시작일',
  completed: '완료일',
  followup: '전환일',
  closed: '종결일',
};

// 시/도 및 시군구 데이터
const REGION_DATA: Record<string, string[]> = {
  '서울': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
  '부산': ['강서구', '금정구', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구', '기장군'],
  '대구': ['남구', '달서구', '동구', '북구', '서구', '수성구', '중구', '달성군'],
  '인천': ['계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '중구', '강화군', '옹진군'],
  '광주': ['광산구', '남구', '동구', '북구', '서구'],
  '대전': ['대덕구', '동구', '서구', '유성구', '중구'],
  '울산': ['남구', '동구', '북구', '중구', '울주군'],
  '세종': ['세종시'],
  '경기': ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시', '광주시', '이천시', '양주시', '오산시', '구리시', '안성시', '포천시', '의왕시', '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'],
  '강원': ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'],
  '충북': ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
  '충남': ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
  '전북': ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
  '전남': ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
  '경북': ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '군위군', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
  '경남': ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
  '제주': ['제주시', '서귀포시'],
};

const PROVINCES = Object.keys(REGION_DATA);

type PaymentStatus = 'none' | 'partial' | 'completed';

interface PatientDetail {
  id: string;
  name: string;
  phone: string;
  status: PatientStatus;
  interest: string;
  source?: string;
  summary: string;
  classification: string;
  followUp: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt: string;
  statusChangedAt?: string;
  nextAction?: string;
  nextActionDate?: string;
  callCount: number;
  memo: string;
  tags: string[];
  statusHistory?: StatusHistoryEntry[];
  age?: number;
  region?: {
    province: string;
    city?: string;
  };
  // 금액 관련 필드
  estimatedAmount?: number;
  actualAmount?: number;
  paymentStatus?: PaymentStatus;
  treatmentNote?: string;
}

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  // 현재 로그인한 사용자 정보
  const { user } = useAppSelector((state) => state.auth);

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<PatientDetail>>({});
  const [saving, setSaving] = useState(false);

  // 상태 변경 모달
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PatientStatus | null>(null);

  // 통화 상세 모달
  const [callDetailModalOpen, setCallDetailModalOpen] = useState(false);
  const [selectedCallLogId, setSelectedCallLogId] = useState<string | null>(null);

  // 종결 모달
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  // 마스터 권한 확인
  const isMaster = user?.role === 'master';

  const fetchPatient = useCallback(async () => {
    try {
      const response = await fetch(`/api/v2/patients/${patientId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('환자를 찾을 수 없습니다');
        } else {
          throw new Error('Failed to fetch');
        }
        return;
      }

      const data = await response.json();
      setPatient(data.patient);
      setCallLogs(data.callLogs);
      setEditData(data.patient);
    } catch (err) {
      setError('환자 정보를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const handleCall = () => {
    if (patient) {
      window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone: patient.phone } }));
    }
  };

  // 상태 버튼 클릭 시 모달 열기
  const handleStatusClick = (newStatus: PatientStatus) => {
    if (!patient || newStatus === patient.status) return;
    setPendingStatus(newStatus);
    setStatusModalOpen(true);
  };

  // 상태 변경 확정 (모달에서 확인 클릭)
  const handleStatusConfirm = async (data: StatusChangeData) => {
    if (!patient) return;

    try {
      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: data.newStatus,
          eventDate: data.eventDate,
          isReservation: data.isReservation, // 예약 상태 여부
          changedBy: user?.name || '알 수 없음', // 변경한 사용자
        }),
      });

      if (response.ok) {
        // 로컬 상태 업데이트
        if (data.isReservation) {
          // 예약 상태: 다음 일정 설정
          setPatient({
            ...patient,
            status: data.newStatus,
            nextAction: statusSteps.find(s => s.id === data.newStatus)?.label || '',
            nextActionDate: data.eventDate,
            statusChangedAt: new Date().toISOString(),
          });
        } else {
          // 완료 상태: 다음 일정 초기화
          setPatient({
            ...patient,
            status: data.newStatus,
            nextAction: undefined,
            nextActionDate: undefined,
            statusChangedAt: new Date().toISOString(),
          });
        }
        // 전체 데이터 다시 로드 (히스토리 포함)
        fetchPatient();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setStatusModalOpen(false);
      setPendingStatus(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          phone: editData.phone,
          interest: editData.interest,
          source: editData.source,
          memo: editData.memo,
          nextAction: editData.nextAction,
          nextActionDate: editData.nextActionDate,
          tags: editData.tags,
          age: editData.age || undefined,
          region: editData.region?.province ? editData.region : undefined,
          // 금액 관련 필드
          estimatedAmount: editData.estimatedAmount,
          actualAmount: editData.actualAmount,
          paymentStatus: editData.paymentStatus,
          treatmentNote: editData.treatmentNote,
        }),
      });

      if (response.ok) {
        // 서버에서 최신 데이터 다시 가져오기
        await fetchPatient();
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 환자를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/v2/patients');
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  // 종결 처리
  const handleClosePatient = async (reason: ClosedReason) => {
    if (!patient) return;

    try {
      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          closedReason: reason,
          changedBy: user?.name || '알 수 없음',
        }),
      });

      if (response.ok) {
        await fetchPatient();
        setCloseModalOpen(false);
      }
    } catch (err) {
      console.error('Error closing patient:', err);
    }
  };

  // 다시 활성화
  const handleReactivatePatient = async () => {
    if (!patient) return;
    if (!confirm('이 환자를 다시 활성화하시겠습니까?')) return;

    // statusHistory에서 종결 직전 상태 찾기
    const closedEntry = patient.statusHistory?.find(h => h.to === 'closed');
    const previousStatus = closedEntry?.from || 'consulting';

    try {
      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: previousStatus,
          changedBy: user?.name || '알 수 없음',
          isReactivation: true,
        }),
      });

      if (response.ok) {
        await fetchPatient();
      }
    } catch (err) {
      console.error('Error reactivating patient:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  };

  const getDdayDisplay = (dateString: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff > 0) {
      return { text: `D-${diff}`, style: diff <= 3 ? 'text-orange-500' : 'text-gray-600' };
    } else if (diff === 0) {
      return { text: 'D-Day', style: 'text-blue-600 font-bold' };
    } else {
      return { text: `+${Math.abs(diff)}일 지남`, style: 'text-red-500 font-medium' };
    }
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl h-48" />
            <div className="bg-white rounded-xl h-64" />
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-xl h-48" />
            <div className="bg-white rounded-xl h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          돌아가기
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
          환자 목록
        </button>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Edit2 size={18} />
                수정
              </button>
              {patient.status === 'closed' ? (
                <button
                  onClick={handleReactivatePatient}
                  className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                >
                  <RotateCcw size={18} />
                  다시 활성화
                </button>
              ) : (
                <button
                  onClick={() => setCloseModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle size={18} />
                  종결
                </button>
              )}
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={18} />
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.name || ''}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="text-2xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-500 outline-none"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
                  )}
                  <StatusBadge status={patient.status} />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-gray-500">{patient.phone}</p>
                  {patient.source && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {patient.source}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleCall}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
              >
                <Phone size={20} />
                전화하기
              </button>
            </div>

            {/* 나이/지역 정보 */}
            <div className="flex items-center gap-6 mb-4">
              {isEditing ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">나이:</span>
                    <input
                      type="number"
                      value={editData.age || ''}
                      onChange={(e) => setEditData({ ...editData, age: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="나이"
                      min="1"
                      max="120"
                      className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">지역:</span>
                    <select
                      value={editData.region?.province || ''}
                      onChange={(e) => setEditData({
                        ...editData,
                        region: e.target.value ? { province: e.target.value, city: '' } : undefined
                      })}
                      className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">시/도</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <select
                      value={editData.region?.city || ''}
                      onChange={(e) => setEditData({
                        ...editData,
                        region: { province: editData.region?.province || '', city: e.target.value }
                      })}
                      disabled={!editData.region?.province}
                      className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="">시/군/구</option>
                      {editData.region?.province && REGION_DATA[editData.region.province]?.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {patient.age && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">나이:</span>
                      <span className="text-sm font-medium text-gray-900">{patient.age}세</span>
                    </div>
                  )}
                  {patient.region && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">지역:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {patient.region.province}
                        {patient.region.city && ` ${patient.region.city}`}
                      </span>
                    </div>
                  )}
                  {!patient.age && !patient.region && (
                    <span className="text-sm text-gray-400">나이/지역 정보 없음</span>
                  )}
                </>
              )}
            </div>

            {/* 종결된 환자인 경우 종결 정보 표시 */}
            {patient.status === 'closed' ? (
              <div className="py-4 border-t">
                <div className="bg-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={20} className="text-gray-500" />
                    <p className="font-medium text-gray-700">종결된 환자</p>
                  </div>
                  {(() => {
                    const closedEntry = patient.statusHistory?.find(h => h.to === 'closed');
                    const previousStatus = closedEntry?.from;
                    const previousLabel = statusSteps.find(s => s.id === previousStatus)?.label || previousStatus;
                    return (
                      <div className="space-y-2 text-sm">
                        {closedEntry?.reason && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">종결 사유:</span>
                            <span className="font-medium text-gray-700">
                              {CLOSED_REASON_OPTIONS.find(o => o.value === closedEntry.reason)?.label || closedEntry.reason}
                            </span>
                          </div>
                        )}
                        {previousLabel && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">이전 단계:</span>
                            <span className="font-medium text-gray-700">{previousLabel}</span>
                          </div>
                        )}
                        {closedEntry && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">종결일:</span>
                            <span className="font-medium text-gray-700">{formatDateOnly(closedEntry.eventDate)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="py-4 border-t">
                <p className="text-sm text-gray-500 mb-3">상담 진행 단계</p>
                <div className="flex items-center gap-2">
                  {statusSteps.map((step, index) => {
                    const currentIndex = statusSteps.findIndex(s => s.id === patient.status);
                    const isPast = index < currentIndex;
                    const isCurrent = step.id === patient.status;

                    return (
                      <React.Fragment key={step.id}>
                        {index > 0 && (
                          <div className={`w-8 h-0.5 ${isPast ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        )}
                        <button
                          onClick={() => handleStatusClick(step.id)}
                          disabled={isCurrent}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all
                            ${isCurrent
                              ? `${step.color} text-white cursor-default`
                              : isPast
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }
                          `}
                        >
                          {step.label}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-purple-500" />
              <h2 className="font-bold text-gray-900">AI 분석 결과</h2>
            </div>

            <div className="space-y-4">
              {patient.interest && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">관심 분야</p>
                  <p className="text-blue-600 font-medium">{patient.interest}</p>
                </div>
              )}
              {patient.summary && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">상담 요약</p>
                  <p className="text-gray-700">{patient.summary}</p>
                </div>
              )}
              {patient.followUp && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">후속 조치 추천</p>
                  <p className="text-gray-700">{patient.followUp}</p>
                </div>
              )}
              {!patient.interest && !patient.summary && !patient.followUp && (
                <p className="text-gray-400 text-center py-4">
                  아직 AI 분석 결과가 없습니다
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Phone size={20} className="text-gray-400" />
                <h2 className="font-bold text-gray-900">통화 이력</h2>
                <span className="text-sm text-gray-400">({patient.callCount}회)</span>
              </div>
            </div>

            {callLogs.length > 0 ? (
              <div className="space-y-3">
                {callLogs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => {
                      setSelectedCallLogId(log.id);
                      setCallDetailModalOpen(true);
                    }}
                    className="w-full flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors text-left"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        log.callType === 'inbound' ? 'bg-blue-100' : 'bg-emerald-100'
                      }`}
                    >
                      <Phone
                        size={18}
                        className={log.callType === 'inbound' ? 'text-blue-600' : 'text-emerald-600'}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {log.callType === 'inbound' ? '수신' : '발신'} 통화
                        </span>
                        <span className="text-sm text-gray-400">• {formatDuration(log.duration)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">
                        {formatDateOnly(log.callTime)} {new Date(log.callTime).getHours().toString().padStart(2, '0')}:{new Date(log.callTime).getMinutes().toString().padStart(2, '0')}
                      </p>
                      {log.summary && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{log.summary}</p>
                      )}
                    </div>
                    <div className="text-xs text-blue-500 self-center">
                      상세보기
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">통화 이력이 없습니다</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-bold text-gray-900 mb-4">빠른 정보</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">등록일</span>
                <span className="text-gray-900">{formatDate(patient.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">최근 연락</span>
                <span className="text-gray-900">{formatDate(patient.lastContactAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">총 통화</span>
                <span className="text-gray-900">{patient.callCount}회</span>
              </div>
              {patient.source && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">유입경로</span>
                  <span className="text-gray-900">{patient.source}</span>
                </div>
              )}
              {patient.statusChangedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">상태 변경</span>
                  <span className="text-gray-900">{formatDate(patient.statusChangedAt)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* 상태 변경 히스토리 */}
          {patient.statusHistory && patient.statusHistory.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <History size={18} className="text-purple-500" />
                <h3 className="font-bold text-gray-900">상태 변경 이력</h3>
              </div>
              <div className="space-y-3">
                {patient.statusHistory.slice().reverse().map((entry, index) => {
                  const fromLabel = statusSteps.find(s => s.id === entry.from)?.label || entry.from;
                  const toLabel = entry.to === 'closed' ? '종결' : (statusSteps.find(s => s.id === entry.to)?.label || entry.to);
                  const toColor = entry.to === 'closed' ? 'bg-gray-500' : (statusSteps.find(s => s.id === entry.to)?.color || 'bg-gray-500');
                  const dateLabel = DATE_LABELS[entry.to] || '발생일';

                  return (
                    <div key={index} className="relative pl-4 border-l-2 border-purple-200 pb-3 last:pb-0">
                      <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-purple-400" />
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500">{fromLabel}</span>
                        <span className="text-gray-400">→</span>
                        <span className={`px-2 py-0.5 rounded text-white text-xs ${toColor}`}>
                          {toLabel}
                        </span>
                      </div>
                      {/* 종결 사유 표시 */}
                      {entry.to === 'closed' && entry.reason && (
                        <div className="mt-1 text-xs text-gray-500">
                          사유: {CLOSED_REASON_OPTIONS.find(o => o.value === entry.reason)?.label || entry.reason}
                        </div>
                      )}
                      <div className="flex flex-col gap-1 mt-1.5 text-xs text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{dateLabel}:</span>
                          <span className="font-medium text-gray-600">{formatDateOnly(entry.eventDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.changedBy && (
                            <>
                              <User size={12} />
                              <span>{entry.changedBy}</span>
                              <span className="text-gray-300">|</span>
                            </>
                          )}
                          <span>{formatDate(entry.changedAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={18} className="text-gray-400" />
              <h3 className="font-bold text-gray-900">메모</h3>
            </div>
            {isEditing ? (
              <textarea
                value={editData.memo || ''}
                onChange={(e) => setEditData({ ...editData, memo: e.target.value })}
                className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="메모를 입력하세요..."
              />
            ) : patient.memo ? (
              <p className="text-gray-600 whitespace-pre-wrap">{patient.memo}</p>
            ) : (
              <p className="text-gray-400">메모가 없습니다</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-blue-500" />
              <h3 className="font-bold text-gray-900">다음 일정</h3>
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">다음 액션</label>
                  <div className="flex flex-wrap gap-2">
                    {['콜백', '내원예약', '치료예약', '치료시작', '재상담'].map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => setEditData({ ...editData, nextAction: action })}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          editData.nextAction === action
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={editData.nextAction || ''}
                    onChange={(e) => setEditData({ ...editData, nextAction: e.target.value })}
                    placeholder="직접 입력..."
                    className="w-full mt-2 p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">예정일</label>
                  <input
                    type="date"
                    value={editData.nextActionDate ? editData.nextActionDate.split('T')[0] : ''}
                    onChange={(e) => setEditData({ ...editData, nextActionDate: e.target.value })}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            ) : patient.nextAction || patient.nextActionDate ? (
              <div className={`rounded-lg p-4 ${
                patient.nextActionDate && getDdayDisplay(patient.nextActionDate).style.includes('red')
                  ? 'bg-red-50'
                  : patient.nextActionDate && getDdayDisplay(patient.nextActionDate).style.includes('blue')
                    ? 'bg-blue-50'
                    : 'bg-gray-50'
              }`}>
                {patient.nextAction && (
                  <p className="font-medium text-gray-900 mb-1">{patient.nextAction}</p>
                )}
                {patient.nextActionDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {formatDateOnly(patient.nextActionDate)}
                    </span>
                    <span className={`text-sm font-medium ${getDdayDisplay(patient.nextActionDate).style}`}>
                      {getDdayDisplay(patient.nextActionDate).text}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                다음 일정 추가
              </button>
            )}
          </Card>

          {/* 치료금액 카드 */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={18} className="text-emerald-500" />
              <h3 className="font-bold text-gray-900">치료금액</h3>
            </div>
            {isEditing ? (
              <div className="space-y-4">
                {/* 예상 금액 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">예상 치료금액</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editData.estimatedAmount || ''}
                      onChange={(e) => setEditData({ ...editData, estimatedAmount: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="0"
                      className="w-full p-2 pr-8 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                  </div>
                </div>
                {/* 실제 금액 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">실제 결제금액</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={editData.actualAmount || ''}
                      onChange={(e) => setEditData({ ...editData, actualAmount: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="0"
                      className="w-full p-2 pr-8 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                  </div>
                </div>
                {/* 결제 상태 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">결제 상태</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'none', label: '미결제' },
                      { value: 'partial', label: '부분결제' },
                      { value: 'completed', label: '완납' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditData({ ...editData, paymentStatus: opt.value as PaymentStatus })}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          editData.paymentStatus === opt.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 시술 내역 메모 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">시술 내역</label>
                  <input
                    type="text"
                    value={editData.treatmentNote || ''}
                    onChange={(e) => setEditData({ ...editData, treatmentNote: e.target.value })}
                    placeholder="예: 임플란트 2본, 크라운 1개"
                    className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            ) : (patient.estimatedAmount || patient.actualAmount) ? (
              <div className="space-y-3">
                {/* 금액 표시 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">예상 금액</span>
                    <span className="font-medium text-gray-900">
                      {patient.estimatedAmount ? `${patient.estimatedAmount.toLocaleString()}원` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">실제 결제</span>
                    <span className="font-bold text-emerald-600">
                      {patient.actualAmount ? `${patient.actualAmount.toLocaleString()}원` : '-'}
                    </span>
                  </div>
                  {patient.paymentStatus && patient.paymentStatus !== 'none' && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-gray-500">결제 상태</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        patient.paymentStatus === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {patient.paymentStatus === 'completed' ? '완납' : '부분결제'}
                      </span>
                    </div>
                  )}
                </div>
                {/* 시술 내역 */}
                {patient.treatmentNote && (
                  <div className="text-sm">
                    <span className="text-gray-500">시술: </span>
                    <span className="text-gray-700">{patient.treatmentNote}</span>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
              >
                <CircleDollarSign size={20} className="inline mr-2" />
                금액 정보 추가
              </button>
            )}
          </Card>
        </div>
      </div>

      {/* 상태 변경 모달 */}
      {pendingStatus && (
        <StatusChangeModal
          isOpen={statusModalOpen}
          onClose={() => {
            setStatusModalOpen(false);
            setPendingStatus(null);
          }}
          onConfirm={handleStatusConfirm}
          currentStatus={patient.status}
          newStatus={pendingStatus}
          patientName={patient.name}
          scheduledDate={patient.nextActionDate}
        />
      )}

      {/* 통화 상세 모달 */}
      {selectedCallLogId && (
        <CallDetailModal
          isOpen={callDetailModalOpen}
          onClose={() => {
            setCallDetailModalOpen(false);
            setSelectedCallLogId(null);
          }}
          callLogId={selectedCallLogId}
          isMaster={isMaster}
        />
      )}

      {/* 종결 모달 */}
      <ClosePatientModal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onConfirm={handleClosePatient}
        patientName={patient.name}
        currentStatus={patient.status}
      />
    </div>
  );
}
