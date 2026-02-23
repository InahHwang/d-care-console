// src/app/v2/patients/new/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';

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

export default function NewPatientPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consultationType, setConsultationType] = useState('');
  const [interest, setInterest] = useState('');
  const [source, setSource] = useState('');
  const [age, setAge] = useState<string>('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [memo, setMemo] = useState('');
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
          const activeTypes = (data.categories.consultationTypes || []).filter((item: CategoryItem) => item.isActive);
          const activeSources = (data.categories.referralSources || []).filter((item: CategoryItem) => item.isActive);
          const activeServices = (data.categories.interestedServices || []).filter((item: CategoryItem) => item.isActive);
          setConsultationTypes(activeTypes);
          setReferralSources(activeSources);
          setInterestedServices(activeServices);
          if (activeTypes.length > 0 && !consultationType) {
            setConsultationType(activeTypes[0].label);
          }
        }
      } catch (err) {
        console.error('카테고리 로드 실패:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // 전화번호 포맷팅
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('환자 이름을 입력해주세요');
      return;
    }

    if (!phone.trim()) {
      setError('전화번호를 입력해주세요');
      return;
    }

    // 전화번호 형식 검증 (하이픈 제거 후 10-11자리)
    const phoneDigits = phone.replace(/-/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError('올바른 전화번호 형식이 아닙니다');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const patientData: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim(),
        consultationType,
        interest,
        source,
        memo,
      };

      if (age) {
        patientData.age = parseInt(age, 10);
      }

      if (province) {
        patientData.region = {
          province,
          city: city || undefined,
        };
      }

      const response = await fetchWithAuth('/api/v2/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });

      if (response.status === 409) {
        const data = await response.json();
        setError(`이미 등록된 전화번호입니다. (환자: ${data.patientName || '알 수 없음'})`);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '등록 중 오류가 발생했습니다');
        return;
      }

      const data = await response.json();
      // 등록 성공 시 환자 상세 페이지로 이동
      router.push(`/v2/patients/${data.patientId}`);
    } catch (err) {
      setError('등록 중 오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">신규 환자 등록</h1>
          <p className="text-sm text-gray-500 mt-1">새로운 환자 정보를 입력해주세요</p>
        </div>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* 필수 정보 */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 pb-2 border-b">필수 정보</h2>

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
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              전화번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-0000-0000"
              maxLength={13}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 상담 정보 */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 pb-2 border-b">상담 정보</h2>

          {/* 상담타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상담타입</label>
            {loadingCategories ? (
              <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                로딩 중...
              </div>
            ) : (
              <select
                value={consultationType}
                onChange={(e) => setConsultationType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                로딩 중...
              </div>
            ) : interestedServices.length > 0 ? (
              <select
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* 유입경로 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">유입경로</label>
            {loadingCategories ? (
              <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                로딩 중...
              </div>
            ) : (
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">알수없음</option>
                {referralSources.map((item) => (
                  <option key={item.id} value={item.label}>{item.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 pb-2 border-b">추가 정보</h2>

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
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 주소 (시/도, 시군구) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setCity('');
                }}
                className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">시/군/구 선택</option>
                {province && REGION_DATA[province]?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="환자에 대한 메모를 입력하세요"
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                등록 중...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                환자 등록
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
