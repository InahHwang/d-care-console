import React, { useState } from 'react';
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, Calendar, Check, ChevronRight, Search, Bell, MoreVertical, PhoneCall, FileText, Plus, User, Settings, Home, Users, BarChart3, Sparkles, Play, Loader2, CheckCircle2, TrendingUp, TrendingDown, Flame, Thermometer, Snowflake, ArrowRight, AlertCircle } from 'lucide-react';

export default function DashboardWithAI() {
  const today = {
    totalCalls: 23,
    analyzed: 21,
    analyzing: 2,
    newPatients: 8,
    existingPatients: 10,
    missed: 4,
    other: 1
  };

  const callbacks = [
    { id: 1, name: '김미영', phone: '010-9876-5432', time: '10:00', interest: '임플란트', temperature: 'hot' },
    { id: 2, name: '최민수', phone: '010-7777-8888', time: '14:00', interest: '임플란트', temperature: 'warm' },
    { id: 3, name: null, phone: '010-3333-4444', time: '15:30', interest: '교정', temperature: 'warm' },
  ];

  // 주의 필요 환자
  const alerts = [
    { id: 1, type: 'visited_long', label: '내원완료 7일+', count: 3, patients: ['홍길동', '김철수', '박영희'], color: 'amber' },
    { id: 2, type: 'consulting_long', label: '전화상담 14일+', count: 2, patients: ['송중기', '이민호'], color: 'red' },
    { id: 3, type: 'noshow_risk', label: '내원예약 노쇼 위험', count: 1, patients: ['장동건'], color: 'orange' },
  ];

  const recentPatients = [
    { id: 1, name: '김미영', time: '14:32', interest: '임플란트', temperature: 'hot', status: 'new' },
    { id: 2, name: '이정훈', time: '10:15', interest: '교정', temperature: 'warm', status: 'new' },
    { id: 3, name: '박서연', time: '13:50', interest: '정기검진', temperature: 'warm', status: 'existing' },
  ];

  const analysisQueue = [
    { id: 1, phone: '010-1234-5678', time: '14:15', progress: 75 },
    { id: 2, phone: '010-8888-9999', time: '14:18', progress: 30 },
  ];

  const getTemperatureIcon = (temp) => {
    switch(temp) {
      case 'hot': return <Flame size={14} className="text-red-500" />;
      case 'warm': return <Thermometer size={14} className="text-amber-500" />;
      case 'cold': return <Snowflake size={14} className="text-blue-400" />;
      default: return null;
    }
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
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-medium">
              <Home size={20} />
              <span>대시보드</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Phone size={20} />
              <span>통화 기록</span>
              {analysisQueue.length > 0 && (
                <span className="ml-auto bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {analysisQueue.length}
                </span>
              )}
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Users size={20} />
              <span>환자 관리</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Bell size={20} />
              <span>콜백 일정</span>
              <span className="ml-auto bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {callbacks.length}
              </span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
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

      {/* 메인 컨텐츠 */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">안녕하세요, 김상담님 👋</h2>
              <p className="text-gray-500 mt-1">오늘의 상담 현황을 확인하세요</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
              <Sparkles size={16} />
              <span>AI 분석 활성화</span>
            </div>
          </div>

          {/* 오늘의 통계 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500">총 통화</span>
                <Phone size={20} className="text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{today.totalCalls}</div>
              <div className="text-sm text-emerald-500 flex items-center gap-1 mt-1">
                <TrendingUp size={14} />
                어제보다 5건 증가
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500">신규 환자</span>
                <Users size={20} className="text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-blue-600">{today.newPatients}</div>
              <div className="text-sm text-gray-400 mt-1">
                AI 자동 등록
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500">오늘 콜백</span>
                <Bell size={20} className="text-amber-400" />
              </div>
              <div className="text-3xl font-bold text-amber-600">{callbacks.length}</div>
              <div className="text-sm text-gray-400 mt-1">
                예정된 콜백
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500">부재중</span>
                <PhoneIncoming size={20} className="text-gray-400" />
              </div>
              <div className="text-3xl font-bold text-gray-600">{today.missed}</div>
              <div className="text-sm text-amber-500 flex items-center gap-1 mt-1">
                <AlertCircle size={14} />
                재시도 필요
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            
            {/* 주의 필요 */}
            <div className="bg-white rounded-2xl p-5 border-l-4 border-amber-400">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  주의 필요
                </h3>
              </div>

              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{alert.label}</div>
                      <div className="text-xs text-gray-400">{alert.patients.slice(0, 2).join(', ')}{alert.count > 2 ? ` 외 ${alert.count - 2}명` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        alert.color === 'red' ? 'text-red-500' : 
                        alert.color === 'amber' ? 'text-amber-500' : 'text-orange-500'
                      }`}>{alert.count}명</span>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>

              {alerts.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-sm">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
                  모든 환자 정상 관리 중
                </div>
              )}
            </div>

            {/* AI 분석 현황 */}
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-500" />
                  AI 분석 현황
                </h3>
                <span className="text-xs text-gray-400">오늘</span>
              </div>

              {/* 분석 통계 */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 bg-purple-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">{today.analyzed}</div>
                  <div className="text-xs text-purple-500">분석 완료</div>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-600">{today.analyzing}</div>
                  <div className="text-xs text-gray-500">분석 중</div>
                </div>
              </div>

              {/* 분석 대기열 */}
              {analysisQueue.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 mb-2">분석 중인 통화</div>
                  {analysisQueue.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{item.phone}</span>
                        <span className="text-xs text-gray-400">{item.time}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-purple-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${item.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysisQueue.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-sm">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
                  모든 분석 완료
                </div>
              )}
            </div>

            {/* 오늘의 콜백 */}
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Bell size={18} className="text-amber-500" />
                  오늘의 콜백
                </h3>
                <button className="text-sm text-blue-500 hover:text-blue-600">전체보기</button>
              </div>

              <div className="space-y-3">
                {callbacks.map((cb) => (
                  <div key={cb.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                      <span className="font-bold text-amber-600">{cb.time.split(':')[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {cb.name || cb.phone}
                        </span>
                        {getTemperatureIcon(cb.temperature)}
                      </div>
                      <div className="text-sm text-gray-500">{cb.time} · {cb.interest}</div>
                    </div>
                    <button className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white">
                      <PhoneCall size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {callbacks.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  오늘 예정된 콜백이 없습니다
                </div>
              )}
            </div>

            {/* 최근 등록 환자 */}
            <div className="bg-white rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  최근 등록 환자
                </h3>
                <button className="text-sm text-blue-500 hover:text-blue-600">전체보기</button>
              </div>

              <div className="space-y-3">
                {recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{patient.name}</span>
                        {getTemperatureIcon(patient.temperature)}
                        {patient.status === 'new' && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">신규</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{patient.interest} · {patient.time}</div>
                    </div>
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 오늘의 통화 분류 */}
          <div className="mt-6 bg-white rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">오늘의 통화 분류</h3>
              <button className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                통화 기록 보기 <ArrowRight size={14} />
              </button>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex-1 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">신규 환자</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{today.newPatients}건</div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-600">기존 환자</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{today.existingPatients}건</div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-600">부재중</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{today.missed}건</div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                  <span className="text-gray-600">거래처/기타</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{today.other}건</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
