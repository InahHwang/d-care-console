import React, { useState } from 'react';
import { Phone, Calendar, ChevronLeft, ChevronRight, Bell, User, Home, Users, BarChart3, Download, FileText, Sparkles } from 'lucide-react';

// 미동의 사유 카테고리
const disagreeReasonCategories = {
  price: { label: '💰 가격/비용', reasons: ['예산 초과', '타 병원 대비 비쌈', '분납/할부 조건 안 맞음', '당장 여유가 안 됨'] },
  treatment: { label: '🦷 치료 계획', reasons: ['치료 계획 이견', '제안 치료 거부', '치료 범위 과다', '치료 기간 부담'] },
  decision: { label: '⏳ 결정 보류', reasons: ['가족 상의 필요', '타 병원 비교 중', '추가 상담/정보 필요', '단순 정보 문의'] },
  other: { label: '📋 기타', reasons: ['일정 조율 어려움', '치료 두려움/불안', '기타'] }
};

// 상태별 설정
const statusConfig = {
  agreed: { label: '동의', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', badgeColor: 'bg-emerald-500', lightBadge: 'bg-emerald-100 text-emerald-700' },
  disagreed: { label: '미동의', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', badgeColor: 'bg-rose-500', lightBadge: 'bg-rose-100 text-rose-700' },
  pending: { label: '보류', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', badgeColor: 'bg-amber-500', lightBadge: 'bg-amber-100 text-amber-700' }
};

// 샘플 데이터
const dailyData = {
  date: '2024-01-15',
  dayOfWeek: '월',
  summary: {
    total: 8,
    agreed: 5,
    disagreed: 2,
    pending: 1,
    expectedRevenue: 1240,
    actualRevenue: 1131,
    totalDiscount: 109,
  },
  patients: [
    {
      id: '1', name: '김미영', gender: '여', age: 34, phone: '010-9876-5432',
      status: 'disagreed', treatment: '임플란트 #36,37 (2본)',
      inquiry: '어금니 2개 빠진 지 6개월, 씹는 게 불편해서 문의. 빠른 치료 원함.',
      aiSummary: '앞니 임플란트 상담. 가격 문의, 다음주 내원 희망. 오전 선호.',
      consultantMemo: '오스템 기준 500만원 안내, 예산 400 이하 원하심. 할부 문의함.',
      disagreeReasons: ['예산 초과', '분납/할부 조건 안 맞음'],
      correctionPlan: '메가젠으로 재안내 + 무이자 12개월 할부 조건 안내 예정',
      callbackDate: '1/17 10:00',
      originalAmount: 500, discountRate: 0, finalAmount: 500,
      source: '외주DB', consultantName: '박상담', time: '10:23',
      temperature: 'hot'
    },
    {
      id: '2', name: '이준호', gender: '남', age: 52, phone: '010-1234-5678',
      status: 'disagreed', treatment: '교정 (성인 투명교정)',
      inquiry: '앞니 벌어짐 교정 문의, 직장생활 중이라 안 보이는 교정 원함',
      aiSummary: '투명교정 비용 상담. 타 병원과 비교 중. 2주 내 결정 예정.',
      consultantMemo: '인비절라인 600, 클리어얼라이너 400 안내. 기간 문의 많았음.',
      disagreeReasons: ['타 병원 비교 중', '타 병원 대비 비쌈'],
      correctionPlan: '클리어얼라이너 장점 재안내, 증례 사진 카톡 발송 + 10% 할인 검토',
      callbackDate: '1/22',
      originalAmount: 500, discountRate: 0, finalAmount: 500,
      source: '네이버', consultantName: '박상담', time: '11:45',
      temperature: 'warm'
    },
    {
      id: '3', name: '박서연', gender: '여', age: 28, phone: '010-5555-1234',
      status: 'agreed', treatment: '충치 치료 #14,15',
      inquiry: '충치 2개 치료 문의, 통증 있어서 빠른 예약 원함',
      aiSummary: '충치 2개 치료 상담. 통증 있어 빠른 예약 희망. 바로 동의.',
      consultantMemo: '레진 치료 각 15만원 안내, 바로 동의',
      disagreeReasons: [],
      appointmentDate: '1/18 14:00',
      originalAmount: 30, discountRate: 0, finalAmount: 30,
      source: '홈페이지', consultantName: '김상담', time: '09:15',
      temperature: 'hot'
    },
    {
      id: '4', name: '한지민', gender: '여', age: 26, phone: '010-6789-0123',
      status: 'agreed', treatment: '라미네이트 상악 6본',
      inquiry: '앞니 모양 예쁘게 하고 싶음, 인스타 사진 보고 문의',
      aiSummary: '라미네이트 6본 상담. 색상 상담 원함. 소개 고객.',
      consultantMemo: '라미네이트 6본 360만원 안내, 색상 상담 원해서 원장님 상담 예약. 소개 고객이라 할인 적용.',
      disagreeReasons: [],
      appointmentDate: '1/17 16:00',
      originalAmount: 360, discountRate: 10, discountAmount: 36, finalAmount: 324,
      discountReason: '지인 소개',
      source: '소개', consultantName: '박상담', time: '13:30',
      temperature: 'hot'
    },
    {
      id: '5', name: '송민준', gender: '남', age: 38, phone: '010-7890-1234',
      status: 'pending', treatment: '임플란트 #46 + 브릿지',
      inquiry: '아래 어금니 발치 후 임플란트 vs 브릿지 고민 중',
      aiSummary: '임플란트 vs 브릿지 고민. 가족 상의 필요. 결정 보류.',
      consultantMemo: '임플 200, 브릿지 90 안내. 장단점 설명했으나 결정 못함.',
      disagreeReasons: ['가족 상의 필요'],
      callbackDate: '1/17',
      originalAmount: 200, discountRate: 0, finalAmount: 200,
      source: '네이버', consultantName: '김상담', time: '15:40',
      temperature: 'warm'
    },
    {
      id: '6', name: '윤서현', gender: '여', age: 23, phone: '010-8901-2345',
      status: 'agreed', treatment: '사랑니 발치 #38',
      inquiry: '사랑니 아파서 발치 문의',
      aiSummary: '매복 사랑니 발치 상담. 바로 동의.',
      consultantMemo: '매복사랑니 발치 15만원 안내, CT 촬영 필요 설명',
      disagreeReasons: [],
      appointmentDate: '1/19 11:00',
      originalAmount: 15, discountRate: 0, finalAmount: 15,
      source: '홈페이지', consultantName: '김상담', time: '16:10',
      temperature: 'hot'
    },
    {
      id: '7', name: '강민재', gender: '남', age: 41, phone: '010-9012-3456',
      status: 'agreed', treatment: '신경치료 + 크라운 #26',
      inquiry: '윗니 깨져서 문의, 신경치료 필요할 것 같다고 함',
      aiSummary: '신경치료 + 크라운 상담. 통증 있어 빠른 예약. 단골 할인.',
      consultantMemo: '신경치료 20 + 크라운 50 안내, 통증 있어서 빠른 예약. 단골이라 크라운 10% 할인.',
      disagreeReasons: [],
      appointmentDate: '1/16 15:00',
      originalAmount: 70, discountRate: 7, discountAmount: 5, finalAmount: 65,
      discountReason: '단골 고객',
      source: '소개', consultantName: '박상담', time: '11:20',
      temperature: 'hot'
    },
    {
      id: '8', name: '정유진', gender: '여', age: 31, phone: '010-2222-3333',
      status: 'agreed', treatment: '스케일링',
      inquiry: '정기 스케일링 예약 문의',
      aiSummary: '정기 스케일링 상담. 바로 예약.',
      consultantMemo: '보험 적용 스케일링 안내, 바로 예약',
      disagreeReasons: [],
      appointmentDate: '1/18 10:00',
      originalAmount: 5, discountRate: 0, finalAmount: 5,
      source: '기존환자', consultantName: '김상담', time: '17:00',
      temperature: 'warm'
    },
  ]
};

// 요약 카드
function SummaryCards({ summary }) {
  const conversionRate = Math.round((summary.agreed / summary.total) * 100);

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white rounded-xl p-4">
        <div className="text-sm text-gray-500 mb-1">총 상담</div>
        <div className="text-3xl font-bold text-gray-900">{summary.total}건</div>
        <div className="text-sm text-gray-500 mt-1">전환율 {conversionRate}%</div>
      </div>

      <div className="bg-white rounded-xl p-4">
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

      <div className="bg-white rounded-xl p-4">
        <div className="text-sm text-gray-500 mb-1">예상 매출</div>
        <div className="text-3xl font-bold text-blue-600">{summary.actualRevenue.toLocaleString()}만원</div>
        <div className="text-sm text-gray-500 mt-1">정가 {summary.expectedRevenue.toLocaleString()}만원</div>
      </div>

      <div className="bg-white rounded-xl p-4">
        <div className="text-sm text-gray-500 mb-1">할인</div>
        <div className="text-3xl font-bold text-rose-500">-{summary.totalDiscount.toLocaleString()}만원</div>
        <div className="text-sm text-gray-500 mt-1">동의 환자 기준</div>
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
      <div className="p-4 border-b bg-gray-50">
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
                    <span key={i} className={`px-2 py-0.5 text-xs rounded-full ${
                      patient.status === 'disagreed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
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
                <span className="text-xs text-gray-400 ml-auto">{patient.source}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 환자 상세
function PatientDetail({ patient }) {
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
      {/* 상단 요약 */}
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
          <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <Phone size={18} />
            전화 걸기
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">연락처</div>
            <div className="font-medium">{patient.phone}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">유입경로</div>
            <div className="font-medium">{patient.source}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">담당</div>
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
          <div className="mt-3 bg-white rounded-xl p-3 flex items-center gap-3">
            <span className="text-rose-500 font-medium">할인</span>
            <span className="px-2 py-1 bg-rose-100 text-rose-600 rounded font-medium text-sm">
              -{patient.discountAmount}만원
            </span>
            {patient.discountReason && (
              <span className="text-sm text-gray-500">({patient.discountReason})</span>
            )}
          </div>
        )}
      </div>

      {/* 상세 내용 */}
      <div className="p-6 space-y-4">
        {/* AI 요약 */}
        <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
          <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
            <Sparkles size={18} />
            AI 통화 요약
          </div>
          <p className="text-gray-700">{patient.aiSummary}</p>
        </div>

        {/* 상담 내용 */}
        {patient.inquiry && (
          <div className="bg-white rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">📞 상담 내용</h3>
            <p className="text-gray-700 leading-relaxed">{patient.inquiry}</p>
          </div>
        )}

        {/* 상담사 메모 */}
        {patient.consultantMemo && (
          <div className="bg-white rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">💬 상담사 메모</h3>
            <p className="text-gray-700 leading-relaxed">{patient.consultantMemo}</p>
          </div>
        )}

        {/* 미동의/보류 사유 */}
        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.disagreeReasons.length > 0 && (
          <div className="bg-white rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              ❌ {patient.status === 'disagreed' ? '미동의 사유' : '보류 사유'}
            </h3>
            <div className="flex flex-wrap gap-2">
              {patient.disagreeReasons.map((reason, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  patient.status === 'disagreed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 시정 계획 */}
        {(patient.status === 'disagreed' || patient.status === 'pending') && patient.correctionPlan && (
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">📝 시정 계획</h3>
            <p className="text-blue-800 leading-relaxed">{patient.correctionPlan}</p>
            {patient.callbackDate && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <span className="text-blue-600 font-medium">📞 콜백: {patient.callbackDate}</span>
              </div>
            )}
          </div>
        )}

        {/* 예약 정보 (동의) */}
        {patient.status === 'agreed' && patient.appointmentDate && (
          <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
            <h3 className="font-semibold text-emerald-900 mb-3">📅 예약 정보</h3>
            <p className="text-2xl font-bold text-emerald-800">{patient.appointmentDate}</p>
          </div>
        )}

        {/* 콜백 예정 (보류) */}
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
export default function DailyReportDetail() {
  const [selectedPatient, setSelectedPatient] = useState(dailyData.patients[0]);
  const [filter, setFilter] = useState('all');

  return (
    <div className="min-h-screen bg-gray-100 flex">
      
      {/* 사이드바 */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-5 border-b">
          <h1 className="text-xl font-bold text-blue-600">CatchAll</h1>
          <p className="text-xs text-gray-400 mt-1">치과 상담 관리</p>
        </div>
        
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Home size={20} />
              <span>대시보드</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Phone size={20} />
              <span>통화 기록</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Users size={20} />
              <span>환자 관리</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Bell size={20} />
              <span>콜백 일정</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-medium">
              <BarChart3 size={20} />
              <span>리포트</span>
            </button>
          </div>
        </nav>

        <div className="p-3 border-t">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
              <User size={18} className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">김상담</div>
              <div className="text-xs text-gray-400">상담사</div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">일별 리포트</h2>
              <p className="text-sm text-gray-500 mt-1">오늘의 상담 내역을 확인하세요</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium">일별</button>
              <button className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">월별</button>
              <div className="w-px h-6 bg-gray-200"></div>
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm">
                <Download size={16} />
                PDF
              </button>
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm">
                <FileText size={16} />
                엑셀
              </button>
            </div>
          </div>
        </div>

        {/* 날짜 선택 */}
        <div className="bg-white border-b px-6 py-3">
          <div className="flex items-center justify-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-400" />
              <span className="font-medium text-gray-900">
                {dailyData.date.replace(/-/g, '.')} ({dailyData.dayOfWeek})
              </span>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="px-6 py-4 bg-gray-100">
          <SummaryCards summary={dailyData.summary} />
        </div>

        {/* 환자 목록 + 상세 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 좌측: 환자 목록 */}
          <div className="w-1/2 border-r bg-white">
            <PatientList
              patients={dailyData.patients}
              selectedId={selectedPatient?.id}
              onSelect={setSelectedPatient}
              filter={filter}
              onFilterChange={setFilter}
            />
          </div>

          {/* 우측: 환자 상세 */}
          <div className="w-1/2">
            <PatientDetail patient={selectedPatient} />
          </div>
        </div>
      </div>
    </div>
  );
}
