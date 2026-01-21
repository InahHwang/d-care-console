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
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/v2/ui/Card';
import { StatusBadge } from '@/components/v2/ui/Badge';
import { PatientStatus, ClosedReason, CLOSED_REASON_OPTIONS, Journey, TREATMENT_TYPES, CallbackReason, CALLBACK_REASON_LABELS, CallbackHistoryEntry } from '@/types/v2';
import { StatusChangeModal, StatusChangeData } from '@/components/v2/patients/StatusChangeModal';
import { CallDetailModal } from '@/components/v2/patients/CallDetailModal';
import { ClosePatientModal } from '@/components/v2/patients/ClosePatientModal';
import { ConsultationInputModal, ConsultationFormData, ExistingConsultationData } from '@/components/v2/patients/ConsultationInputModal';
import { ConsultationHistory } from '@/components/v2/patients/ConsultationHistory';
import { ConsultationHistoryCard } from '@/components/v2/patients/ConsultationHistoryCard';
import { useAppSelector } from '@/hooks/reduxHooks';
import { ClipboardList } from 'lucide-react';

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

// 콜백 타입 정의
type CallbackTypeValue = 'callback' | 'recall' | 'thanks';

const CALLBACK_TYPE_LABELS: Record<CallbackTypeValue, string> = {
  callback: '콜백',
  recall: '리콜',
  thanks: '감사전화',
};

const CALLBACK_TYPE_COLORS: Record<CallbackTypeValue, string> = {
  callback: 'bg-blue-100 text-blue-700',
  recall: 'bg-purple-100 text-purple-700',
  thanks: 'bg-amber-100 text-amber-700',
};

interface CallLog {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  summary: string;
  classification: string;
  callbackType?: CallbackTypeValue | null;
  callbackId?: string | null;
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
  consultationType?: string;
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
  nextActionNote?: string;
  callCount: number;
  memo: string;
  tags: string[];
  statusHistory?: StatusHistoryEntry[];
  callbackHistory?: CallbackHistoryEntry[];
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
  // 치료 진행 관련 필드
  treatmentStartDate?: string;
  expectedCompletionDate?: string;
  // 여정 관련 필드
  journeys?: Journey[];
  activeJourneyId?: string;
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

  // 상담 결과 모달
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [consultationType, setConsultationType] = useState<'phone' | 'visit'>('phone');
  const [existingConsultation, setExistingConsultation] = useState<ExistingConsultationData | undefined>(undefined);

  // 상담 이력
  const [consultations, setConsultations] = useState<any[]>([]);
  const [consultationsLoading, setConsultationsLoading] = useState(false);

  // 🆕 예정일 변경 모달
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  // 마스터 권한 확인
  const isMaster = user?.role === 'master';

  // 🆕 여정(Journey) 관련 상태
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [isJourneyDropdownOpen, setIsJourneyDropdownOpen] = useState(false);
  const [isNewJourneyModalOpen, setIsNewJourneyModalOpen] = useState(false);

  const selectedJourney = journeys.find(j => j.id === selectedJourneyId);

  // 🆕 선택된 여정 기준 데이터 (여정별 독립적인 데이터 표시)
  const displayStatus = selectedJourney?.status || patient?.status || 'consulting';
  const displayEstimatedAmount = selectedJourney?.estimatedAmount ?? patient?.estimatedAmount;
  const displayActualAmount = selectedJourney?.actualAmount ?? patient?.actualAmount;
  const displayPaymentStatus = selectedJourney?.paymentStatus ?? patient?.paymentStatus;
  const displayTreatmentNote = selectedJourney?.treatmentNote ?? patient?.treatmentNote;
  const displayInterest = selectedJourney?.treatmentType || patient?.interest;
  const displayStatusHistory = selectedJourney?.statusHistory || patient?.statusHistory;
  const displayCallbackHistory = selectedJourney?.callbackHistory || patient?.callbackHistory;
  const displayNextActionDate = selectedJourney?.nextActionDate || patient?.nextActionDate;
  const displayNextActionNote = selectedJourney?.nextActionNote || patient?.nextActionNote;
  const isActiveJourney = selectedJourney?.isActive ?? true;

  const getStatusColor = (status: PatientStatus) => {
    return statusSteps.find(s => s.id === status)?.color || 'bg-gray-500';
  };

  const getStatusLabel = (status: PatientStatus) => {
    return statusSteps.find(s => s.id === status)?.label || status;
  };

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

      // 여정 데이터 설정
      const patientJourneys = data.patient.journeys || [];
      setJourneys(patientJourneys);

      // 활성 여정 또는 첫 번째 여정 선택
      const activeJourneyId = data.patient.activeJourneyId;
      if (activeJourneyId) {
        setSelectedJourneyId(activeJourneyId);
      } else if (patientJourneys.length > 0) {
        const activeJ = patientJourneys.find((j: Journey) => j.isActive);
        setSelectedJourneyId(activeJ?.id || patientJourneys[0].id);
      }
    } catch (err) {
      setError('환자 정보를 불러오는 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  // 상담 이력 조회
  const fetchConsultations = useCallback(async () => {
    setConsultationsLoading(true);
    try {
      const response = await fetch(`/api/v2/consultations?patientId=${patientId}`);
      if (response.ok) {
        const data = await response.json();
        setConsultations(data.data?.consultations || []);
      }
    } catch (err) {
      console.error('상담 이력 조회 실패:', err);
    } finally {
      setConsultationsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPatient();
    fetchConsultations();
  }, [fetchPatient, fetchConsultations]);

  // 상담 결과 저장 (신규 생성 또는 수정)
  const handleConsultationSubmit = async (formData: ConsultationFormData, existingId?: string) => {
    try {
      // 수정 모드 (existingId가 있으면)
      if (existingId) {
        const response = await fetch('/api/v2/consultations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: existingId,
            ...formData,
            editedBy: user?.name || '알 수 없음',
          }),
        });

        if (!response.ok) {
          throw new Error('상담 결과 수정 실패');
        }
      } else {
        // 신규 생성 모드
        const response = await fetch('/api/v2/consultations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            ...formData,
          }),
        });

        if (!response.ok) {
          throw new Error('상담 결과 저장 실패');
        }
      }

      // 환자 정보와 상담 이력 새로고침
      await fetchPatient();
      await fetchConsultations();
    } catch (err) {
      console.error('상담 결과 저장 실패:', err);
      throw err;
    }
  };

  // 상담 결과 입력 모달 열기 (전화상담은 기존 데이터 확인)
  const openConsultationModal = (type: 'phone' | 'visit') => {
    setConsultationType(type);

    // 전화상담인 경우: 기존 AI 자동분류 데이터 확인
    if (type === 'phone') {
      // 최근 전화상담 기록 중 가장 최신 것 찾기
      const latestPhoneConsultation = consultations.find(c => c.type === 'phone');

      if (latestPhoneConsultation) {
        // 기존 데이터를 수정 모드로 전달
        setExistingConsultation({
          id: latestPhoneConsultation.id,
          status: latestPhoneConsultation.status,
          treatment: latestPhoneConsultation.treatment,
          originalAmount: latestPhoneConsultation.originalAmount,
          discountRate: latestPhoneConsultation.discountRate,
          discountReason: latestPhoneConsultation.discountReason,
          disagreeReasons: latestPhoneConsultation.disagreeReasons,
          correctionPlan: latestPhoneConsultation.correctionPlan,
          appointmentDate: latestPhoneConsultation.appointmentDate
            ? new Date(latestPhoneConsultation.appointmentDate).toISOString().split('T')[0]
            : undefined,
          callbackDate: latestPhoneConsultation.callbackDate
            ? new Date(latestPhoneConsultation.callbackDate).toISOString().split('T')[0]
            : undefined,
          consultantName: latestPhoneConsultation.consultantName,
          memo: latestPhoneConsultation.memo,
          aiGenerated: latestPhoneConsultation.aiGenerated,
          aiSummary: latestPhoneConsultation.aiSummary,
        });
      } else {
        setExistingConsultation(undefined);
      }
    } else {
      // 내원상담은 항상 신규 입력
      setExistingConsultation(undefined);
    }

    setConsultationModalOpen(true);
  };

  const handleCall = () => {
    if (patient) {
      window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone: patient.phone } }));
    }
  };

  // 상태 버튼 클릭 시 모달 열기
  const handleStatusClick = (newStatus: PatientStatus) => {
    if (!patient || newStatus === displayStatus) return;
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
          // 치료 진행 관련 필드
          treatmentStartDate: editData.treatmentStartDate,
          expectedCompletionDate: editData.expectedCompletionDate,
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
  const handleClosePatient = async (reason: ClosedReason, customReason?: string) => {
    if (!patient) return;

    try {
      // 기타 선택 시 사용자 입력 사유 사용
      const finalReason = reason === '기타' && customReason ? `기타: ${customReason}` : reason;

      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          closedReason: finalReason,
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

  // 🆕 예정일 변경 핸들러
  const handleScheduleChange = async (data: { newDate: string; reason?: CallbackReason; note?: string }) => {
    if (!patient) return;

    try {
      const response = await fetch(`/api/v2/patients/${patientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateType: 'schedule',
          newScheduleDate: data.newDate,
          callbackReason: data.reason,
          callbackNote: data.note,
        }),
      });

      if (response.ok) {
        await fetchPatient();
        setScheduleModalOpen(false);
      }
    } catch (err) {
      console.error('Error updating schedule:', err);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateValue: string | Date) => {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateOnly = (dateValue: string | Date) => {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
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
          onClick={() => router.push('/v2/patients')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={20} />
          환자 목록
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
          onClick={() => router.push('/v2/patients')}
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

      {/* ============================================ */}
      {/* 🆕 여정 선택 영역 */}
      {/* ============================================ */}
      <Card className="p-4 mb-6 border-2 border-blue-200 bg-blue-50/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* 여정 선택 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setIsJourneyDropdownOpen(!isJourneyDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm text-gray-500">현재 여정:</span>
                <span className="font-medium text-gray-900">
                  {selectedJourney?.treatmentType || '선택'}
                </span>
                {selectedJourney && (
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(selectedJourney.status)}`}>
                    {getStatusLabel(selectedJourney.status)}
                  </span>
                )}
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isJourneyDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* 드롭다운 메뉴 */}
              {isJourneyDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsJourneyDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="p-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500 px-2">치료 여정 목록</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {journeys.map((journey) => (
                        <button
                          key={journey.id}
                          onClick={() => {
                            setSelectedJourneyId(journey.id);
                            setIsJourneyDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                            selectedJourneyId === journey.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {journey.isActive ? (
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-gray-300" />
                            )}
                            <div className="text-left">
                              <p className="font-medium text-gray-900">{journey.treatmentType}</p>
                              <p className="text-xs text-gray-500">
                                {formatDateOnly(journey.startedAt)}
                                {journey.closedAt && ` ~ ${formatDateOnly(journey.closedAt)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs text-white ${getStatusColor(journey.status)}`}>
                              {getStatusLabel(journey.status)}
                            </span>
                            {journey.isActive && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                진행중
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setIsNewJourneyModalOpen(true);
                          setIsJourneyDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus size={16} />
                        새 여정 시작 (구신환)
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 진행중 여정 표시 */}
            {journeys.find(j => j.isActive) && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>진행중: {journeys.find(j => j.isActive)?.treatmentType}</span>
              </div>
            )}
          </div>

          {/* 여정 요약 통계 */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-gray-500">총 여정</p>
              <p className="text-xl font-bold text-gray-900">{journeys.length}개</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">완료</p>
              <p className="text-xl font-bold text-green-600">
                {journeys.filter(j => j.status === 'completed' || j.closedAt).length}개
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">진행중</p>
              <p className="text-xl font-bold text-blue-600">
                {journeys.filter(j => j.isActive).length}개
              </p>
            </div>
          </div>
        </div>
      </Card>

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
                  {patient.consultationType && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                      {patient.consultationType}
                    </span>
                  )}
                  <StatusBadge status={displayStatus} />
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
              <div className="flex items-center gap-2">
                {/* 상담 결과 입력 버튼 - consulting 또는 visited 상태일 때 표시 (활성 여정만) */}
                {isActiveJourney && (displayStatus === 'consulting' || displayStatus === 'visited') && (
                  <button
                    onClick={() => openConsultationModal(displayStatus === 'consulting' ? 'phone' : 'visit')}
                    className="flex items-center gap-2 px-5 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                  >
                    <ClipboardList size={20} />
                    {displayStatus === 'consulting' ? '전화상담 결과' : '내원상담 결과'}
                  </button>
                )}
                <button
                  onClick={handleCall}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Phone size={20} />
                  전화하기
                </button>
              </div>
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

            {/* 종결된 여정인 경우 종결 정보 표시 */}
            {displayStatus === 'closed' ? (
              <div className="py-4 border-t">
                <div className="bg-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle size={20} className="text-gray-500" />
                    <p className="font-medium text-gray-700">종결된 {isActiveJourney ? '환자' : '여정'}</p>
                  </div>
                  {(() => {
                    const closedEntry = displayStatusHistory?.find(h => h.to === 'closed');
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
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">상담 진행 단계</p>
                  {!isActiveJourney && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      과거 여정 (읽기 전용)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {statusSteps.map((step, index) => {
                    const currentIndex = statusSteps.findIndex(s => s.id === displayStatus);
                    const isPast = index < currentIndex;
                    const isCurrent = step.id === displayStatus;

                    return (
                      <React.Fragment key={step.id}>
                        {index > 0 && (
                          <div className={`w-8 h-0.5 ${isPast ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        )}
                        <button
                          onClick={() => isActiveJourney && handleStatusClick(step.id)}
                          disabled={isCurrent || !isActiveJourney}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all
                            ${isCurrent
                              ? `${step.color} text-white cursor-default`
                              : isPast
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }
                            ${!isActiveJourney ? 'opacity-60 cursor-not-allowed' : ''}
                          `}
                        >
                          {step.label}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 🆕 예정일 표시 및 버튼 */}
                {isActiveJourney && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      {/* 예정일 표시 */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">예정일:</span>
                        {displayNextActionDate ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {formatDateOnly(displayNextActionDate)}
                            </span>
                            <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                              getDdayDisplay(displayNextActionDate as string).style.includes('red')
                                ? 'bg-red-100 text-red-600'
                                : getDdayDisplay(displayNextActionDate as string).style.includes('blue')
                                  ? 'bg-blue-100 text-blue-600'
                                  : getDdayDisplay(displayNextActionDate as string).style.includes('orange')
                                    ? 'bg-orange-100 text-orange-600'
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                              {getDdayDisplay(displayNextActionDate as string).text}
                            </span>
                            {displayNextActionNote && (
                              <span className="text-xs text-gray-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                📝 {displayNextActionNote}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">미설정</span>
                        )}
                      </div>

                      {/* 버튼 영역 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setScheduleModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Calendar size={14} />
                          {displayNextActionDate ? '예정일 변경' : '예정일 설정'}
                        </button>
                      </div>
                    </div>

                    {/* 🆕 콜백 이력 표시 */}
                    {displayCallbackHistory && displayCallbackHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">콜백 이력</p>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {displayCallbackHistory.slice().reverse().slice(0, 5).map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-400">
                                {formatDateOnly(entry.scheduledAt)}
                              </span>
                              {entry.reason && (
                                <span className={`px-1.5 py-0.5 rounded ${
                                  entry.reason === 'no_answer' ? 'bg-red-100 text-red-600' :
                                  entry.reason === 'postponed' ? 'bg-amber-100 text-amber-600' :
                                  'bg-purple-100 text-purple-600'
                                }`}>
                                  {CALLBACK_REASON_LABELS[entry.reason]}
                                </span>
                              )}
                              {entry.note && (
                                <span className="text-gray-500 truncate max-w-[200px]">
                                  &quot;{entry.note}&quot;
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-purple-500" />
              <h2 className="font-bold text-gray-900">AI 분석 결과</h2>
            </div>

            <div className="space-y-4">
              <InterestEditSection
                displayInterest={displayInterest}
                selectedJourney={selectedJourney}
                patientId={patientId}
                journeyId={selectedJourneyId}
                onUpdate={fetchPatient}
              />
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
              {!displayInterest && !patient.summary && !patient.followUp && (
                <p className="text-gray-400 text-center py-4">
                  아직 AI 분석 결과가 없습니다
                </p>
              )}
            </div>
          </Card>

          {/* 통합 상담 이력 (전화 + 채팅 + 수동) */}
          <ConsultationHistoryCard
            patientId={patientId}
            patientName={patient?.name}
            onSelectCall={(callId) => {
              setSelectedCallLogId(callId);
              setCallDetailModalOpen(true);
            }}
          />
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

          {/* 상태 변경 히스토리 - 선택된 여정 기준 */}
          {displayStatusHistory && displayStatusHistory.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <History size={18} className="text-purple-500" />
                <h3 className="font-bold text-gray-900">
                  상태 변경 이력
                  {!isActiveJourney && <span className="text-xs text-gray-400 ml-2">(이 여정)</span>}
                </h3>
              </div>
              <div className="space-y-3">
                {displayStatusHistory.slice().reverse().map((entry, index) => {
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

          {/* 상담 이력 */}
          <Card className="p-5">
            <ConsultationHistory
              consultations={consultations}
              loading={consultationsLoading}
            />
          </Card>

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

          {/* 치료 진행 카드 - 치료중/치료완료 상태일 때만 표시 */}
          {(displayStatus === 'treatment' || displayStatus === 'completed') && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-teal-500" />
                  <h3 className="font-bold text-gray-900">치료 진행</h3>
                </div>
                {displayStatus === 'treatment' && (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                    진행중
                  </span>
                )}
                {displayStatus === 'completed' && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    완료
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">치료 시작일</label>
                    <input
                      type="date"
                      value={editData.treatmentStartDate ? editData.treatmentStartDate.split('T')[0] : ''}
                      onChange={(e) => setEditData({ ...editData, treatmentStartDate: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">예상 완료일</label>
                    <input
                      type="date"
                      value={editData.expectedCompletionDate ? editData.expectedCompletionDate.split('T')[0] : ''}
                      onChange={(e) => setEditData({ ...editData, expectedCompletionDate: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 치료 기간 정보 */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">시작일</span>
                      <span className="font-medium text-gray-900">
                        {selectedJourney?.startedAt
                          ? formatDateOnly(selectedJourney.startedAt)
                          : patient.treatmentStartDate
                            ? formatDateOnly(patient.treatmentStartDate)
                            : displayStatusHistory?.find(h => h.to === 'treatment')?.eventDate
                              ? formatDateOnly(displayStatusHistory.find(h => h.to === 'treatment')!.eventDate)
                              : '-'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">예상 완료</span>
                      <span className={`font-medium ${
                        patient.expectedCompletionDate && new Date(patient.expectedCompletionDate) < new Date()
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {patient.expectedCompletionDate
                          ? formatDateOnly(patient.expectedCompletionDate)
                          : '-'
                        }
                      </span>
                    </div>
                    {/* 경과일 / D-day 표시 */}
                    {(() => {
                      const startDate = selectedJourney?.startedAt
                        || patient.treatmentStartDate
                        || displayStatusHistory?.find(h => h.to === 'treatment')?.eventDate;
                      if (!startDate) return null;

                      const start = new Date(startDate);
                      const now = new Date();
                      const elapsedDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

                      // 경고 조건: 예상 완료일이 있으면 그 날짜 기준, 없으면 30일 경과
                      let needsAttention = false;
                      if (patient.expectedCompletionDate) {
                        // 예상 완료일이 지났으면 경고
                        needsAttention = new Date(patient.expectedCompletionDate) < now;
                      } else {
                        // 예상 완료일 없으면 30일 이상 경과 시 경고
                        needsAttention = elapsedDays >= 30;
                      }

                      return (
                        <div className={`flex justify-between items-center pt-2 border-t ${needsAttention ? 'border-orange-200' : ''}`}>
                          <span className="text-sm text-gray-500">경과</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${needsAttention ? 'text-orange-600' : 'text-teal-600'}`}>
                              {elapsedDays}일
                            </span>
                            {needsAttention && (
                              <span className="flex items-center gap-1 text-xs text-orange-500">
                                <AlertTriangle size={12} />
                                확인 필요
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {/* 예상 완료일까지 D-day */}
                    {patient.expectedCompletionDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">완료까지</span>
                        <span className={`font-medium ${getDdayDisplay(patient.expectedCompletionDate).style}`}>
                          {getDdayDisplay(patient.expectedCompletionDate).text}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 치료완료 버튼 - 치료중일 때만 (활성 여정만) */}
                  {displayStatus === 'treatment' && isActiveJourney && (
                    <button
                      onClick={() => handleStatusClick('completed')}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                    >
                      <CheckCircle2 size={18} />
                      치료완료 처리
                    </button>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* 치료금액 카드 */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet size={18} className="text-emerald-500" />
              <h3 className="font-bold text-gray-900">치료금액</h3>
            </div>
            {isEditing ? (
              <div className="space-y-4">
                {/* 원래 금액 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">원래 금액</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editData.estimatedAmount ? editData.estimatedAmount.toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setEditData({ ...editData, estimatedAmount: value ? Math.round(parseInt(value, 10)) : undefined });
                      }}
                      placeholder="0"
                      className="w-full p-2 pr-8 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                  </div>
                </div>
                {/* 실제 결제(할인금액) */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">실제 결제 (할인금액)</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editData.actualAmount ? editData.actualAmount.toLocaleString() : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setEditData({ ...editData, actualAmount: value ? Math.round(parseInt(value, 10)) : undefined });
                      }}
                      placeholder="0"
                      className="w-full p-2 pr-8 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
                  </div>
                </div>
                {/* 할인율 자동 계산 표시 */}
                {editData.estimatedAmount && editData.actualAmount && editData.estimatedAmount > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <span className="text-sm text-gray-600">할인율: </span>
                    <span className="text-lg font-bold text-blue-600">
                      {Math.round((1 - editData.actualAmount / editData.estimatedAmount) * 100)}%
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({(editData.estimatedAmount - editData.actualAmount).toLocaleString()}원 할인)
                    </span>
                  </div>
                )}
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
            ) : (displayEstimatedAmount || displayActualAmount) ? (
              <div className="space-y-3">
                {/* 금액 표시 - 선택된 여정 기준 */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">원래 금액</span>
                    <span className="font-medium text-gray-900">
                      {displayEstimatedAmount ? `${Math.round(displayEstimatedAmount).toLocaleString()}원` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">실제 결제</span>
                    <span className="font-bold text-emerald-600">
                      {displayActualAmount ? `${Math.round(displayActualAmount).toLocaleString()}원` : '-'}
                    </span>
                  </div>
                  {/* 할인율 표시 */}
                  {displayEstimatedAmount && displayActualAmount && displayEstimatedAmount > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-dashed">
                      <span className="text-sm text-gray-500">할인율</span>
                      <span className="font-bold text-blue-600">
                        {Math.round((1 - displayActualAmount / displayEstimatedAmount) * 100)}%
                        <span className="text-xs text-gray-400 font-normal ml-1">
                          ({Math.round(displayEstimatedAmount - displayActualAmount).toLocaleString()}원)
                        </span>
                      </span>
                    </div>
                  )}
                  {displayPaymentStatus && displayPaymentStatus !== 'none' && (
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-gray-500">결제 상태</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        displayPaymentStatus === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {displayPaymentStatus === 'completed' ? '완납' : '부분결제'}
                      </span>
                    </div>
                  )}
                </div>
                {/* 시술 내역 */}
                {displayTreatmentNote && (
                  <div className="text-sm">
                    <span className="text-gray-500">시술: </span>
                    <span className="text-gray-700">{displayTreatmentNote}</span>
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

      {/* 상담 결과 입력 모달 */}
      <ConsultationInputModal
        isOpen={consultationModalOpen}
        onClose={() => {
          setConsultationModalOpen(false);
          setExistingConsultation(undefined);  // 모달 닫을 때 초기화
        }}
        onSubmit={handleConsultationSubmit}
        type={consultationType}
        patientName={patient.name}
        patientInterest={patient.interest}
        consultantName={user?.name}
        existingData={existingConsultation}
      />

      {/* 🆕 새 여정 시작 모달 */}
      {isNewJourneyModalOpen && (
        <NewJourneyModal
          onClose={() => setIsNewJourneyModalOpen(false)}
          patientName={patient.name}
          patientId={patientId}
          onSuccess={fetchPatient}
          changedBy={user?.name}
        />
      )}

      {/* 🆕 예정일 변경 모달 */}
      <ScheduleChangeModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onConfirm={handleScheduleChange}
        currentDate={displayNextActionDate as string | undefined}
        patientName={patient.name}
      />
    </div>
  );
}

// ============================================
// 🆕 관심 분야 / 치료 유형 편집 섹션
// ============================================
interface InterestEditSectionProps {
  displayInterest: string | undefined;
  selectedJourney: Journey | undefined;
  patientId: string;
  journeyId: string;
  onUpdate: () => void;
}

function InterestEditSection({ displayInterest, selectedJourney, patientId, journeyId, onUpdate }: InterestEditSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [customType, setCustomType] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 편집 시작 시 현재 값으로 초기화
  const handleStartEdit = () => {
    const currentValue = displayInterest || '';
    // TREATMENT_TYPES에 있는 값인지 확인
    if ((TREATMENT_TYPES as readonly string[]).includes(currentValue)) {
      setSelectedType(currentValue);
      setCustomType('');
    } else if (currentValue) {
      setSelectedType('기타');
      setCustomType(currentValue);
    } else {
      setSelectedType('');
      setCustomType('');
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    const newValue = selectedType === '기타' ? customType : selectedType;
    if (!newValue) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      if (selectedJourney) {
        // 여정의 treatmentType 업데이트
        const response = await fetch(`/api/v2/patients/${patientId}/journeys/${journeyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ treatmentType: newValue }),
        });
        if (!response.ok) throw new Error('여정 업데이트 실패');
      } else {
        // 환자의 interest 업데이트
        const response = await fetch(`/api/v2/patients/${patientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interest: newValue }),
        });
        if (!response.ok) throw new Error('환자 업데이트 실패');
      }
      await onUpdate();
      setIsEditing(false);
    } catch (err) {
      console.error('치료 유형 업데이트 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedType('');
    setCustomType('');
  };

  if (isEditing) {
    return (
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-sm text-gray-500 mb-2">관심 분야 / 치료 유형</p>
        <div className="space-y-3">
          {/* 치료 유형 선택 그리드 */}
          <div className="grid grid-cols-3 gap-2">
            {TREATMENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                disabled={isSaving}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                } disabled:opacity-50`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* 기타 직접 입력 */}
          {selectedType === '기타' && (
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="치료 유형 직접 입력"
              disabled={isSaving}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (!selectedType || (selectedType === '기타' && !customType))}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <p className="text-sm text-gray-500 mb-1">관심 분야 / 치료 유형</p>
      <div className="flex items-center gap-2">
        {displayInterest ? (
          <p className="text-blue-600 font-medium">{displayInterest}</p>
        ) : (
          <p className="text-gray-400">미설정</p>
        )}
        <button
          onClick={handleStartEdit}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="치료 유형 수정"
        >
          <Edit2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ============================================
// 🆕 새 여정 시작 모달 컴포넌트
// ============================================
interface NewJourneyModalProps {
  onClose: () => void;
  patientName: string;
  patientId: string;
  onSuccess: () => void;
  changedBy?: string;
}

function NewJourneyModal({ onClose, patientName, patientId, onSuccess, changedBy }: NewJourneyModalProps) {
  const [treatmentType, setTreatmentType] = useState('');
  const [customType, setCustomType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const type = treatmentType === '기타' ? customType : treatmentType;
    if (!type) {
      setError('치료 유형을 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v2/patients/${patientId}/journeys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatmentType: type,
          changedBy: changedBy || '시스템',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '여정 생성에 실패했습니다');
      }

      // 성공 시 데이터 새로고침 후 모달 닫기
      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '여정 생성에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">새 여정 시작</h2>
          <p className="text-sm text-gray-500 mt-1">
            {patientName} 님의 새로운 치료 여정을 시작합니다
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* 안내 메시지 */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <AlertCircle size={18} className="text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">구신환 등록</p>
              <p className="text-blue-600 mt-1">
                기존 치료가 완료된 환자가 새로운 치료를 시작할 때 사용합니다.
                이전 여정 기록은 그대로 유지됩니다.
              </p>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* 치료 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              치료 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TREATMENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setTreatmentType(type);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    treatmentType === type
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {type}
                </button>
              ))}
            </div>

            {treatmentType === '기타' && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="치료 유형 직접 입력"
                disabled={isSubmitting}
                className="w-full mt-2 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            )}
          </div>

          {/* 시작 상태 안내 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">시작 단계:</span> 전화상담
            </p>
            <p className="text-xs text-gray-500 mt-1">
              새 여정은 &apos;전화상담&apos; 단계부터 시작됩니다
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 min-w-[100px]"
          >
            {isSubmitting ? '생성 중...' : '여정 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 🆕 예정일 변경 모달 컴포넌트
// ============================================
interface ScheduleChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { newDate: string; reason?: CallbackReason; note?: string }) => void;
  currentDate?: string;
  patientName: string;
}

function ScheduleChangeModal({ isOpen, onClose, onConfirm, currentDate, patientName }: ScheduleChangeModalProps) {
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState<CallbackReason | ''>('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모달이 열릴 때 기본값 설정
  useEffect(() => {
    if (isOpen) {
      // 다음 영업일로 기본 날짜 설정
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNewDate(tomorrow.toISOString().split('T')[0]);
      setReason('');
      setNote('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!newDate) return;

    setIsSubmitting(true);
    try {
      await onConfirm({
        newDate,
        reason: reason || undefined,
        note: note || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const reasonOptions: { value: CallbackReason; label: string; color: string }[] = [
    { value: 'no_answer', label: '미연결', color: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'postponed', label: '보류', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    { value: 'considering', label: '검토중', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">예정일 변경</h2>
          <p className="text-sm text-gray-500 mt-1">{patientName} 님</p>
        </div>

        <div className="p-6 space-y-5">
          {/* 현재 예정일 표시 */}
          {currentDate && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500">현재 예정일:</span>
              <span className="font-medium text-gray-900">
                {new Date(currentDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          )}

          {/* 사유 선택 */}
          {currentDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                변경 사유 <span className="text-gray-400 text-xs">(선택)</span>
              </label>
              <div className="flex gap-2">
                {reasonOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setReason(reason === opt.value ? '' : opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      reason === opt.value
                        ? opt.color + ' border-current'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모 <span className="text-gray-400 text-xs">(선택)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 다음주 수요일에 전화 요청"
              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          {/* 새 예정일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 예정일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {/* 빠른 선택 버튼 */}
            <div className="flex gap-2 mt-2">
              {[
                { label: '내일', days: 1 },
                { label: '3일 후', days: 3 },
                { label: '1주 후', days: 7 },
                { label: '2주 후', days: 14 },
              ].map((opt) => {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + opt.days);
                const dateStr = targetDate.toISOString().split('T')[0];
                return (
                  <button
                    key={opt.label}
                    onClick={() => setNewDate(dateStr)}
                    className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                      newDate === dateStr
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !newDate}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 min-w-[80px]"
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
