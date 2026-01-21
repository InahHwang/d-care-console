// src/app/v2/call-logs/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  Sparkles,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
  CheckCircle2,
  Play,
  Pause,
  Square,
  X,
  UserPlus,
  PhoneCall,
  Bell,
  Eye,
  Flame,
  Thermometer,
  Snowflake,
  Plus,
  Pencil,
  Unlink,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Pagination } from '@/components/v2/ui/Pagination';
import { Temperature } from '@/types/v2';

interface CallLog {
  id: string;
  callTime: string;
  callType: 'inbound' | 'outbound';
  duration: number;
  phone: string;
  calledNumber?: string;  // ★ 착신번호 (031 or 070)
  patientId: string | null;
  patientName: string;
  classification: string;
  interest: string;
  summary: string;
  temperature: Temperature;
  status: 'pending' | 'analyzing' | 'completed';
  confidence?: number;
  suggestedCallback?: string;
  isRegistered?: boolean;
  followUp?: string;
}

// 분류 옵션
const CLASSIFICATION_OPTIONS = [
  { value: '환자', label: '환자' },
  { value: '거래처', label: '거래처' },
  { value: '스팸', label: '스팸' },
  { value: '기타', label: '기타' },
];

// 관심도 옵션
const TEMPERATURE_OPTIONS = [
  { value: 'hot', label: '높음 (Hot)', icon: Flame, color: 'text-red-500' },
  { value: 'warm', label: '중간 (Warm)', icon: Thermometer, color: 'text-amber-500' },
  { value: 'cold', label: '낮음 (Cold)', icon: Snowflake, color: 'text-blue-400' },
];

// 후속조치 옵션
const FOLLOWUP_OPTIONS = [
  { value: '콜백필요', label: '콜백 필요' },
  { value: '예약확정', label: '예약 확정' },
  { value: '종결', label: '종결' },
];

interface CallLogStats {
  all: number;
  patient: number;      // 환자
  georaecheo: number;   // 거래처
  spam: number;         // 스팸
  etc: number;          // 기타
  missed: number;       // 부재중 (통화시간 0초)
}

interface CallLogResponse {
  callLogs: CallLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  stats: CallLogStats;
}

type ClassificationFilter = 'all' | 'patient' | 'georaecheo' | 'spam' | 'etc';

const filterTabs: Array<{ id: ClassificationFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'patient', label: '환자' },
  { id: 'georaecheo', label: '거래처' },
  { id: 'spam', label: '스팸' },
  { id: 'etc', label: '기타' },
];

function getClassificationStyle(classification: string) {
  switch (classification) {
    case '환자': return 'bg-blue-100 text-blue-700';
    case '거래처': return 'bg-cyan-100 text-cyan-700';
    case '스팸': return 'bg-red-100 text-red-600';
    case '기타': return 'bg-slate-100 text-slate-600';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function getFilterStyle(filterId: ClassificationFilter, isActive: boolean) {
  if (!isActive) return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  return 'bg-blue-500 text-white';
}

function TemperatureDisplay({ temperature }: { temperature: Temperature | string | null }) {
  if (!temperature || temperature === 'unknown') return <span className="text-gray-400">-</span>;

  const config: Record<string, { icon: typeof Flame; color: string; label: string }> = {
    hot: { icon: Flame, color: 'text-red-500', label: '높음' },
    warm: { icon: Thermometer, color: 'text-amber-500', label: '중간' },
    cold: { icon: Snowflake, color: 'text-blue-400', label: '낮음' },
  };

  const { icon: Icon, color, label } = config[temperature] || { icon: Thermometer, color: 'text-gray-400', label: '-' };
  return (
    <div className="flex items-center gap-1">
      <Icon size={14} className={color} />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}

// 환자 등록 모달
interface RegisterPatientModalProps {
  call: CallLog;
  onClose: () => void;
  onSuccess: (patientId: string, patientName: string) => void;
}

interface CategoryItem {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

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

function RegisterPatientModal({ call, onClose, onSuccess }: RegisterPatientModalProps) {
  const [name, setName] = useState(call.patientName || '');
  const [phone] = useState(call.phone);
  const [consultationType, setConsultationType] = useState('');
  const [interest, setInterest] = useState(call.interest || '');
  const [source, setSource] = useState('');
  const [age, setAge] = useState<string>('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 카테고리 데이터
  const [consultationTypes, setConsultationTypes] = useState<CategoryItem[]>([]);
  const [referralSources, setReferralSources] = useState<CategoryItem[]>([]);
  const [interestedServices, setInterestedServices] = useState<CategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // 카테고리 데이터 로드
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/settings/categories');
        const data = await response.json();
        if (data.success) {
          // 활성화된 항목만 필터링
          const activeTypes = (data.categories.consultationTypes || []).filter((item: CategoryItem) => item.isActive);
          const activeSources = (data.categories.referralSources || []).filter((item: CategoryItem) => item.isActive);
          const activeServices = (data.categories.interestedServices || []).filter((item: CategoryItem) => item.isActive);
          setConsultationTypes(activeTypes);
          setReferralSources(activeSources);
          setInterestedServices(activeServices);
          // 기본값 설정
          if (activeTypes.length > 0 && !consultationType) {
            setConsultationType(activeTypes[0].label);
          }
          // 유입경로는 기본값을 설정하지 않음 (알수없음이 기본)
        }
      } catch (err) {
        console.error('카테고리 로드 실패:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('환자 이름을 입력해주세요');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. 환자 등록 시도
      const patientData: Record<string, unknown> = {
        name: name.trim(),
        phone,
        consultationType,
        interest,
        source,
      };

      // 나이 추가 (입력된 경우)
      if (age) {
        patientData.age = parseInt(age, 10);
      }

      // 지역 추가 (시/도가 선택된 경우)
      if (province) {
        patientData.region = {
          province,
          city: city || undefined,
        };
      }

      const patientRes = await fetch('/api/v2/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });

      let patientId: string;

      if (patientRes.status === 409) {
        // 이미 등록된 전화번호 → 기존 환자와 연결
        const data = await patientRes.json();
        patientId = data.patientId;
      } else if (!patientRes.ok) {
        const data = await patientRes.json();
        setError(data.error || '등록 중 오류가 발생했습니다');
        return;
      } else {
        const data = await patientRes.json();
        patientId = data.patientId;
      }

      // 2. 통화기록에 patientId 연결 + 분류를 '환자'로 변경
      await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: call.id,
          patientId,
          classification: '환자',
          patientName: name.trim(),
          interest: interest || undefined,
        }),
      });

      onSuccess(patientId, name.trim());
      onClose();
    } catch (err) {
      setError('등록 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">환자 등록</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 전화번호 (읽기전용) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
            <input
              type="text"
              value={phone}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          {/* 환자 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              환자 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="환자 이름 입력"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 상담타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상담타입</label>
            {loadingCategories ? (
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                로딩 중...
              </div>
            ) : (
              <select
                value={consultationType}
                onChange={(e) => setConsultationType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {consultationTypes.map((item) => (
                  <option key={item.id} value={item.label}>{item.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* 관심 시술 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">관심 시술</label>
            {loadingCategories ? (
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                로딩 중...
              </div>
            ) : interestedServices.length > 0 ? (
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {interestedServices.map((item) => (
                  <option key={item.id} value={item.label}>{item.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="예: 임플란트, 교정"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* 유입경로 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">유입경로</label>
            {loadingCategories ? (
              <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                로딩 중...
              </div>
            ) : (
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">알수없음</option>
                {referralSources.map((item) => (
                  <option key={item.id} value={item.label}>{item.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* 나이 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">나이</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="나이 입력"
              min="1"
              max="120"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 주소 (시/도, 시군구) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setCity(''); // 시/도 변경 시 시군구 초기화
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">시/도 선택</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!province}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">시/군/구 선택</option>
                {province && REGION_DATA[province]?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* 버튼 */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                등록 중...
              </>
            ) : (
              <>
                <UserPlus size={16} />
                환자 등록
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// AI 분석 수정 모달
interface EditAnalysisModalProps {
  call: CallLog;
  onClose: () => void;
  onSave: (updatedCall: CallLog) => void;
}

function EditAnalysisModal({ call, onClose, onSave }: EditAnalysisModalProps) {
  const [classification, setClassification] = useState(call.classification);
  const [patientName, setPatientName] = useState(call.patientName || '');
  const [interest, setInterest] = useState(call.interest || '');
  const [temperature, setTemperature] = useState<Temperature>(call.temperature || 'warm');
  const [summary, setSummary] = useState(call.summary || '');
  const [followUp, setFollowUp] = useState(call.followUp || '콜백필요');
  const [saving, setSaving] = useState(false);

  // 분류별 표시할 필드 결정
  const isPatientType = classification === '환자';
  const isVendor = classification === '거래처';
  const isSpam = classification === '스팸';
  const isEtc = classification === '기타';

  const handleSave = async () => {
    setSaving(true);
    try {
      const requestBody = {
        callLogId: call.id,
        classification,
        patientName: patientName || undefined,  // 모든 분류에서 이름 저장 가능
        interest: isPatientType ? interest : undefined,
        temperature: isPatientType ? temperature : undefined,
        summary,
        followUp: isPatientType ? followUp : '종결',
      };

      console.log('[EditAnalysisModal] 요청 body:', requestBody);

      const response = await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('[EditAnalysisModal] 응답:', data);

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to update');
      }

      onSave({
        ...call,
        classification,
        patientName,
        interest,
        temperature,
        summary,
        followUp,
      });
      onClose();
    } catch (error) {
      console.error('Error updating call log:', error);
      alert(`수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">분류 변경</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-4 space-y-4">
          {/* 분류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">분류</label>
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setClassification(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    classification === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 스팸/거래처/기타 안내 메시지 */}
          {(isSpam || isVendor || isEtc) && (
            <div className={`p-3 rounded-lg text-sm ${
              isSpam ? 'bg-red-50 text-red-700' :
              isVendor ? 'bg-cyan-50 text-cyan-700' :
              'bg-gray-50 text-gray-600'
            }`}>
              {isSpam && '스팸으로 분류됩니다. 환자 목록에서 제외됩니다.'}
              {isVendor && '거래처로 분류됩니다. 환자 목록에서 제외됩니다.'}
              {isEtc && '기타로 분류됩니다.'}
            </div>
          )}

          {/* 거래처명 (거래처인 경우) */}
          {isVendor && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">거래처명</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="거래처 이름 입력"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 환자 이름 (환자인 경우) */}
          {isPatientType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">환자 이름</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="환자 이름 입력"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 스팸/기타 이름 (스팸 또는 기타인 경우) */}
          {(isSpam || isEtc) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isSpam ? '스팸 발신자' : '발신자 정보'}
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder={isSpam ? '예: 대출권유, 보험영업' : '예: 마케팅업체, 배달'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 관심 시술 (환자인 경우) */}
          {isPatientType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">관심 시술</label>
              <input
                type="text"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                placeholder="예: 임플란트, 교정, 충치치료"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 관심도 (환자인 경우) */}
          {isPatientType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">관심도</label>
              <div className="flex gap-2">
                {TEMPERATURE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTemperature(opt.value as Temperature)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        temperature === opt.value
                          ? 'bg-blue-50 border-2 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} className={opt.color} />
                      {opt.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 후속 조치 (환자인 경우) */}
          {isPatientType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">후속 조치</label>
              <div className="flex gap-2">
                {FOLLOWUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFollowUp(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      followUp === opt.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 메모/요약 (항상 표시) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isSpam || isVendor || isEtc ? '메모' : '요약'}
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={isSpam ? '스팸 관련 메모' : isVendor ? '거래처 관련 메모' : '통화 내용 요약'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!seconds || seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatCallTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const dateStr = isToday ? '오늘' : isYesterday ? '어제' : `${date.getMonth() + 1}/${date.getDate()}`;

  return { dateStr, time };
}

// 날짜를 YYYY-MM-DD 형식으로 변환
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 착신 시각 포맷 (한 줄로)
function formatCallTimeOneLine(dateString: string) {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

// ★ 착신번호 간략 표시 (031-xxx → 031, 070-xxx → 070)
function formatCalledNumber(calledNumber?: string) {
  if (!calledNumber) return '-';
  const normalized = calledNumber.replace(/\D/g, '');
  if (normalized.startsWith('031')) return '031';
  if (normalized.startsWith('070')) return '070';
  if (normalized.startsWith('02')) return '02';
  return normalized.slice(0, 3);
}

function CallLogsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialFilter = (searchParams.get('filter') as ClassificationFilter) || 'all';

  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ClassificationFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1 });
  const [stats, setStats] = useState<CallLogStats | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [editingCall, setEditingCall] = useState<CallLog | null>(null);
  const [registeringCall, setRegisteringCall] = useState<CallLog | null>(null);

  // 날짜 필터 상태 (기본값: 오늘)
  const [selectedDate, setSelectedDate] = useState<string>(formatDateToString(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

  // 수신/발신 필터 상태
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  // 녹취 재생 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '20');

      // 날짜 필터 적용
      if (dateRange) {
        params.set('startDate', dateRange.start);
        params.set('endDate', dateRange.end);
      } else {
        params.set('date', selectedDate);
      }

      if (filter === 'patient') {
        params.set('classification', '환자');
      } else if (filter === 'georaecheo') {
        params.set('classification', '거래처');
      } else if (filter === 'spam') {
        params.set('classification', '스팸');
      } else if (filter === 'etc') {
        params.set('classification', '기타');
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      // 수신/발신 필터
      if (directionFilter !== 'all') {
        params.set('direction', directionFilter);
      }

      const response = await fetch(`/api/v2/call-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');

      const data: CallLogResponse = await response.json();
      setCallLogs(data.callLogs);
      setPagination({
        totalCount: data.pagination.totalCount,
        totalPages: data.pagination.totalPages,
      });
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching call logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter, searchQuery, selectedDate, dateRange, directionFilter]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('filter', filter);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const newUrl = params.toString() ? `?${params.toString()}` : '/v2/call-logs';
    window.history.replaceState(null, '', newUrl);
  }, [filter, currentPage]);

  const handleFilterChange = (newFilter: ClassificationFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleDirectionChange = (direction: 'all' | 'inbound' | 'outbound') => {
    setDirectionFilter(direction);
    setCurrentPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // 날짜 네비게이션
  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    setSelectedDate(formatDateToString(current));
    setDateRange(null);
    setCurrentPage(1);
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + 1);
    if (current <= today) {
      setSelectedDate(formatDateToString(current));
      setDateRange(null);
      setCurrentPage(1);
    }
  };

  const handleToday = () => {
    setSelectedDate(formatDateToString(new Date()));
    setDateRange(null);
    setCurrentPage(1);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setDateRange(null);
    setCurrentPage(1);
  };

  const isToday = selectedDate === formatDateToString(new Date());

  // 날짜 표시 포맷
  const getDisplayDate = () => {
    if (dateRange) {
      return `${dateRange.start} ~ ${dateRange.end}`;
    }
    const date = new Date(selectedDate);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (selectedDate === formatDateToString(today)) {
      return '오늘';
    } else if (selectedDate === formatDateToString(yesterday)) {
      return '어제';
    } else {
      return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
  };

  const handleCallClick = (call: CallLog) => {
    setSelectedCall(call);
  };

  const handleClosePanel = () => {
    setSelectedCall(null);
  };

  const handleViewPatient = (patientId: string) => {
    router.push(`/v2/patients/${patientId}`);
  };

  // 녹취 재생 핸들러
  const handlePlayRecording = async () => {
    console.log('[녹취재생] 버튼 클릭됨, selectedCall:', selectedCall?.id);
    if (!selectedCall) return;

    // 이미 재생 중이면 일시정지
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // 이미 로드된 오디오가 있으면 재생
    if (audioRef.current && !isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    // 새로 로드
    setAudioLoading(true);
    setAudioError(null);

    try {
      const recordingUrl = `/api/v2/call-logs/${selectedCall.id}/recording`;
      const response = await fetch(recordingUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('녹취 파일을 찾을 수 없습니다');
        }
        throw new Error('녹취 파일 로드 실패');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const audio = new Audio(blobUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setAudioError('녹취 파일 재생 실패');
        setIsPlaying(false);
      };

      await audio.play();
      audioRef.current = audio;
      setIsPlaying(true);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : '녹취 파일 로드 실패');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleStopRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // selectedCall 변경 시 오디오 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setAudioLoading(false);
      setAudioError(null);
    };
  }, [selectedCall?.id]);

  const handleRegisterPatient = (call: CallLog) => {
    setRegisteringCall(call);
  };

  const handleRegisterSuccess = (patientId: string, patientName: string) => {
    // 목록에서 업데이트 (등록됨 상태로 변경 + 환자 이름 추가 + 분류를 '환자'로 변경)
    setCallLogs((prev) =>
      prev.map((log) =>
        log.id === registeringCall?.id
          ? { ...log, patientId, patientName, callerName: patientName, classification: '환자' }
          : log
      )
    );
    // 선택된 항목도 업데이트
    if (selectedCall && selectedCall.id === registeringCall?.id) {
      setSelectedCall({ ...selectedCall, patientId, patientName, callerName: patientName, classification: '환자' } as CallLog);
    }
    // 모달 닫기
    setRegisteringCall(null);
  };

  const handleMakeCall = (phone: string) => {
    window.dispatchEvent(new CustomEvent('cti-call', { detail: { phone } }));
  };

  const handleAddPatient = () => {
    router.push('/v2/patients/new');
  };

  const handleEditAnalysis = (call: CallLog) => {
    setEditingCall(call);
  };

  const handleUnlinkPatient = async (call: CallLog) => {
    if (!confirm('이 통화기록에서 환자 연결을 해제하시겠습니까?\n(같은 환자와 연결된 모든 통화기록에서 연결이 해제됩니다)')) {
      return;
    }

    try {
      const response = await fetch('/api/v2/call-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callLogId: call.id,
          patientId: null, // null로 설정하여 연결 해제
        }),
      });

      if (!response.ok) throw new Error('Failed to unlink');

      // 같은 patientId를 가진 모든 통화기록 업데이트
      const unlinkPatientId = call.patientId;
      setCallLogs((prev) =>
        prev.map((log) =>
          log.patientId === unlinkPatientId ? { ...log, patientId: null } : log
        )
      );

      // 선택된 항목도 업데이트
      if (selectedCall?.id === call.id) {
        setSelectedCall({ ...selectedCall, patientId: null });
      }
    } catch (error) {
      console.error('Error unlinking patient:', error);
      alert('연결 해제 중 오류가 발생했습니다.');
    }
  };

  const handleSaveEdit = (updatedCall: CallLog) => {
    // 스팸/거래처로 변경되면 patientId를 null로 설정
    const NON_PATIENT_CLASSIFICATIONS = ['스팸', '거래처'];
    const isNowNonPatient = NON_PATIENT_CLASSIFICATIONS.includes(updatedCall.classification);

    const finalCall = isNowNonPatient
      ? { ...updatedCall, patientId: null }
      : updatedCall;

    // 스팸/거래처로 변경되면서 기존에 patientId가 있었다면, 같은 patientId를 가진 모든 통화기록도 업데이트
    const originalPatientId = editingCall?.patientId;
    if (isNowNonPatient && originalPatientId) {
      setCallLogs((prev) =>
        prev.map((log) => {
          if (log.id === finalCall.id) return finalCall;
          if (log.patientId === originalPatientId) return { ...log, patientId: null };
          return log;
        })
      );
    } else {
      // 목록에서 업데이트
      setCallLogs((prev) =>
        prev.map((log) => (log.id === finalCall.id ? finalCall : log))
      );
    }

    // 선택된 항목도 업데이트
    if (selectedCall?.id === finalCall.id) {
      setSelectedCall(finalCall);
    }
  };

  const getStatCount = (filterId: ClassificationFilter) => {
    if (!stats) return 0;
    switch (filterId) {
      case 'all': return stats.all;
      case 'patient': return stats.patient;
      case 'georaecheo': return stats.georaecheo;
      case 'spam': return stats.spam;
      case 'etc': return stats.etc;
      default: return 0;
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-y-auto">
      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 헤더 */}
        <div className="bg-white border-b px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">통화 기록</h2>
                <p className="text-sm text-gray-500 mt-1">
                  AI가 자동으로 분석하고 환자를 등록합니다
                </p>
              </div>

              {/* 날짜 네비게이션 */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={handlePrevDay}
                  className="p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700"
                  >
                    <Calendar size={16} />
                    <span>{getDisplayDate()}</span>
                  </button>

                  {showDatePicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-4 z-10 min-w-[280px]">
                      {/* 단일 날짜 선택 */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">날짜 선택</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            handleDateChange(e);
                            setShowDatePicker(false);
                          }}
                          max={formatDateToString(new Date())}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* 기간 선택 */}
                      <div className="border-t pt-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">기간 선택</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateRange?.start || ''}
                            onChange={(e) => {
                              setDateRange(prev => ({
                                start: e.target.value,
                                end: prev?.end || formatDateToString(new Date())
                              }));
                            }}
                            max={formatDateToString(new Date())}
                            className="flex-1 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-400">~</span>
                          <input
                            type="date"
                            value={dateRange?.end || ''}
                            onChange={(e) => {
                              setDateRange(prev => ({
                                start: prev?.start || formatDateToString(new Date()),
                                end: e.target.value
                              }));
                            }}
                            max={formatDateToString(new Date())}
                            className="flex-1 px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {dateRange && (
                          <button
                            onClick={() => {
                              setCurrentPage(1);
                              setShowDatePicker(false);
                            }}
                            className="w-full mt-2 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                          >
                            기간 적용
                          </button>
                        )}
                      </div>

                      {/* 빠른 선택 버튼 */}
                      <div className="border-t pt-3 mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            handleToday();
                            setShowDatePicker(false);
                          }}
                          className="flex-1 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          오늘
                        </button>
                        <button
                          onClick={() => {
                            const today = new Date();
                            const weekAgo = new Date(today);
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            setDateRange({
                              start: formatDateToString(weekAgo),
                              end: formatDateToString(today)
                            });
                            setCurrentPage(1);
                            setShowDatePicker(false);
                          }}
                          className="flex-1 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          최근 7일
                        </button>
                        <button
                          onClick={() => {
                            const today = new Date();
                            const monthAgo = new Date(today);
                            monthAgo.setDate(monthAgo.getDate() - 30);
                            setDateRange({
                              start: formatDateToString(monthAgo),
                              end: formatDateToString(today)
                            });
                            setCurrentPage(1);
                            setShowDatePicker(false);
                          }}
                          className="flex-1 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          최근 30일
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleNextDay}
                  disabled={isToday}
                  className={`p-1.5 rounded-lg ${isToday ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  <ChevronRight size={20} />
                </button>

                {!isToday && (
                  <button
                    onClick={handleToday}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                  >
                    오늘
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                <Sparkles size={16} />
                <span>AI 분석 활성화</span>
              </div>
              <button
                onClick={handleAddPatient}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
              >
                <Plus size={18} />
                환자 등록
              </button>
            </div>
          </div>
        </div>

        {/* 필터 & 검색 */}
        <div className="bg-white border-b px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleFilterChange(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${getFilterStyle(tab.id, filter === tab.id)}`}
                >
                  {tab.label}
                  <span className={`ml-1.5 ${filter === tab.id ? 'text-blue-100' : 'text-gray-400'}`}>
                    {getStatCount(tab.id)}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* 수신/발신 필터 */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => handleDirectionChange('all')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    directionFilter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => handleDirectionChange('inbound')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center gap-1 ${
                    directionFilter === 'inbound'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <PhoneIncoming size={14} />
                  수신
                </button>
                <button
                  onClick={() => handleDirectionChange('outbound')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center gap-1 ${
                    directionFilter === 'outbound'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <PhoneOutgoing size={14} />
                  발신
                </button>
              </div>

              {/* 검색 */}
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="전화번호, 이름 검색"
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 통화 목록 */}
        <div className="flex-1 overflow-auto p-6 min-h-0">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b text-sm font-medium text-gray-500">
              <div className="col-span-1">유형</div>
              <div className="col-span-1">착신</div>
              <div className="col-span-2">전화번호</div>
              <div className="col-span-2">환자</div>
              <div className="col-span-1">시간</div>
              <div className="col-span-1">통화시간</div>
              <div className="col-span-1">관심 진료</div>
              <div className="col-span-2">AI 요약</div>
              <div className="col-span-1">상태</div>
            </div>

            {/* 테이블 바디 */}
            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-5 py-4 animate-pulse">
                    <div className="col-span-1"><div className="w-8 h-8 bg-gray-200 rounded-full" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-10" /></div>
                    <div className="col-span-2"><div className="h-4 bg-gray-200 rounded w-24" /></div>
                    <div className="col-span-2"><div className="h-4 bg-gray-200 rounded w-20" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-16" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-10" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-12" /></div>
                    <div className="col-span-2"><div className="h-4 bg-gray-200 rounded w-full" /></div>
                    <div className="col-span-1"><div className="h-4 bg-gray-200 rounded w-12" /></div>
                  </div>
                ))}
              </div>
            ) : callLogs.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                통화 기록이 없습니다
              </div>
            ) : (
              <div className="divide-y">
                {callLogs.map((call) => {
                  const isSelected = selectedCall?.id === call.id;

                  return (
                    <div
                      key={call.id}
                      onClick={() => handleCallClick(call)}
                      className={`grid grid-cols-12 gap-2 px-5 py-4 hover:bg-gray-50 cursor-pointer items-center transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      {/* 유형 */}
                      <div className="col-span-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          call.callType === 'outbound' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {call.callType === 'outbound' ? (
                            <PhoneOutgoing size={16} className="text-blue-600" />
                          ) : (
                            <PhoneIncoming size={16} className="text-green-600" />
                          )}
                        </div>
                      </div>

                      {/* 착신번호 */}
                      <div className="col-span-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          call.calledNumber?.includes('070')
                            ? 'bg-purple-100 text-purple-700'
                            : call.calledNumber?.includes('031')
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {formatCalledNumber(call.calledNumber)}
                        </span>
                      </div>

                      {/* 전화번호 */}
                      <div className="col-span-2">
                        <div className="font-medium text-gray-900">{call.phone}</div>
                      </div>

                      {/* 환자 (이름 + 분류 태그 + 부재중 표시) */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          {/* 부재중 표시 (빨간 점) */}
                          {call.duration === 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="부재중" />
                          )}
                          <span className="text-gray-900 font-medium truncate">
                            {call.patientName || '-'}
                          </span>
                          {call.classification && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getClassificationStyle(call.classification)}`}>
                              {call.classification}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 시간 */}
                      <div className="col-span-1 text-sm text-gray-600 whitespace-nowrap">
                        {formatCallTimeOneLine(call.callTime)}
                      </div>

                      {/* 통화시간 */}
                      <div className="col-span-1 text-sm text-gray-600">
                        {formatDuration(call.duration)}
                      </div>

                      {/* 관심 진료 */}
                      <div className="col-span-1 text-sm text-gray-600 truncate">
                        {call.interest || '-'}
                      </div>

                      {/* AI 요약 */}
                      <div className="col-span-2">
                        {call.status === 'analyzing' ? (
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                        ) : (
                          <p className="text-sm text-gray-600 truncate">{call.summary || '-'}</p>
                        )}
                      </div>

                      {/* 등록 상태 */}
                      <div className="col-span-1">
                        {call.patientId ? (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 size={16} />
                            <span className="text-xs">등록됨</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRegisterPatient(call);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                          >
                            <UserPlus size={12} />
                            등록
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-sm text-gray-500">{pagination.totalCount}건</p>
            {pagination.totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </div>
      </div>

      {/* 우측 상세 패널 - 화면에 고정 */}
      {selectedCall && (
        <div className="w-96 bg-white border-l flex flex-col overflow-hidden flex-shrink-0 sticky top-0 self-start max-h-screen">
          {/* 패널 헤더 */}
          <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
            <h3 className="font-bold text-gray-900">통화 상세</h3>
            <button
              onClick={handleClosePanel}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* 패널 내용 */}
          <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
            {/* 기본 정보 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedCall.callType === 'outbound' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  {selectedCall.callType === 'outbound' ? (
                    <PhoneOutgoing size={20} className="text-blue-600" />
                  ) : (
                    <PhoneIncoming size={20} className="text-green-600" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-lg text-gray-900">{selectedCall.phone}</div>
                  <div className="text-sm text-gray-500">
                    {formatCallTime(selectedCall.callTime).dateStr} {formatCallTime(selectedCall.callTime).time} · {formatDuration(selectedCall.duration)}
                  </div>
                </div>
              </div>

              {selectedCall.duration > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        console.log('[녹취] 버튼 직접 클릭');
                        handlePlayRecording();
                      }}
                      disabled={audioLoading}
                      className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors ${
                        audioLoading
                          ? 'bg-gray-400 text-white cursor-wait'
                          : isPlaying
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {audioLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          로딩중...
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause size={16} />
                          일시정지
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          녹취 재생
                        </>
                      )}
                    </button>
                    {isPlaying && (
                      <button
                        onClick={handleStopRecording}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <Square size={14} />
                      </button>
                    )}
                  </div>
                  {audioError && (
                    <div className="p-2 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                      <AlertCircle size={16} />
                      {audioError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI 분석 결과 */}
            {selectedCall.status === 'completed' && (
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-purple-700 font-medium mb-3">
                  <Sparkles size={18} />
                  AI 분석 결과
                  {selectedCall.confidence && (
                    <span className="ml-auto text-xs font-normal text-purple-500">
                      신뢰도 {selectedCall.confidence}%
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">분류</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClassificationStyle(selectedCall.classification)}`}>
                      {selectedCall.classification}
                    </span>
                  </div>

                  {selectedCall.patientName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">이름</span>
                      <span className="font-medium text-gray-900">{selectedCall.patientName}</span>
                    </div>
                  )}

                  {selectedCall.interest && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">관심 시술</span>
                      <span className="font-medium text-gray-900">{selectedCall.interest}</span>
                    </div>
                  )}

                  {selectedCall.temperature && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">관심도</span>
                      <TemperatureDisplay temperature={selectedCall.temperature} />
                    </div>
                  )}

                  {selectedCall.suggestedCallback && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">추천 콜백</span>
                      <span className="font-medium text-amber-600">{selectedCall.suggestedCallback}</span>
                    </div>
                  )}
                </div>

                {selectedCall.summary && (
                  <div className="mt-3 pt-3 border-t border-purple-100">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{selectedCall.summary}</p>
                  </div>
                )}
              </div>
            )}

            {selectedCall.status === 'analyzing' && (
              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-3 text-purple-700">
                  <Loader2 size={20} className="animate-spin" />
                  <div>
                    <div className="font-medium">AI 분석 중...</div>
                    <div className="text-sm text-purple-500">약 20초 소요</div>
                  </div>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="space-y-2">
              {selectedCall.patientId ? (
                <>
                  <button
                    onClick={() => handleViewPatient(selectedCall.patientId!)}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Eye size={18} />
                    환자 상세 보기
                  </button>
                  <button
                    onClick={() => handleUnlinkPatient(selectedCall)}
                    className="w-full py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Unlink size={16} />
                    연결 해제
                  </button>
                </>
              ) : (
                <>
                  {/* 환자 미연결 상태: 환자 등록 버튼 항상 표시 */}
                  <button
                    onClick={() => handleRegisterPatient(selectedCall)}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <UserPlus size={18} />
                    환자로 등록
                  </button>
                </>
              )}

              {/* 분류 변경 버튼 - 항상 표시 */}
              <button
                onClick={() => handleEditAnalysis(selectedCall)}
                className="w-full py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <Pencil size={16} />
                분류 변경
              </button>

              {selectedCall.duration === 0 && (
                <button
                  onClick={() => handleMakeCall(selectedCall.phone)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <PhoneCall size={18} />
                  다시 전화하기
                </button>
              )}

              {selectedCall.suggestedCallback && !selectedCall.patientId && (
                <button className="w-full py-3 border border-amber-500 text-amber-600 hover:bg-amber-50 rounded-xl font-medium flex items-center justify-center gap-2">
                  <Bell size={18} />
                  콜백 예약
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 분석 수정 모달 */}
      {editingCall && (
        <EditAnalysisModal
          call={editingCall}
          onClose={() => setEditingCall(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* 환자 등록 모달 */}
      {registeringCall && (
        <RegisterPatientModal
          call={registeringCall}
          onClose={() => setRegisteringCall(null)}
          onSuccess={handleRegisterSuccess}
        />
      )}
    </div>
  );
}

export default function CallLogsPage() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">로딩 중...</div>}>
      <CallLogsPageContent />
    </Suspense>
  );
}
