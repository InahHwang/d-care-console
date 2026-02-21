import React, { useState } from 'react';

// 미동의 사유 카테고리 정의
const disagreeReasonCategories = {
  price: {
    label: '💰 가격/비용',
    reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨']
  },
  treatment: {
    label: '🦷 치료 계획',
    reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담']
  },
  decision: {
    label: '⏳ 결정 보류',
    reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의']
  },
  other: {
    label: '📋 기타',
    reasons: ['일정 조율 어려움', '치료 두려움/불안', '기타']
  }
};

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
    actualRevenue: 2520,
    totalDiscount: 280,
    avgDiscountRate: 10,
  },
  patients: [
    {
      id: '1',
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
      discountReason: '',
      consultantName: '박상담',
      time: '10:23'
    },
    {
      id: '2',
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
      discountReason: '',
      consultantName: '박상담',
      time: '11:45'
    },
    {
      id: '3',
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
      discountReason: '',
      consultantName: '김상담',
      time: '14:20'
    },
    {
      id: '4',
      name: '박서연',
      gender: '여',
      age: 28,
      phone: '010-4567-8901',
      status: 'agreed',
      treatment: '충치 치료 #14,15',
      inquiry: '충치 2개 치료 문의, 통증 있어서 빠른 예약 원함',
      consultantMemo: '레진 치료 각 15만원 안내, 바로 동의',
      disagreeReasons: [],
      correctionPlan: '',
      appointmentDate: '12/18 14:00',
      originalAmount: 30,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 30,
      discountReason: '',
      consultantName: '김상담',
      time: '09:15'
    },
    {
      id: '5',
      name: '한지민',
      gender: '여',
      age: 26,
      phone: '010-6789-0123',
      status: 'agreed',
      treatment: '라미네이트 상악 6본',
      inquiry: '앞니 모양 예쁘게 하고 싶음, 인스타 사진 보고 문의',
      consultantMemo: '라미네이트 6본 360만원 안내, 색상 상담 원해서 원장님 상담 예약. 소개 고객이라 할인 적용.',
      disagreeReasons: [],
      correctionPlan: '',
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
      id: '6',
      name: '송민준',
      gender: '남',
      age: 38,
      phone: '010-7890-1234',
      status: 'pending',
      treatment: '임플란트 #46 + 브릿지',
      inquiry: '아래 어금니 발치 후 임플란트 vs 브릿지 고민 중',
      consultantMemo: '임플 200, 브릿지 90 안내. 장단점 설명했으나 결정 못함.',
      disagreeReasons: ['가족 상의 필요', '제안 치료 거부'],
      correctionPlan: '',
      callbackDate: '12/17',
      originalAmount: 200,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 200,
      discountReason: '',
      consultantName: '김상담',
      time: '15:40'
    },
    {
      id: '7',
      name: '윤서현',
      gender: '여',
      age: 23,
      phone: '010-8901-2345',
      status: 'agreed',
      treatment: '사랑니 발치 #38',
      inquiry: '사랑니 아파서 발치 문의',
      consultantMemo: '매복사랑니 발치 15만원 안내, CT 촬영 필요 설명',
      disagreeReasons: [],
      correctionPlan: '',
      appointmentDate: '12/19 11:00',
      originalAmount: 15,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: 15,
      discountReason: '',
      consultantName: '김상담',
      time: '16:10'
    },
    {
      id: '8',
      name: '강민재',
      gender: '남',
      age: 41,
      phone: '010-9012-3456',
      status: 'agreed',
      treatment: '신경치료 + 크라운 #26',
      inquiry: '윗니 깨져서 문의, 신경치료 필요할 것 같다고 함',
      consultantMemo: '신경치료 20 + 크라운 50 안내, 통증 있어서 빠른 예약. 단골이라 크라운 10% 할인.',
      disagreeReasons: [],
      correctionPlan: '',
      appointmentDate: '12/16 15:00',
      originalAmount: 70,
      discountRate: 7,
      discountAmount: 5,
      finalAmount: 65,
      discountReason: '단골 고객',
      consultantName: '박상담',
      time: '11:20'
    }
  ]
};

// 상태별 설정
const statusConfig = {
  agreed: {
    icon: '✓',
    label: '동의',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeColor: 'bg-emerald-500',
    lightBadge: 'bg-emerald-100 text-emerald-700'
  },
  disagreed: {
    icon: '✗',
    label: '미동의',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-500',
    lightBadge: 'bg-rose-100 text-rose-700'
  },
  pending: {
    icon: '◷',
    label: '보류',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500',
    lightBadge: 'bg-amber-100 text-amber-700'
  }
};

// 요약 카드
function SummaryCards({ summary }) {
  const conversionRate = Math.round((summary.agreed / summary.total) * 100);

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">총 상담</div>
        <div className="text-3xl font-bold text-gray-900">{summary.total}건</div>
        <div className="text-sm text-gray-500 mt-1">전환율 {conversionRate}%</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-2">상담 결과</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            동의 {summary.agreed}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span>
            미동의 {summary.disagreed}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            보류 {summary.pending}
          </span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-gray-100">
          <div className="bg-emerald-500" style={{ width: `${(summary.agreed / summary.total) * 100}%` }} />
          <div className="bg-rose-500" style={{ width: `${(summary.disagreed / summary.total) * 100}%` }} />
          <div className="bg-amber-500" style={{ width: `${(summary.pending / summary.total) * 100}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">예상 매출</div>
        <div className="text-3xl font-bold text-blue-600">{summary.actualRevenue.toLocaleString()}만원</div>
        <div className="text-sm text-gray-500 mt-1">정가 {summary.expectedRevenue.toLocaleString()}만원</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm text-gray-500 mb-1">할인</div>
        <div className="text-3xl font-bold text-rose-500">-{summary.totalDiscount.toLocaleString()}만원</div>
        <div className="text-sm text-gray-500 mt-1">평균 {summary.avgDiscountRate}% 할인</div>
      </div>
    </div>
  );
}

// 환자 목록
function PatientList({ patients, selectedId, onSelect, filter, onFilterChange }) {
  const filteredPatients = patients.filter(p => filter === 'all' || p.status === filter);
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const order = { disagreed: 0, pending: 1, agreed: 2 };
    return order[a.status] - order[b.status];
  });

  const counts = {
    all: patients.length,
    agreed: patients.filter(p => p.status === 'agreed').length,
    disagreed: patients.filter(p => p.status === 'disagreed').length,
    pending: patients.filter(p => p.status === 'pending').length
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          {['all', 'disagreed', 'pending', 'agreed'].map(key => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {key === 'all' ? '전체' : key === 'disagreed' ? '미동의' : key === 'pending' ? '보류' : '동의'} ({counts[key]})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedPatients.map(patient => {
          const config = statusConfig[patient.status];
          const isSelected = selectedId === patient.id;
          const hasDiscount = patient.discountRate > 0;

          return (
            <button
              key={patient.id}
              onClick={() => onSelect(patient)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.lightBadge}`}>
                    {config.label}
                  </span>
                  <span className="font-semibold text-gray-900">{patient.name}</span>
                  <span className="text-sm text-gray-500">{patient.gender}/{patient.age}세</span>
                </div>
                <span className="text-xs text-gray-400">{patient.time}</span>
              </div>

              <div className="text-sm text-gray-700 mb-2">{patient.treatment}</div>

              {(patient.status === 'disagreed' || patient.status === 'pending') && patient.disagreeReasons.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {patient.disagreeReasons.slice(0, 2).map((reason, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        patient.status === 'disagreed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              {patient.status === 'agreed' && patient.appointmentDate && (
                <div className="text-sm text-emerald-600 mb-2">📅 {patient.appointmentDate}</div>
              )}

              <div className="flex items-center gap-2">
                {hasDiscount ? (
                  <>
                    <span className="text-sm text-gray-400 line-through">{patient.originalAmount}만</span>
                    <span className="text-sm font-semibold text-blue-600">{patient.finalAmount}만원</span>
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                      -{patient.discountRate}%
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-gray-700">{patient.originalAmount}만원</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 환자 상세
function PatientDetailPanel({ patient }) {
  if (!patient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="text-center">
          <div className="text-5xl mb-4">👈</div>
          <p>환자를 선택하면 상세 정보가 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const config = statusConfig[patient.status];
  const hasDiscount = patient.discountRate > 0;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className={`${config.bgColor} border-b ${config.borderColor} p-6`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.badgeColor} text-white`}>
                {config.label}
              </span>
              <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
              <span className="text-gray-500">({patient.gender}/{patient.age}세)</span>
            </div>
            <p className="text-lg text-gray-700">{patient.treatment}</p>
          </div>
          <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
            📞 전화 걸기
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">연락처</div>
            <div className="font-medium">{patient.phone}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">상담 시간</div>
            <div className="font-medium">{patient.time}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">담당 상담사</div>
            <div className="font-medium">{patient.consultantName}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">금액</div>
            {hasDiscount ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 line-through text-sm">{patient.originalAmount}만</span>
                <span className="font-bold text-blue-600">{patient.finalAmount}만원</span>
                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-xs rounded font-medium">
                  -{patient.discountRate}%
                </span>
              </div>
            ) : (
              <div className="font-bold text-blue-600">{patient.originalAmount}만원</div>
            )}
          </div>
        </div>

        {hasDiscount && (
          <div className="mt-3 bg-white rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-rose-500 font-medium">할인 적용</span>
              <span className="px-2 py-1 bg-rose-100 text-rose-600 rounded font-medium">
                {patient.discountRate}% (-{patient.discountAmount}만원)
              </span>
            </div>
            {patient.discountReason && (
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                사유: {patient.discountReason}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-6 space-y-4">
        {patient.inquiry && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">📞 상담 내용</h3>
            <p className="text-gray-700 leading-relaxed">{patient.inquiry}</p>
          </div>
        )}

        {patient.consultantMemo && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">💬 상담사 메모</h3>
            <p className="text-gray-700 leading-relaxed">{patient.consultantMemo}</p>
          </div>
        )}

        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.disagreeReasons.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">
              ❌ {patient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(disagreeReasonCategories).map(([key, category]) => {
                const selected = category.reasons.filter(r => patient.disagreeReasons.includes(r));
                if (selected.length === 0) return null;
                return (
                  <div key={key} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-500 mb-3">{category.label}</div>
                    <div className="space-y-2">
                      {selected.map(reason => (
                        <div key={reason} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-rose-500 text-white text-xs flex items-center justify-center">✓</span>
                          <span className="text-gray-900 font-medium">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.correctionPlan && (
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">📝 시정 계획</h3>
            <p className="text-blue-800 leading-relaxed">{patient.correctionPlan}</p>
          </div>
        )}

        {patient.status === 'agreed' && patient.appointmentDate && (
          <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
            <h3 className="font-semibold text-emerald-900 mb-3">📅 예약 정보</h3>
            <p className="text-2xl font-bold text-emerald-800">{patient.appointmentDate}</p>
          </div>
        )}

        {patient.status === 'pending' && patient.callbackDate && (
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
            <h3 className="font-semibold text-amber-900 mb-3">📞 콜백 예정</h3>
            <p className="text-2xl font-bold text-amber-800">{patient.callbackDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 메인 컴포넌트
export default function DailyReportPC() {
  const [selectedPatient, setSelectedPatient] = useState(sampleData.patients[0]);
  const [filter, setFilter] = useState('all');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sampleData.clinicName}</h1>
            <p className="text-gray-500">{sampleData.date} ({sampleData.dayOfWeek}) 일일 상담 리포트</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              📥 PDF 다운로드
            </button>
            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              📊 엑셀 다운로드
            </button>
          </div>
        </div>
      </header>

      {/* 요약 카드 */}
      <div className="px-6 py-4">
        <SummaryCards summary={sampleData.summary} />
      </div>

      {/* 메인 - 좌우 분할 */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-2" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
            {/* 좌측: 환자 목록 */}
            <div className="border-r border-gray-200">
              <PatientList
                patients={sampleData.patients}
                selectedId={selectedPatient?.id}
                onSelect={setSelectedPatient}
                filter={filter}
                onFilterChange={setFilter}
              />
            </div>

            {/* 우측: 환자 상세 */}
            <div>
              <PatientDetailPanel patient={selectedPatient} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
