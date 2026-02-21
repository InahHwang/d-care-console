import React, { useState } from 'react';

// 미동의 사유 카테고리 정의
const disagreeReasonCategories = {
  price: {
    label: '💰 가격/비용',
    reasons: [
      '예산 초과',
      '타 병원 대비 비쌈',
      '분납/할부 조건 안 맞음',
      '당장 여유가 안 됨',
    ]
  },
  treatment: {
    label: '🦷 치료 계획',
    reasons: [
      '치료 계획 이견 (타 병원과 다름)',
      '제안 치료 거부 (임플란트→틀니 등)',
      '치료 범위 과다 (과잉진료 우려)',
      '치료 기간 부담',
    ]
  },
  decision: {
    label: '⏳ 결정 보류',
    reasons: [
      '가족 상의 필요',
      '타 병원 비교 중',
      '추가 상담/정보 필요',
      '단순 정보 문의',
    ]
  },
  other: {
    label: '📋 기타',
    reasons: [
      '일정 조율 어려움',
      '치료 두려움/불안',
      '기타',
    ]
  }
};

// 모든 미동의 사유 플랫 리스트
const allDisagreeReasons = Object.values(disagreeReasonCategories).flatMap(cat => cat.reasons);

// 샘플 데이터
const sampleData = {
  date: '2024-12-14',
  dayOfWeek: '토',
  clinicName: '미소드림치과',
  summary: {
    total: 12,
    agreed: 8,
    disagreed: 3,
    pending: 1,
    expectedRevenue: 2800,
    actualRevenue: 2520, // 할인 적용 후
    totalDiscount: 280,
    avgDiscountRate: 10,
    callbackCount: 5
  },
  patients: [
    {
      id: 1,
      name: '김미영',
      gender: '여',
      age: 34,
      phone: '010-1234-5678',
      status: 'disagreed',
      treatment: '임플란트 #36,37 (2본)',
      inquiry: '어금니 2개 빠진 지 6개월, 씹는 게 불편해서 문의. 빠른 치료 원함.',
      consultantMemo: '오스템 기준 500만원 안내, 예산 400 이하 원하심. 할부 문의함.',
      disagreeReasons: ['예산 초과', '분납/할부 조건 안 맞음'],
      correctionPlan: '메가젠으로 재안내 + 무이자 12개월 할부 조건 안내 예정, 12/16 콜백',
      originalAmount: 500,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 500,
      consultantName: '박상담',
      time: '10:23'
    },
    {
      id: 2,
      name: '이준호',
      gender: '남',
      age: 52,
      phone: '010-2345-6789',
      status: 'disagreed',
      treatment: '교정 (성인 투명교정)',
      inquiry: '앞니 벌어짐 교정 문의, 직장생활 중이라 안 보이는 교정 원함',
      consultantMemo: '인비절라인 600, 클리어얼라이너 400 안내. 기간 문의 많았음.',
      disagreeReasons: ['타 병원 비교 중', '타 병원 대비 비쌈'],
      correctionPlan: '클리어얼라이너 장점 재안내, 증례 사진 카톡 발송 + 10% 할인 검토 요청',
      originalAmount: 500,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 500,
      consultantName: '박상담',
      time: '11:45'
    },
    {
      id: 3,
      name: '최영수',
      gender: '남',
      age: 45,
      phone: '010-3456-7890',
      status: 'disagreed',
      treatment: '크라운 #16',
      inquiry: '신경치료 받은 치아 크라운 문의',
      consultantMemo: '지르코니아 50만원 안내, 다음주 출장이라 일정 조율 필요',
      disagreeReasons: ['일정 조율 어려움'],
      correctionPlan: '출장 복귀 후 12/23 주 예약 제안 예정',
      originalAmount: 50,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 50,
      consultantName: '김상담',
      time: '14:20'
    },
    {
      id: 4,
      name: '박서연',
      gender: '여',
      age: 28,
      phone: '010-4567-8901',
      status: 'agreed',
      treatment: '충치 치료 #14,15',
      inquiry: '충치 2개 치료 문의, 통증 있어서 빠른 예약 원함',
      consultantMemo: '레진 치료 각 15만원 안내, 바로 동의',
      appointmentDate: '12/18 14:00',
      originalAmount: 30,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 30,
      consultantName: '김상담',
      time: '09:15'
    },
    {
      id: 5,
      name: '정다은',
      gender: '여',
      age: 31,
      phone: '010-5678-9012',
      status: 'agreed',
      treatment: '스케일링 + 잇몸 치료',
      inquiry: '잇몸에서 피나고 시림, 스케일링 오래 안 함',
      consultantMemo: '스케일링 + 치주치료 1회 안내, 보험 적용 설명',
      appointmentDate: '12/16 10:30',
      originalAmount: 15,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 15,
      consultantName: '박상담',
      time: '10:50'
    },
    {
      id: 6,
      name: '한지민',
      gender: '여',
      age: 26,
      phone: '010-6789-0123',
      status: 'agreed',
      treatment: '라미네이트 상악 6본',
      inquiry: '앞니 모양 예쁘게 하고 싶음, 인스타 사진 보고 문의',
      consultantMemo: '라미네이트 6본 360만원 안내, 색상 상담 원해서 원장님 상담 예약. 소개 고객이라 할인 적용.',
      appointmentDate: '12/17 16:00',
      originalAmount: 360,
      discountRate: 10,
      discountAmount: 36,
      finalAmount: 324,
      discountReason: '지인 소개',
      consultantName: '박상담',
      time: '13:30'
    },
    {
      id: 7,
      name: '송민준',
      gender: '남',
      age: 38,
      phone: '010-7890-1234',
      status: 'pending',
      treatment: '임플란트 #46 + 브릿지',
      inquiry: '아래 어금니 발치 후 임플란트 vs 브릿지 고민 중',
      consultantMemo: '임플 200, 브릿지 90 안내. 장단점 설명했으나 결정 못함. 가족 상의 후 연락준다고 함.',
      disagreeReasons: ['가족 상의 필요', '제안 치료 거부 (임플란트→틀니 등)'],
      callbackDate: '12/17',
      originalAmount: 200,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 200,
      consultantName: '김상담',
      time: '15:40'
    },
    {
      id: 8,
      name: '윤서현',
      gender: '여',
      age: 23,
      phone: '010-8901-2345',
      status: 'agreed',
      treatment: '사랑니 발치 #38',
      inquiry: '사랑니 아파서 발치 문의',
      consultantMemo: '매복사랑니 발치 15만원 안내, CT 촬영 필요 설명',
      appointmentDate: '12/19 11:00',
      originalAmount: 15,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 15,
      consultantName: '김상담',
      time: '16:10'
    },
    {
      id: 9,
      name: '강민재',
      gender: '남',
      age: 41,
      phone: '010-9012-3456',
      status: 'agreed',
      treatment: '신경치료 + 크라운 #26',
      inquiry: '윗니 깨져서 문의, 신경치료 필요할 것 같다고 함',
      consultantMemo: '신경치료 20 + 크라운 50 안내, 통증 있어서 빠른 예약. 단골이라 크라운 10% 할인.',
      appointmentDate: '12/16 15:00',
      originalAmount: 70,
      discountRate: 7,
      discountAmount: 5,
      finalAmount: 65,
      discountReason: '단골 고객',
      consultantName: '박상담',
      time: '11:20'
    },
    {
      id: 10,
      name: '임수진',
      gender: '여',
      age: 35,
      phone: '010-0123-4567',
      status: 'agreed',
      treatment: '치아미백',
      inquiry: '결혼 전 미백 하고 싶음, 1월 중순 결혼',
      consultantMemo: '전문가미백 30만원 안내, 2회 시술 필요 설명. 웨딩 이벤트 할인 적용.',
      appointmentDate: '12/20 14:00',
      originalAmount: 30,
      discountRate: 20,
      discountAmount: 6,
      finalAmount: 24,
      discountReason: '웨딩 이벤트',
      consultantName: '김상담',
      time: '14:50'
    },
    {
      id: 11,
      name: '오재현',
      gender: '남',
      age: 55,
      phone: '010-1111-2222',
      status: 'agreed',
      treatment: '틀니 수리',
      inquiry: '아래틀니 깨짐, 급해서 당일 가능한지 문의',
      consultantMemo: '당일 수리 가능 안내, 5만원',
      appointmentDate: '12/14 17:00',
      originalAmount: 5,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 5,
      consultantName: '박상담',
      time: '16:30'
    },
    {
      id: 12,
      name: '배은지',
      gender: '여',
      age: 29,
      phone: '010-3333-4444',
      status: 'agreed',
      treatment: '교정 상담',
      inquiry: '덧니 교정 문의, 세라믹 교정 관심',
      consultantMemo: '세라믹 교정 350만원 안내, 원장님 상담 예약. 현금 완납 시 할인 안내.',
      appointmentDate: '12/21 11:00',
      originalAmount: 350,
      discountRate: 5,
      discountAmount: 17.5,
      finalAmount: 332.5,
      discountReason: '현금 완납',
      consultantName: '김상담',
      time: '17:10'
    }
  ]
};

// 상태별 색상 및 아이콘
const statusConfig = {
  agreed: { 
    icon: '✓', 
    label: '동의', 
    bgColor: 'bg-emerald-50', 
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-500'
  },
  disagreed: { 
    icon: '✗', 
    label: '미동의', 
    bgColor: 'bg-rose-50', 
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-500'
  },
  pending: { 
    icon: '◷', 
    label: '보류', 
    bgColor: 'bg-amber-50', 
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500'
  }
};

// 알림톡 미리보기 컴포넌트
const KakaoPreview = ({ data, onViewDetail }) => (
  <div className="bg-gray-100 min-h-screen p-4 flex items-center justify-center">
    <div className="w-full max-w-sm">
      {/* 카카오톡 말풍선 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* 헤더 */}
        <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-lg">🦷</span>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">CatchAll</div>
            <div className="text-xs text-gray-700">알림톡</div>
          </div>
        </div>
        
        {/* 메시지 본문 */}
        <div className="p-4 space-y-3">
          <div className="text-sm font-medium text-gray-900">
            📊 {data.clinicName} 일일 리포트
          </div>
          <div className="text-xs text-gray-500">
            {data.date} ({data.dayOfWeek})
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">신규 상담</span>
              <span className="font-semibold">{data.summary.total}건</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>├ ✓ 동의</span>
              <span>{data.summary.agreed}건 ({Math.round(data.summary.agreed/data.summary.total*100)}%)</span>
            </div>
            <div className="flex justify-between text-rose-600 font-medium">
              <span>├ ✗ 미동의</span>
              <span>{data.summary.disagreed}건 ← 확인 필요</span>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>└ ◷ 보류</span>
              <span>{data.summary.pending}건</span>
            </div>
          </div>
          
          {/* 매출 정보 - 할인 포함 */}
          <div className="bg-blue-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">💰 예상 매출</span>
              <span className="text-lg font-bold text-blue-600">
                {data.summary.actualRevenue.toLocaleString()}만원
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">정가 {data.summary.expectedRevenue.toLocaleString()}만원</span>
              <span className="text-rose-500">
                할인 -{data.summary.totalDiscount.toLocaleString()}만원 (평균 {data.summary.avgDiscountRate}%)
              </span>
            </div>
          </div>
        </div>
        
        {/* 버튼 */}
        <button
          onClick={onViewDetail}
          className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium text-sm transition-colors"
        >
          👉 상세 보기
        </button>
      </div>
      
      <p className="text-center text-xs text-gray-400 mt-4">
        알림톡 미리보기 (실제 카카오톡 화면)
      </p>
    </div>
  </div>
);

// 대시보드 컴포넌트
const Dashboard = ({ data, onSelectPatient, onBack }) => {
  const [filter, setFilter] = useState('all');
  
  const filteredPatients = data.patients.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });
  
  // 미동의 먼저, 그다음 보류, 그다음 동의 순으로 정렬
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const order = { disagreed: 0, pending: 1, agreed: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">{data.clinicName}</h1>
            <p className="text-xs text-gray-500">{data.date} ({data.dayOfWeek}) 신규 상담</p>
          </div>
        </div>
        
        {/* 요약 카드 - 할인 정보 포함 */}
        <div className="px-4 pb-3">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="flex justify-between items-center mb-3">
              <span className="text-blue-100 text-sm">총 상담</span>
              <span className="text-2xl font-bold">{data.summary.total}건</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/20 rounded-lg py-2">
                <div className="text-lg font-bold">{data.summary.agreed}</div>
                <div className="text-xs text-blue-100">동의</div>
              </div>
              <div className="bg-white/20 rounded-lg py-2">
                <div className="text-lg font-bold">{data.summary.disagreed}</div>
                <div className="text-xs text-blue-100">미동의</div>
              </div>
              <div className="bg-white/20 rounded-lg py-2">
                <div className="text-lg font-bold">{data.summary.pending}</div>
                <div className="text-xs text-blue-100">보류</div>
              </div>
            </div>
            
            {/* 매출 정보 - 할인 상세 */}
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="flex justify-between items-center">
                <span className="text-blue-100 text-sm">예상 매출</span>
                <span className="text-xl font-bold">{data.summary.actualRevenue.toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-sm">
                <span className="text-blue-200">정가 {data.summary.expectedRevenue.toLocaleString()}만원</span>
                <span className="text-yellow-300">
                  할인 -{data.summary.totalDiscount.toLocaleString()}만원
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 필터 탭 */}
        <div className="px-4 pb-2 flex gap-2">
          {[
            { key: 'all', label: '전체', count: data.summary.total },
            { key: 'disagreed', label: '미동의', count: data.summary.disagreed },
            { key: 'pending', label: '보류', count: data.summary.pending },
            { key: 'agreed', label: '동의', count: data.summary.agreed },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>
      </div>
      
      {/* 환자 목록 */}
      <div className="p-4 space-y-3">
        {sortedPatients.map(patient => {
          const config = statusConfig[patient.status];
          const hasDiscount = patient.discountRate > 0;
          
          return (
            <button
              key={patient.id}
              onClick={() => onSelectPatient(patient)}
              className={`w-full text-left bg-white rounded-xl border ${config.borderColor} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full ${config.badgeColor} text-white text-xs flex items-center justify-center font-bold`}>
                      {config.icon}
                    </span>
                    <span className="font-semibold text-gray-900">{patient.name}</span>
                    <span className="text-sm text-gray-500">
                      {patient.gender}/{patient.age}세
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{patient.time}</span>
                </div>
                
                <div className="text-sm text-gray-900 mb-2">{patient.treatment}</div>
                
                {patient.status === 'disagreed' && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {patient.disagreeReasons.map((reason, i) => (
                      <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                
                {patient.status === 'pending' && patient.disagreeReasons && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {patient.disagreeReasons.map((reason, i) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                
                {patient.status === 'agreed' && patient.appointmentDate && (
                  <div className="text-sm text-emerald-600">
                    📅 예약: {patient.appointmentDate}
                  </div>
                )}
                
                {patient.status === 'pending' && patient.callbackDate && (
                  <div className="text-sm text-amber-600">
                    📞 콜백 예정: {patient.callbackDate}
                  </div>
                )}
                
                {/* 금액 정보 - 할인 표시 */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    {hasDiscount ? (
                      <>
                        <span className="text-sm text-gray-400 line-through">
                          {patient.originalAmount.toLocaleString()}만
                        </span>
                        <span className="text-sm font-medium text-blue-600">
                          {patient.finalAmount.toLocaleString()}만원
                        </span>
                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                          -{patient.discountRate}%
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {patient.originalAmount.toLocaleString()}만원
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    상세 보기
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// 환자 상세 카드 컴포넌트
const PatientDetail = ({ patient, onBack }) => {
  const config = statusConfig[patient.status];
  const hasDiscount = patient.discountRate > 0;
  
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 헤더 */}
      <div className={`${config.bgColor} border-b ${config.borderColor}`}>
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeColor} text-white`}>
                {config.label}
              </span>
              <h1 className="font-semibold text-gray-900">{patient.name}</h1>
              <span className="text-sm text-gray-500">({patient.gender}/{patient.age}세)</span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{patient.treatment}</p>
          </div>
        </div>
        
        {/* 기본 정보 */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">연락처</span>
                <div className="font-medium">{patient.phone}</div>
              </div>
              <div>
                <span className="text-gray-500">상담 시간</span>
                <div className="font-medium">{patient.time}</div>
              </div>
              <div>
                <span className="text-gray-500">담당 상담사</span>
                <div className="font-medium">{patient.consultantName}</div>
              </div>
              <div>
                <span className="text-gray-500">금액</span>
                {hasDiscount ? (
                  <div>
                    <span className="text-gray-400 line-through text-xs mr-1">
                      {patient.originalAmount.toLocaleString()}만
                    </span>
                    <span className="font-medium text-blue-600">
                      {patient.finalAmount.toLocaleString()}만원
                    </span>
                  </div>
                ) : (
                  <div className="font-medium text-blue-600">
                    {patient.originalAmount.toLocaleString()}만원
                  </div>
                )}
              </div>
            </div>
            
            {/* 할인 정보 */}
            {hasDiscount && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                      할인 {patient.discountRate}%
                    </span>
                    <span className="text-sm text-gray-600">
                      -{patient.discountAmount.toLocaleString()}만원
                    </span>
                  </div>
                  {patient.discountReason && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {patient.discountReason}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 상세 내용 */}
      <div className="p-4 space-y-4">
        {/* 상담 내용 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📞</span>
            <h2 className="font-semibold text-gray-900">상담 내용</h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            "{patient.inquiry}"
          </p>
        </div>
        
        {/* 상담사 메모 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">💬</span>
            <h2 className="font-semibold text-gray-900">상담사 메모</h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            "{patient.consultantMemo}"
          </p>
        </div>
        
        {/* 미동의/보류 사유 (카테고리별 표시) */}
        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.disagreeReasons && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">❌</span>
              <h2 className="font-semibold text-gray-900">
                {patient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
              </h2>
            </div>
            <div className="space-y-4">
              {Object.entries(disagreeReasonCategories).map(([key, category]) => {
                const categoryReasons = category.reasons.filter(r => 
                  patient.disagreeReasons.includes(r)
                );
                const hasSelectedInCategory = categoryReasons.length > 0;
                
                return (
                  <div key={key} className={hasSelectedInCategory ? '' : 'opacity-40'}>
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      {category.label}
                    </div>
                    <div className="space-y-1.5">
                      {category.reasons.map(reason => {
                        const isSelected = patient.disagreeReasons.includes(reason);
                        return (
                          <div key={reason} className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                              isSelected 
                                ? 'bg-rose-500 border-rose-500 text-white' 
                                : 'border-gray-300 text-gray-300'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </span>
                            <span className={`text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                              {reason}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* 시정 계획 (미동의/보류인 경우) */}
        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.correctionPlan && (
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📝</span>
              <h2 className="font-semibold text-blue-900">시정 계획</h2>
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">
              "{patient.correctionPlan}"
            </p>
          </div>
        )}
        
        {/* 예약 정보 (동의인 경우) */}
        {patient.status === 'agreed' && patient.appointmentDate && (
          <div className="bg-emerald-50 rounded-xl p-4 shadow-sm border border-emerald-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📅</span>
              <h2 className="font-semibold text-emerald-900">예약 정보</h2>
            </div>
            <p className="text-lg font-semibold text-emerald-800">
              {patient.appointmentDate}
            </p>
          </div>
        )}
        
        {/* 콜백 예정 (보류인 경우) */}
        {patient.status === 'pending' && patient.callbackDate && (
          <div className="bg-amber-50 rounded-xl p-4 shadow-sm border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📞</span>
              <h2 className="font-semibold text-amber-900">콜백 예정</h2>
            </div>
            <p className="text-lg font-semibold text-amber-800">
              {patient.callbackDate}
            </p>
          </div>
        )}
      </div>
      
      {/* 하단 액션 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 transition-colors">
            📞 전화 걸기
          </button>
          <button className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium text-white transition-colors">
            💬 메모 추가
          </button>
        </div>
      </div>
      
      {/* 하단 여백 */}
      <div className="h-24"></div>
    </div>
  );
};

// 메인 앱 컴포넌트
export default function DailyReportMobile() {
  const [view, setView] = useState('kakao'); // 'kakao', 'dashboard', 'detail'
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  // 뷰 전환 핸들러
  const goToDashboard = () => setView('dashboard');
  const goToKakao = () => {
    setView('kakao');
    setSelectedPatient(null);
  };
  const goToDetail = (patient) => {
    setSelectedPatient(patient);
    setView('detail');
  };
  const goBackFromDetail = () => {
    setSelectedPatient(null);
    setView('dashboard');
  };
  
  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl">
      {/* 모바일 프레임 */}
      <div className="relative">
        {/* 상단 상태바 모양 */}
        <div className="bg-black text-white text-xs py-2 px-4 flex justify-between items-center">
          <span>18:30</span>
          <div className="flex items-center gap-1">
            <span>📶</span>
            <span>🔋 85%</span>
          </div>
        </div>
        
        {/* 화면 전환 탭 (데모용) */}
        <div className="bg-gray-800 px-4 py-2 flex gap-2">
          <button
            onClick={goToKakao}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === 'kakao' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-700 text-gray-300'
            }`}
          >
            1단계: 알림톡
          </button>
          <button
            onClick={goToDashboard}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === 'dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            2단계: 대시보드
          </button>
          <button
            disabled={!selectedPatient}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              view === 'detail' ? 'bg-purple-500 text-white' : 'bg-gray-700 text-gray-400'
            }`}
          >
            3단계: 상세
          </button>
        </div>
        
        {/* 메인 컨텐츠 */}
        {view === 'kakao' && (
          <KakaoPreview data={sampleData} onViewDetail={goToDashboard} />
        )}
        {view === 'dashboard' && (
          <Dashboard 
            data={sampleData} 
            onSelectPatient={goToDetail}
            onBack={goToKakao}
          />
        )}
        {view === 'detail' && selectedPatient && (
          <PatientDetail 
            patient={selectedPatient}
            onBack={goBackFromDetail}
          />
        )}
      </div>
    </div>
  );
}
