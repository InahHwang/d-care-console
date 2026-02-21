import React, { useState } from 'react';
import { Phone, Calendar, ChevronRight, ChevronLeft, Bell, User, Home, Users, BarChart3, TrendingUp, TrendingDown, Minus, MessageSquare, Send, Plus, ChevronDown, ChevronUp, Download, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function MonthlyReportWithFeedback() {
  const [selectedMonth, setSelectedMonth] = useState('2024-01');
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const [newComment, setNewComment] = useState({});

  // 매출 현황
  const revenueStats = {
    target: 8000,
    actual: 6840,
    achievementRate: 85.5,
    prevMonth: 7200,
    growth: -5,
    breakdown: [
      { category: '임플란트', target: 4000, actual: 3200, rate: 80 },
      { category: '교정', target: 2000, actual: 1800, rate: 90 },
      { category: '보철', target: 1000, actual: 920, rate: 92 },
      { category: '일반진료', target: 1000, actual: 920, rate: 92 },
    ]
  };

  // 상담 분석
  const consultationStats = {
    total: 245,
    connected: 198,
    newPatients: 89,
    conversionRate: 36.3,
    prevConversionRate: 32.1,
    // 상담 유형별 분류
    byType: [
      { type: '아웃바운드', label: '아웃바운드', count: 98, connected: 72, newPatients: 32, color: 'blue' },
      { type: '인바운드', label: '인바운드', count: 67, connected: 61, newPatients: 28, color: 'emerald' },
      { type: '구환', label: '구환', count: 52, connected: 48, newPatients: 0, color: 'gray' },
      { type: '소개', label: '소개', count: 28, connected: 17, newPatients: 29, color: 'purple' },
    ],
    funnel: [
      { stage: '전화상담', count: 245, rate: 100 },
      { stage: '내원예약', count: 159, rate: 65 },
      { stage: '내원완료', count: 130, rate: 82 },
      { stage: '치료동의', count: 92, rate: 71 },
      { stage: '치료완료', count: 87, rate: 95 },
    ],
    dropoffAnalysis: [
      { stage: '상담→예약', lost: 86, rate: 35, reasons: ['가격 부담 45%', '타병원 비교 30%', '일정 안 맞음 25%'] },
      { stage: '예약→내원', lost: 29, rate: 18, reasons: ['노쇼 60%', '취소 40%'] },
      { stage: '내원→동의', lost: 38, rate: 29, reasons: ['가격 부담 50%', '치료 두려움 30%', '추가 상의 필요 20%'] },
    ]
  };

  // 환자 통계
  const patientStats = {
    // 연령대별
    byAge: [
      { age: '20대', count: 18, percent: 20 },
      { age: '30대', count: 27, percent: 30 },
      { age: '40대', count: 22, percent: 25 },
      { age: '50대', count: 14, percent: 16 },
      { age: '60대+', count: 8, percent: 9 },
    ],
    // 지역별
    byRegion: [
      { region: '강남구', count: 32, percent: 36 },
      { region: '서초구', count: 21, percent: 24 },
      { region: '송파구', count: 15, percent: 17 },
      { region: '강동구', count: 11, percent: 12 },
      { region: '기타', count: 10, percent: 11 },
    ],
    // 내원경로별
    bySource: [
      { source: '네이버', count: 28, percent: 31, conversion: 42 },
      { source: '외주DB', count: 24, percent: 27, conversion: 33 },
      { source: '소개', count: 19, percent: 21, conversion: 68 },
      { source: '홈페이지', count: 12, percent: 13, conversion: 38 },
      { source: '기타', count: 6, percent: 7, conversion: 25 },
    ],
  };

  // 피드백 질문 및 답변
  const [feedbackItems, setFeedbackItems] = useState([
    {
      id: 1,
      question: '전화 상담 후 미내원하신 환자들의 원인은 무엇이라 생각하나요?',
      managerAnswer: '이번 달 미내원 환자 대부분이 가격 비교를 위해 타 병원 상담을 병행하고 있었습니다. 특히 임플란트 상담 환자의 경우 2~3곳을 비교하는 경향이 뚜렷했고, 저희 병원 가격이 상대적으로 높다는 피드백이 있었습니다. 또한 예약 가능 시간대가 제한적이어서 직장인 환자들이 일정 맞추기 어려워했습니다.',
      managerName: '박상담',
      managerDate: '2024.01.28',
      feedbacks: [
        {
          id: 1,
          author: '원장님',
          content: '가격 경쟁력 부분은 검토해보겠습니다. 일단 상담 시 분납 조건을 좀 더 유연하게 안내해주세요. 무이자 할부 기간도 12개월까지 확대 가능합니다.',
          date: '2024.01.29'
        }
      ]
    },
    {
      id: 2,
      question: '내원 후 치료에 동의하지 않으신 환자분의 원인은 무엇이라 생각하나요?',
      managerAnswer: '진료실 상담 시간이 짧아 환자분들이 충분한 설명을 듣지 못했다고 느끼는 경우가 많았습니다. 특히 고가 치료(임플란트, 교정)의 경우 한 번의 상담으로 결정하기 어려워하셨고, 치료 후기나 케이스 사진을 더 보고 싶다는 요청이 있었습니다.',
      managerName: '김상담',
      managerDate: '2024.01.28',
      feedbacks: [
        {
          id: 1,
          author: '원장님',
          content: '진료실 상담 시간 늘리는 건 현실적으로 어렵고, 상담실에서 케이스 사진 보여주면서 사전 설명을 더 충실히 해주세요. 태블릿에 증례 사진 폴더 정리해서 공유하겠습니다.',
          date: '2024.01.29'
        },
        {
          id: 2,
          author: '원장님',
          content: '그리고 고가 치료는 2차 상담을 권유해서 충분히 고민할 시간을 드리는 것도 방법입니다.',
          date: '2024.01.30'
        }
      ]
    },
    {
      id: 3,
      question: '환자들의 내원, 치료 동의를 이끌어 내기 위해 어떤 부분에서 개선이 필요할까요?',
      subtext: '(진료실, 상담 차원에서 필요한 부분 모두 자유롭게 서술해주세요)',
      managerAnswer: '',
      managerName: '',
      managerDate: '',
      feedbacks: []
    },
    {
      id: 4,
      question: '이번 달 특이사항이나 건의사항이 있으면 작성해주세요.',
      managerAnswer: '소개 환자가 늘어나고 있어서 소개 환자 전용 혜택이 있으면 좋겠습니다. 소개해주신 분과 소개받은 분 모두에게 작은 혜택을 드리면 추가 소개로 이어질 것 같습니다.',
      managerName: '박상담',
      managerDate: '2024.01.28',
      feedbacks: []
    },
  ]);

  const toggleFeedback = (id) => {
    setExpandedFeedback(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getTrendIcon = (current, previous) => {
    if (current > previous) return <TrendingUp size={14} className="text-emerald-500" />;
    if (current < previous) return <TrendingDown size={14} className="text-red-500" />;
    return <Minus size={14} className="text-gray-400" />;
  };

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
              <div className="text-sm font-medium text-gray-900 truncate">김원장</div>
              <div className="text-xs text-gray-400">관리자</div>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">월별 리포트</h2>
              <p className="text-sm text-gray-500 mt-1">월간 성과 분석 및 피드백</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">일별</button>
              <button className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium">월별</button>
              <div className="w-px h-6 bg-gray-200"></div>
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 text-sm">
                <Download size={16} />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* 월 선택 */}
        <div className="bg-white border-b px-6 py-3">
          <div className="flex items-center justify-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-400" />
              <span className="font-medium text-gray-900">2024년 1월</span>
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* 리포트 내용 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* 매출 현황 분석 */}
            <div className="bg-white rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                💰 매출 현황 분석
              </h3>
              
              {/* 매출 요약 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">목표 매출</div>
                  <div className="text-2xl font-bold text-gray-900">{revenueStats.target.toLocaleString()}만원</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-sm text-blue-600 mb-1">실제 매출</div>
                  <div className="text-2xl font-bold text-blue-600">{revenueStats.actual.toLocaleString()}만원</div>
                </div>
                <div className={`rounded-xl p-4 ${revenueStats.achievementRate >= 100 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <div className={`text-sm mb-1 ${revenueStats.achievementRate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>달성률</div>
                  <div className={`text-2xl font-bold ${revenueStats.achievementRate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {revenueStats.achievementRate}%
                  </div>
                </div>
                <div className={`rounded-xl p-4 ${revenueStats.growth >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <div className={`text-sm mb-1 ${revenueStats.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>전월 대비</div>
                  <div className={`text-2xl font-bold flex items-center gap-1 ${revenueStats.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {revenueStats.growth >= 0 ? '+' : ''}{revenueStats.growth}%
                    {revenueStats.growth >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                  </div>
                </div>
              </div>

              {/* 항목별 매출 */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-500 mb-2">항목별 매출</div>
                {revenueStats.breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-20 text-sm text-gray-700">{item.category}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div 
                            className={`h-3 rounded-full ${item.rate >= 90 ? 'bg-emerald-500' : item.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${item.rate}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-medium w-12 ${item.rate >= 90 ? 'text-emerald-600' : item.rate >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                          {item.rate}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right w-32">
                      <span className="text-sm text-gray-500">{item.actual.toLocaleString()}</span>
                      <span className="text-xs text-gray-400"> / {item.target.toLocaleString()}만</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 상담 분석 */}
            <div className="bg-white rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                📊 상담 분석
              </h3>

              {/* 상담 유형별 분류 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {consultationStats.byType.map((item, idx) => (
                  <div key={idx} className={`rounded-xl p-4 ${
                    item.color === 'blue' ? 'bg-blue-50' :
                    item.color === 'emerald' ? 'bg-emerald-50' :
                    item.color === 'purple' ? 'bg-purple-50' : 'bg-gray-50'
                  }`}>
                    <div className={`text-sm mb-1 ${
                      item.color === 'blue' ? 'text-blue-600' :
                      item.color === 'emerald' ? 'text-emerald-600' :
                      item.color === 'purple' ? 'text-purple-600' : 'text-gray-600'
                    }`}>{item.label}</div>
                    <div className={`text-2xl font-bold ${
                      item.color === 'blue' ? 'text-blue-700' :
                      item.color === 'emerald' ? 'text-emerald-700' :
                      item.color === 'purple' ? 'text-purple-700' : 'text-gray-700'
                    }`}>{item.count}건</div>
                    <div className="text-xs text-gray-500 mt-1">
                      연결 {item.connected} · 신규 {item.newPatients}
                    </div>
                  </div>
                ))}
              </div>

              {/* 상담 요약 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">총 상담</div>
                  <div className="text-2xl font-bold text-gray-900">{consultationStats.total}건</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">연결 성공</div>
                  <div className="text-2xl font-bold text-gray-900">{consultationStats.connected}건</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-sm text-blue-600 mb-1">신규 환자</div>
                  <div className="text-2xl font-bold text-blue-600">{consultationStats.newPatients}명</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="text-sm text-emerald-600 mb-1">전환율</div>
                  <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
                    {consultationStats.conversionRate}%
                    {getTrendIcon(consultationStats.conversionRate, consultationStats.prevConversionRate)}
                  </div>
                </div>
              </div>

              {/* 퍼널 분석 */}
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-500 mb-3">상담 퍼널</div>
                <div className="flex items-center justify-between">
                  {consultationStats.funnel.map((stage, idx) => (
                    <React.Fragment key={idx}>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">{stage.stage}</div>
                        <div className="text-xl font-bold text-gray-900">{stage.count}</div>
                        {idx > 0 && (
                          <div className={`text-xs mt-1 ${stage.rate >= 80 ? 'text-emerald-500' : stage.rate >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                            {stage.rate}%
                          </div>
                        )}
                      </div>
                      {idx < consultationStats.funnel.length - 1 && (
                        <ChevronRight size={20} className="text-gray-300" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* 이탈 분석 */}
              <div>
                <div className="text-sm font-medium text-gray-500 mb-3">이탈 분석</div>
                <div className="space-y-3">
                  {consultationStats.dropoffAnalysis.map((item, idx) => (
                    <div key={idx} className="bg-rose-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle size={16} className="text-rose-500" />
                          <span className="font-medium text-gray-900">{item.stage}</span>
                        </div>
                        <div className="text-rose-600 font-bold">{item.lost}명 이탈 ({item.rate}%)</div>
                      </div>
                      <div className="flex gap-2">
                        {item.reasons.map((reason, i) => (
                          <span key={i} className="px-2 py-1 bg-white rounded text-xs text-gray-600">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 피드백 섹션 */}
            <div className="bg-white rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                👥 환자 통계
              </h3>

              <div className="grid grid-cols-3 gap-6">
                {/* 연령대별 */}
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-3">연령대별</div>
                  <div className="space-y-2">
                    {patientStats.byAge.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-12 text-sm text-gray-600">{item.age}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-5 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${item.percent}%`, minWidth: '30px' }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                        <div className="w-10 text-right text-sm text-gray-500">{item.percent}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 지역별 */}
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-3">지역별</div>
                  <div className="space-y-2">
                    {patientStats.byRegion.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-14 text-sm text-gray-600">{item.region}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-5 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${item.percent}%`, minWidth: '30px' }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                        <div className="w-10 text-right text-sm text-gray-500">{item.percent}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 내원경로별 */}
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-3">내원경로별</div>
                  <div className="space-y-2">
                    {patientStats.bySource.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-14 text-sm text-gray-600">{item.source}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div 
                            className="bg-purple-500 h-5 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${item.percent}%`, minWidth: '30px' }}
                          >
                            <span className="text-xs text-white font-medium">{item.count}</span>
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm text-gray-500">{item.percent}%</span>
                          <span className={`text-xs ml-1 ${item.conversion >= 50 ? 'text-emerald-500' : 'text-gray-400'}`}>
                            ({item.conversion}%↗)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">* 괄호 안은 신규환자 전환율</div>
                </div>
              </div>
            </div>

            {/* 피드백 섹션 */}
            <div className="bg-white rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                💬 월간 피드백
              </h3>

              <div className="space-y-6">
                {feedbackItems.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* 질문 */}
                    <div className="bg-gray-50 px-5 py-4">
                      <div className="font-medium text-gray-900">{item.id}. {item.question}</div>
                      {item.subtext && (
                        <div className="text-sm text-gray-500 mt-1">{item.subtext}</div>
                      )}
                    </div>

                    {/* 매니저 답변 */}
                    <div className="px-5 py-4 border-b">
                      {item.managerAnswer ? (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                              <User size={14} className="text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900">{item.managerName}</span>
                            <span className="text-xs text-gray-400">{item.managerDate}</span>
                          </div>
                          <p className="text-gray-700 leading-relaxed pl-9">{item.managerAnswer}</p>
                        </div>
                      ) : (
                        <div className="text-gray-400 italic">
                          매니저 의견을 추가하려면 편집 버튼을 클릭하세요.
                        </div>
                      )}
                    </div>

                    {/* 원장님 피드백 */}
                    <div className="bg-blue-50 px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-blue-700">
                          <MessageSquare size={16} />
                          <span className="font-medium">원장님 피드백</span>
                          {item.feedbacks.length > 0 && (
                            <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                              {item.feedbacks.length}
                            </span>
                          )}
                        </div>
                        <button 
                          className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-sm hover:bg-blue-100 flex items-center gap-1"
                        >
                          <Plus size={14} />
                          피드백 추가
                        </button>
                      </div>

                      {/* 기존 피드백 목록 */}
                      {item.feedbacks.length > 0 ? (
                        <div className="space-y-3">
                          {item.feedbacks.map((fb) => (
                            <div key={fb.id} className="bg-white rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                </div>
                                <span className="font-medium text-gray-900 text-sm">{fb.author}</span>
                                <span className="text-xs text-gray-400">{fb.date}</span>
                              </div>
                              <p className="text-gray-700 text-sm pl-8">{fb.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-blue-400 text-sm">
                          아직 피드백이 없습니다.
                        </div>
                      )}

                      {/* 새 피드백 입력 */}
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          placeholder="피드백을 입력하세요..."
                          className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={newComment[item.id] || ''}
                          onChange={(e) => setNewComment({ ...newComment, [item.id]: e.target.value })}
                        />
                        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1">
                          <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
