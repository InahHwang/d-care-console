import React, { useState } from 'react';
import { 
  Phone, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  Circle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  MoreVertical,
  PhoneCall,
  PhoneOff,
  MessageSquare,
  Heart,
  Bell,
  RefreshCw,
  Gift,
  AlertCircle,
  Check,
  X,
  Send,
  Settings,
  History,
  PhoneMissed,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function ScheduleManagement() {
  const [activeTab, setActiveTab] = useState('callback'); // callback, recall, thanks
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  
  // 리콜 서브탭
  const [recallSubTab, setRecallSubTab] = useState('pending'); // settings, pending, history, call-needed

  // 탭 정의
  const tabs = [
    { id: 'callback', label: '콜백', icon: <PhoneCall size={18} />, count: 12 },
    { id: 'recall', label: '리콜', icon: <RefreshCw size={18} />, count: 28 },
    { id: 'thanks', label: '감사인사', icon: <Gift size={18} />, count: 3 },
  ];

  // 리콜 서브탭 정의
  const recallSubTabs = [
    { id: 'settings', label: '발송 설정', icon: <Settings size={16} /> },
    { id: 'pending', label: '발송 대기', icon: <Clock size={16} />, count: 5 },
    { id: 'history', label: '발송 이력', icon: <History size={16} /> },
    { id: 'call-needed', label: '전화 필요', icon: <PhoneMissed size={16} />, count: 3 },
  ];

  // 콜백 더미 데이터
  const callbacks = [
    {
      id: 1,
      patientName: '김미영',
      phone: '010-1234-5678',
      scheduledAt: '2024-01-15 10:00',
      type: 'callback',
      reason: '임플란트 상담 후 가격 검토 중',
      interest: '임플란트',
      temperature: 'hot',
      status: 'pending',
      consultantName: '박상담',
      note: '분납 조건 다시 안내 필요',
      createdAt: '2024-01-12',
    },
    {
      id: 2,
      patientName: '이정수',
      phone: '010-2345-6789',
      scheduledAt: '2024-01-15 11:30',
      type: 'callback',
      reason: '가족 상의 후 연락 주기로 함',
      interest: '교정',
      temperature: 'warm',
      status: 'pending',
      consultantName: '박상담',
      note: '',
      createdAt: '2024-01-10',
    },
    {
      id: 3,
      patientName: '박서연',
      phone: '010-3456-7890',
      scheduledAt: '2024-01-15 14:00',
      type: 'callback',
      reason: '타 병원 비교 중',
      interest: '라미네이트',
      temperature: 'warm',
      status: 'pending',
      consultantName: '김상담',
      note: '가격 경쟁력 강조',
      createdAt: '2024-01-11',
    },
    {
      id: 4,
      patientName: '최민준',
      phone: '010-4567-8901',
      scheduledAt: '2024-01-15 09:00',
      type: 'callback',
      reason: '예약 확정 전화',
      interest: '충치치료',
      temperature: 'hot',
      status: 'completed',
      consultantName: '박상담',
      note: '1/17 오후 3시 예약 완료',
      createdAt: '2024-01-13',
      completedAt: '2024-01-15 09:15',
    },
    {
      id: 5,
      patientName: '정하은',
      phone: '010-5678-9012',
      scheduledAt: '2024-01-14 16:00',
      type: 'callback',
      reason: '상담 후 결정 보류',
      interest: '임플란트',
      temperature: 'cold',
      status: 'missed',
      consultantName: '김상담',
      note: '부재중 - 재시도 필요',
      createdAt: '2024-01-08',
    },
  ];

  // 리콜 발송 설정 더미 데이터
  const recallSettings = [
    {
      id: 1,
      treatment: '스케일링',
      schedules: [
        { id: 1, timing: '6개월 후', message: '정기 스케일링 시기입니다. 건강한 치아를 위해 내원해주세요.', enabled: true },
      ],
    },
    {
      id: 2,
      treatment: '임플란트',
      schedules: [
        { id: 1, timing: '1주 후', message: '수술 부위 불편하신 점 없으신가요? 문의사항이 있으시면 연락주세요.', enabled: true },
        { id: 2, timing: '1개월 후', message: '임플란트 정기 점검 안내드립니다. 내원 예약 부탁드립니다.', enabled: true },
        { id: 3, timing: '6개월 후', message: '임플란트 정기 점검 시기입니다. 내원 예약 부탁드립니다.', enabled: true },
      ],
    },
    {
      id: 3,
      treatment: '교정',
      schedules: [
        { id: 1, timing: '1년 후', message: '유지장치 점검 시기입니다. 교정 후 관리를 위해 내원해주세요.', enabled: true },
      ],
    },
    {
      id: 4,
      treatment: '충치치료',
      schedules: [
        { id: 1, timing: '6개월 후', message: '정기 검진 안내드립니다. 치아 건강 체크를 위해 내원해주세요.', enabled: false },
      ],
    },
  ];

  // 리콜 발송 대기 더미 데이터
  const recallPending = [
    {
      id: 1,
      patientName: '한소희',
      phone: '010-1111-2222',
      treatment: '스케일링',
      timing: '6개월',
      scheduledAt: '2024-01-15 10:00',
      lastVisit: '2023-07-15',
    },
    {
      id: 2,
      patientName: '강동원',
      phone: '010-2222-3333',
      treatment: '임플란트',
      timing: '1개월',
      scheduledAt: '2024-01-15 10:00',
      lastVisit: '2023-12-15',
    },
    {
      id: 3,
      patientName: '송혜교',
      phone: '010-3333-4444',
      treatment: '임플란트',
      timing: '1주',
      scheduledAt: '2024-01-16 10:00',
      lastVisit: '2024-01-09',
    },
  ];

  // 리콜 발송 이력 더미 데이터
  const recallHistory = [
    {
      id: 1,
      patientName: '유재석',
      phone: '010-6666-7777',
      treatment: '스케일링',
      timing: '6개월',
      sentAt: '2024-01-10 10:00',
      status: 'booked',
      bookedAt: '2024-01-15 14:00',
    },
    {
      id: 2,
      patientName: '김종국',
      phone: '010-7777-8888',
      treatment: '임플란트',
      timing: '6개월',
      sentAt: '2024-01-08 10:00',
      status: 'booked',
      bookedAt: '2024-01-20 11:00',
    },
    {
      id: 3,
      patientName: '현빈',
      phone: '010-4444-5555',
      treatment: '임플란트',
      timing: '1개월',
      sentAt: '2024-01-08 10:00',
      status: 'no-response',
      daysPassed: 5,
    },
    {
      id: 4,
      patientName: '공유',
      phone: '010-5555-6666',
      treatment: '스케일링',
      timing: '6개월',
      sentAt: '2024-01-09 10:00',
      status: 'no-response',
      daysPassed: 4,
    },
  ];

  // 전화 필요 (미응답) 더미 데이터
  const callNeeded = recallHistory.filter(item => item.status === 'no-response');

  // 감사인사 더미 데이터
  const thanks = [
    {
      id: 1,
      referrerName: '김미영',
      referrerPhone: '010-1234-5678',
      referredName: '이수진',
      referredPhone: '010-9999-8888',
      referredAt: '2024-01-14',
      status: 'pending',
      note: '',
    },
    {
      id: 2,
      referrerName: '박서연',
      referrerPhone: '010-3456-7890',
      referredName: '최지우',
      referredPhone: '010-8888-7777',
      referredAt: '2024-01-13',
      status: 'pending',
      note: '단골 환자 - 정성껏 감사 표현',
    },
    {
      id: 3,
      referrerName: '한소희',
      referrerPhone: '010-1111-2222',
      referredName: '강민경',
      referredPhone: '010-7777-6666',
      referredAt: '2024-01-10',
      status: 'completed',
      note: '문자 발송 완료',
      completedAt: '2024-01-10',
    },
  ];

  const getTemperatureIcon = (temp) => {
    switch (temp) {
      case 'hot': return <span className="text-lg">🔥</span>;
      case 'warm': return <span className="text-lg">🌡️</span>;
      case 'cold': return <span className="text-lg">❄️</span>;
      default: return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">대기</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">완료</span>;
      case 'missed':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">미연결</span>;
      case 'booked':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">예약완료</span>;
      case 'no-response':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">미응답</span>;
      default:
        return null;
    }
  };

  const filteredCallbacks = callbacks.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const filteredThanks = thanks.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  // 오늘 일정 요약
  const todaySummary = {
    callback: { pending: 3, completed: 1, missed: 1 },
    recall: { pending: 3, callNeeded: 2 },
    thanks: { pending: 2, completed: 1 },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">일정 관리</h1>
            <p className="text-sm text-gray-500 mt-1">콜백, 리콜, 감사인사를 한 곳에서 관리하세요</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* 오늘 요약 카드 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <PhoneCall size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">오늘 콜백</div>
                <div className="text-xl font-bold text-gray-900">5건</div>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-amber-600">대기 3</span>
              <span className="text-emerald-600">완료 1</span>
              <span className="text-red-600">미연결 1</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <RefreshCw size={20} className="text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">오늘 리콜</div>
                <div className="text-xl font-bold text-gray-900">5건</div>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-amber-600">발송대기 3</span>
              <span className="text-red-600">전화필요 2</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <Gift size={20} className="text-rose-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">감사인사</div>
                <div className="text-xl font-bold text-gray-900">3건</div>
              </div>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-amber-600">대기 2</span>
              <span className="text-emerald-600">완료 1</span>
            </div>
          </div>
        </div>

        {/* 메인 탭 */}
        <div className="bg-white rounded-xl border">
          <div className="flex border-b">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
            ))}
          </div>

          {/* 콜백 탭 */}
          {activeTab === 'callback' && (
            <>
              {/* 필터 & 검색 */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    대기
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'completed' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    완료
                  </button>
                  <button
                    onClick={() => setStatusFilter('missed')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'missed' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    미연결
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium min-w-[100px] text-center">
                      2024년 1월 15일
                    </span>
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="환자명, 전화번호 검색"
                      className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 콜백 목록 */}
              <div className="divide-y">
                {filteredCallbacks.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      item.status === 'completed' ? 'bg-gray-50 opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="text-center min-w-[60px]">
                          <div className="text-lg font-bold text-gray-900">
                            {item.scheduledAt.split(' ')[1]}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.scheduledAt.split(' ')[0].slice(5)}
                          </div>
                        </div>

                        <div className="w-px h-16 bg-gray-200"></div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-900">{item.patientName}</span>
                            {getTemperatureIcon(item.temperature)}
                            {getStatusBadge(item.status)}
                          </div>
                          <div className="text-sm text-gray-500 mb-2">{item.phone}</div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {item.interest}
                            </span>
                            <span className="text-sm text-gray-600">{item.reason}</span>
                          </div>
                          {item.note && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <MessageSquare size={14} />
                              {item.note}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                          <>
                            <button className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                              <Phone size={16} />
                              전화
                            </button>
                            <button className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                              <Check size={16} />
                              완료
                            </button>
                          </>
                        )}
                        {item.status === 'missed' && (
                          <button className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                            <RefreshCw size={16} />
                            재시도
                          </button>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-sm text-gray-500">
                            {item.completedAt} 완료
                          </span>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg">
                          <MoreVertical size={18} className="text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 리콜 탭 */}
          {activeTab === 'recall' && (
            <>
              {/* 리콜 서브탭 */}
              <div className="p-4 border-b flex items-center gap-2">
                {recallSubTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRecallSubTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      recallSubTab === tab.id
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.count && (
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        recallSubTab === tab.id ? 'bg-purple-200 text-purple-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 발송 설정 */}
              {recallSubTab === 'settings' && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-gray-900">치료별 자동 발송 설정</h3>
                      <p className="text-sm text-gray-500 mt-1">치료 완료 후 자동으로 알림톡이 발송됩니다</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                      <Plus size={16} />
                      치료 추가
                    </button>
                  </div>

                  <div className="space-y-4">
                    {recallSettings.map((setting) => (
                      <div key={setting.id} className="border rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <span className="font-medium text-gray-900">{setting.treatment}</span>
                          <button className="text-gray-400 hover:text-gray-600">
                            <MoreVertical size={18} />
                          </button>
                        </div>
                        <div className="divide-y">
                          {setting.schedules.map((schedule) => (
                            <div key={schedule.id} className="px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={schedule.enabled} className="sr-only peer" readOnly />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                                <div>
                                  <span className="text-sm font-medium text-gray-900">{schedule.timing}</span>
                                  <p className="text-sm text-gray-500 mt-0.5">{schedule.message}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-gray-100 rounded-lg">
                                  <Edit2 size={16} className="text-gray-400" />
                                </button>
                                <button className="p-2 hover:bg-gray-100 rounded-lg">
                                  <Trash2 size={16} className="text-gray-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="px-4 py-3">
                            <button className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700">
                              <Plus size={16} />
                              발송 시점 추가
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 발송 대기 */}
              {recallSubTab === 'pending' && (
                <div className="divide-y">
                  <div className="p-4 bg-amber-50 flex items-center gap-3">
                    <Clock size={18} className="text-amber-600" />
                    <span className="text-sm text-amber-700">오늘 발송 예정 <strong>{recallPending.filter(p => p.scheduledAt.includes('01-15')).length}건</strong></span>
                  </div>
                  {recallPending.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Send size={18} className="text-purple-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-900">{item.patientName}</span>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                {item.treatment} {item.timing}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mb-1">{item.phone}</div>
                            <div className="text-sm text-gray-500">
                              마지막 방문: {item.lastVisit} · 발송 예정: {item.scheduledAt}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                            <Send size={16} />
                            즉시 발송
                          </button>
                          <button className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300">
                            <X size={16} />
                            취소
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 발송 이력 */}
              {recallSubTab === 'history' && (
                <>
                  <div className="p-4 border-b flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium">
                      전체
                    </button>
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                      예약완료
                    </button>
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                      미응답
                    </button>
                  </div>
                  <div className="divide-y">
                    {recallHistory.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              item.status === 'booked' ? 'bg-emerald-100' : 'bg-red-100'
                            }`}>
                              {item.status === 'booked' ? (
                                <Check size={18} className="text-emerald-600" />
                              ) : (
                                <PhoneMissed size={18} className="text-red-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-900">{item.patientName}</span>
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                  {item.treatment} {item.timing}
                                </span>
                                {getStatusBadge(item.status)}
                              </div>
                              <div className="text-sm text-gray-500 mb-1">{item.phone}</div>
                              <div className="text-sm text-gray-500">
                                발송: {item.sentAt}
                                {item.status === 'booked' && (
                                  <span className="text-emerald-600 ml-2">→ {item.bookedAt} 예약</span>
                                )}
                                {item.status === 'no-response' && (
                                  <span className="text-red-600 ml-2">→ {item.daysPassed}일 경과</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {item.status === 'no-response' && (
                            <button className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                              <Phone size={16} />
                              전화하기
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 전화 필요 */}
              {recallSubTab === 'call-needed' && (
                <div className="divide-y">
                  <div className="p-4 bg-red-50 flex items-center gap-3">
                    <AlertCircle size={18} className="text-red-600" />
                    <span className="text-sm text-red-700">알림톡 발송 후 3일 내 예약이 없는 환자입니다. 직접 전화해주세요.</span>
                  </div>
                  {callNeeded.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <PhoneMissed size={18} className="text-red-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-900">{item.patientName}</span>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                {item.treatment} {item.timing}
                              </span>
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                {item.daysPassed}일 경과
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mb-1">{item.phone}</div>
                            <div className="text-sm text-gray-500">
                              발송일: {item.sentAt}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                            <Phone size={16} />
                            전화
                          </button>
                          <button className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                            <Check size={16} />
                            완료
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 감사인사 탭 */}
          {activeTab === 'thanks' && (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    대기
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === 'completed' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    완료
                  </button>
                </div>

                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="환자명, 전화번호 검색"
                    className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="divide-y">
                {filteredThanks.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      item.status === 'completed' ? 'bg-gray-50 opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center">
                          <Heart size={24} className="text-rose-500" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-gray-900">{item.referrerName}</span>
                            <span className="text-gray-400">님이</span>
                            <span className="font-bold text-blue-600">{item.referredName}</span>
                            <span className="text-gray-400">님을 소개해주셨어요</span>
                            {getStatusBadge(item.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>소개자: {item.referrerPhone}</span>
                            <span>피소개자: {item.referredPhone}</span>
                            <span>소개일: {item.referredAt}</span>
                          </div>
                          {item.note && (
                            <div className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                              <MessageSquare size={14} />
                              {item.note}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                          <>
                            <button className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                              <Phone size={16} />
                              전화
                            </button>
                            <button className="flex items-center gap-1 px-3 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600">
                              <MessageSquare size={16} />
                              문자
                            </button>
                            <button className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
                              <Check size={16} />
                              완료
                            </button>
                          </>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-sm text-gray-500">
                            {item.completedAt} 완료
                          </span>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg">
                          <MoreVertical size={18} className="text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 빈 상태 */}
          {((activeTab === 'callback' && filteredCallbacks.length === 0) ||
            (activeTab === 'thanks' && filteredThanks.length === 0)) && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500">해당하는 일정이 없습니다</p>
            </div>
          )}
        </div>

        {/* 이번 주 요약 */}
        <div className="mt-6 bg-white rounded-xl border p-4">
          <h3 className="font-bold text-gray-900 mb-4">이번 주 일정 요약</h3>
          <div className="grid grid-cols-7 gap-2">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, idx) => (
              <div 
                key={day} 
                className={`text-center p-3 rounded-lg ${
                  idx === 2 ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-gray-50'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">{day}</div>
                <div className="text-lg font-bold text-gray-900">{13 + idx}</div>
                <div className="flex justify-center gap-1 mt-2">
                  {idx < 5 && <div className="w-2 h-2 bg-blue-500 rounded-full" title="콜백"></div>}
                  {idx < 4 && <div className="w-2 h-2 bg-purple-500 rounded-full" title="리콜"></div>}
                  {idx === 2 && <div className="w-2 h-2 bg-rose-500 rounded-full" title="감사인사"></div>}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              콜백
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              리콜
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
              감사인사
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
