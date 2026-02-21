import React, { useState } from 'react';
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, Calendar, Check, ChevronRight, Play, Sparkles, MapPin, MessageSquare, Tag, Bell, MoreVertical, Edit2, Trash2, PhoneCall, FileText, Plus, User, Settings, Home, Users, BarChart3, Mic, X, ChevronDown, CheckCircle2, AlertTriangle, Flame, Thermometer, Snowflake, History, TrendingUp } from 'lucide-react';

export default function PatientDetailWithAI() {
  const [activeTab, setActiveTab] = useState('timeline');
  const [isEditing, setIsEditing] = useState(false);
  
  const patient = {
    name: '김미영',
    phone: '010-9876-5432',
    status: 'consulting',
    statusLabel: '상담중',
    registeredAt: '2024.01.15',
    registeredBy: 'AI 자동',
    source: '외주DB',
    temperature: 'hot',
    aiConfidence: 94
  };

  const aiExtracted = {
    interest: '임플란트',
    subInterest: '앞니',
    priceRange: '상담 필요',
    preferredTime: '오전',
    preferredDay: '다음주',
    concerns: ['가격', '통증', '기간'],
    competitor: null
  };

  const callback = {
    date: '1/17',
    day: '금',
    time: '10:00',
    reason: '가격 안내 및 내원 일정 조율'
  };

  const timeline = [
    {
      id: 1,
      type: 'call',
      direction: 'outbound',
      date: '2024.01.15',
      time: '14:32',
      duration: '03:24',
      hasRecording: true,
      aiSummary: '앞니 임플란트 상담. 가격 문의, 다음주 내원 희망. 오전 선호.',
      aiTags: ['가격문의', '내원희망', '오전선호'],
      isFirst: true
    }
  ];

  const getTemperatureStyle = (temp) => {
    switch(temp) {
      case 'hot': return { icon: <Flame size={16} />, color: 'text-red-500', bg: 'bg-red-50', label: '높음' };
      case 'warm': return { icon: <Thermometer size={16} />, color: 'text-amber-500', bg: 'bg-amber-50', label: '중간' };
      case 'cold': return { icon: <Snowflake size={16} />, color: 'text-blue-400', bg: 'bg-blue-50', label: '낮음' };
      default: return null;
    }
  };

  const tempStyle = getTemperatureStyle(patient.temperature);

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
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-medium">
              <Users size={20} />
              <span>환자 관리</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl">
              <Bell size={20} />
              <span>콜백 일정</span>
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
      <div className="flex-1 flex flex-col">
        
        {/* 헤더 */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-gray-600">← 환자 목록</button>
              <span className="text-gray-300">|</span>
              <h2 className="text-lg font-bold text-gray-900">{patient.name}</h2>
              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                신규
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                {patient.statusLabel}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                <MessageSquare size={18} />
                알림톡
              </button>
              <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2">
                <PhoneCall size={18} />
                전화하기
              </button>
            </div>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-3 gap-6">
              
              {/* 좌측: 환자 정보 */}
              <div className="space-y-4">
                
                {/* 기본 정보 + AI 뱃지 */}
                <div className="bg-white rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{patient.name}</h3>
                      <div className="flex items-center gap-2 text-gray-500 mt-1">
                        <Phone size={16} />
                        {patient.phone}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${tempStyle.bg} ${tempStyle.color}`}>
                      {tempStyle.icon}
                      <span className="text-xs font-medium">{tempStyle.label}</span>
                    </div>
                  </div>

                  {/* AI 자동 등록 표시 */}
                  <div className="bg-purple-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-purple-700 text-sm">
                      <Sparkles size={16} />
                      <span className="font-medium">AI 자동 등록</span>
                      <span className="text-purple-500 ml-auto">신뢰도 {patient.aiConfidence}%</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">관심 시술</span>
                      <span className="font-medium text-gray-900">{aiExtracted.interest} ({aiExtracted.subInterest})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">유입 경로</span>
                      <span className="font-medium text-gray-900">{patient.source}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">선호 시간</span>
                      <span className="font-medium text-gray-900">{aiExtracted.preferredTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">내원 희망</span>
                      <span className="font-medium text-gray-900">{aiExtracted.preferredDay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">등록일</span>
                      <span className="font-medium text-gray-900">{patient.registeredAt}</span>
                    </div>
                  </div>

                  {/* AI 추출 관심사 */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-500 mb-2">주요 관심사 (AI 추출)</div>
                    <div className="flex flex-wrap gap-2">
                      {aiExtracted.concerns.map((concern, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {concern}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="mt-4 w-full py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-center gap-1"
                  >
                    <Edit2 size={14} />
                    정보 수정
                  </button>
                </div>

                {/* 콜백 예약 */}
                {callback && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200 relative">
                    <div className="absolute -top-2 left-4">
                      <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <Bell size={12} />
                        콜백 예약
                      </span>
                    </div>
                    
                    <div className="mt-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm">
                          <span className="text-lg font-bold text-gray-900">{callback.date.split('/')[1]}</span>
                          <span className="text-xs text-gray-500">{callback.day}</span>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-gray-900">{callback.time}</div>
                          <div className="text-sm text-amber-600">2일 후</div>
                        </div>
                      </div>
                      
                      <p className="mt-3 pt-3 border-t border-amber-200 text-sm text-gray-600">
                        {callback.reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* 빠른 액션 */}
                <div className="bg-white rounded-2xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">빠른 액션</h4>
                  <div className="space-y-2">
                    <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg">
                      <span className="text-gray-700">내원 예약 등록</span>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>
                    <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg">
                      <span className="text-gray-700">콜백 수정</span>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>
                    <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 rounded-lg text-red-500">
                      <span>환자 삭제</span>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 중앙 + 우측: 타임라인 */}
              <div className="col-span-2">
                <div className="bg-white rounded-2xl">
                  {/* 탭 */}
                  <div className="flex border-b">
                    <button 
                      onClick={() => setActiveTab('timeline')}
                      className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                        activeTab === 'timeline' 
                          ? 'text-blue-600 border-blue-600' 
                          : 'text-gray-500 border-transparent hover:text-gray-700'
                      }`}
                    >
                      타임라인
                    </button>
                    <button 
                      onClick={() => setActiveTab('memo')}
                      className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                        activeTab === 'memo' 
                          ? 'text-blue-600 border-blue-600' 
                          : 'text-gray-500 border-transparent hover:text-gray-700'
                      }`}
                    >
                      메모
                    </button>
                  </div>

                  <div className="p-5">
                    {activeTab === 'timeline' && (
                      <div className="space-y-4">
                        {/* 메모 입력 */}
                        <div className="border border-gray-200 rounded-xl p-4">
                          <textarea
                            placeholder="상담 메모 추가..."
                            rows={2}
                            className="w-full resize-none focus:outline-none text-gray-700"
                          />
                          <div className="flex justify-end mt-2">
                            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium">
                              저장
                            </button>
                          </div>
                        </div>

                        {/* 타임라인 아이템들 */}
                        <div className="relative">
                          {/* 타임라인 라인 */}
                          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                          <div className="space-y-4">
                            {/* 환자 등록 이벤트 */}
                            <div className="relative flex gap-4">
                              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center z-10">
                                <Sparkles size={18} className="text-purple-600" />
                              </div>
                              <div className="flex-1 bg-purple-50 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-purple-700">AI 자동 등록</span>
                                  <span className="text-sm text-gray-500">오늘 14:32</span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  통화 분석 결과 신규 환자로 자동 등록되었습니다.
                                </p>
                              </div>
                            </div>

                            {/* 통화 이벤트 */}
                            {timeline.map((item) => (
                              <div key={item.id} className="relative flex gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                                  item.direction === 'outbound' ? 'bg-blue-100' : 'bg-green-100'
                                }`}>
                                  {item.direction === 'outbound' ? (
                                    <PhoneOutgoing size={18} className="text-blue-600" />
                                  ) : (
                                    <PhoneIncoming size={18} className="text-green-600" />
                                  )}
                                </div>
                                <div className="flex-1 bg-gray-50 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">
                                        {item.direction === 'outbound' ? '발신' : '수신'} 통화
                                      </span>
                                      <span className="text-sm text-gray-500">{item.duration}</span>
                                      {item.isFirst && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                          첫 통화
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-sm text-gray-500">{item.date} {item.time}</span>
                                  </div>
                                  
                                  {/* AI 요약 */}
                                  <div className="bg-white rounded-lg p-3 mb-3">
                                    <div className="flex items-center gap-1 text-purple-600 text-xs mb-2">
                                      <Sparkles size={12} />
                                      AI 요약
                                    </div>
                                    <p className="text-sm text-gray-700">{item.aiSummary}</p>
                                  </div>

                                  {/* AI 태그 */}
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {item.aiTags.map((tag, idx) => (
                                      <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>

                                  {/* 녹취 재생 */}
                                  {item.hasRecording && (
                                    <button className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm">
                                      <Play size={14} fill="currentColor" />
                                      녹취 재생
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* 콜백 예약 이벤트 */}
                            {callback && (
                              <div className="relative flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center z-10">
                                  <Bell size={18} className="text-amber-600" />
                                </div>
                                <div className="flex-1 bg-amber-50 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-amber-700">콜백 예약됨</span>
                                    <span className="text-sm text-gray-500">오늘 14:35</span>
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    {callback.date}({callback.day}) {callback.time} - {callback.reason}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'memo' && (
                      <div className="space-y-4">
                        <div className="border border-gray-200 rounded-xl p-4">
                          <textarea
                            placeholder="상담 메모를 입력하세요..."
                            rows={4}
                            className="w-full resize-none focus:outline-none text-gray-700"
                          />
                          <div className="flex justify-end mt-3 pt-3 border-t">
                            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium">
                              저장
                            </button>
                          </div>
                        </div>

                        <div className="text-center py-8 text-gray-400">
                          아직 작성된 메모가 없습니다
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
