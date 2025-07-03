// src/components/admin/DailyTasksManagement.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/hooks/reduxHooks';
import { 
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlinePhone,
  HiOutlineUserGroup,
  HiOutlineClipboardCheck,
  HiOutlineExclamationCircle,
  HiOutlineChevronDown,
  HiOutlineChevronRight
} from 'react-icons/hi';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DailyTaskSummary {
  date: string;
  userTasks: UserTaskSummary[];
  totalTasks: number;
  taskBreakdown: TaskBreakdown;
}

interface UserTaskSummary {
  userId: string;
  userName: string;
  tasks: ProcessedTask[];
  totalCount: number;
  taskCounts: {
    callbackComplete: number;
    callbackRegistered: number;
    scheduledCallHandled: number;
    patientUpdated: number;
    consultationCompleted: number;
  };
}

interface ProcessedTask {
  _id: string;
  taskType: 'callback_complete' | 'callback_create' | 'patient_update' | 'consultation_complete' | 'scheduled_call';
  taskTypeName: string;
  patientName: string;
  patientPhone: string;
  details: string;
  timestamp: string;
  originalAction: string;
}

interface TaskBreakdown {
  callbackComplete: number;
  callbackRegistered: number;
  scheduledCallHandled: number;
  patientUpdated: number;
  consultationCompleted: number;
}

export default function DailyTasksManagement() {
  const [dailyTasks, setDailyTasks] = useState<DailyTaskSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [users, setUsers] = useState<Array<{_id: string, name: string}>>([]);

  const { user: currentUser } = useAppSelector(state => state.auth);

  useEffect(() => {
    fetchUsers();
    fetchDailyTasks();
  }, [selectedDate]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchDailyTasks = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        date: selectedDate,
        ...(selectedUser && { userId: selectedUser }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/admin/daily-tasks?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDailyTasks(data.dailyTasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch daily tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'callback_complete':
        return HiOutlineCheckCircle;
      case 'callback_create':
        return HiOutlinePhone;
      case 'patient_update':
        return HiOutlineUserGroup;
      case 'consultation_complete':
        return HiOutlineClipboardCheck;
      case 'scheduled_call':
        return HiOutlineCalendar;
      default:
        return HiOutlineCheckCircle;
    }
  };

  const getTaskColor = (taskType: string) => {
    switch (taskType) {
      case 'callback_complete':
        return 'text-green-600 bg-green-100';
      case 'callback_create':
        return 'text-blue-600 bg-blue-100';
      case 'patient_update':
        return 'text-yellow-600 bg-yellow-100';
      case 'consultation_complete':
        return 'text-purple-600 bg-purple-100';
      case 'scheduled_call':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getQuickDateButtons = () => {
    const today = new Date();
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const date = subDays(today, i);
      dates.push({
        date: format(date, 'yyyy-MM-dd'),
        label: i === 0 ? '오늘' : i === 1 ? '어제' : format(date, 'M/d', { locale: ko }),
        fullLabel: format(date, 'yyyy년 M월 d일', { locale: ko })
      });
    }
    
    return dates;
  };

  const currentDayData = dailyTasks.find(day => day.date === selectedDate);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">오늘 처리된 업무</h2>
          <p className="text-gray-600 mt-1">
            매니저들이 처리한 콜백, 환자 업데이트, 상담 완료 등의 업무를 확인할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDailyTasks}
            className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <HiOutlineRefresh className="w-4 h-4 mr-2" />
            새로고침
          </button>
        </div>
      </div>

      {/* 날짜 선택 및 필터 */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* 빠른 날짜 선택 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">빠른 선택:</span>
            <div className="flex items-center space-x-2">
              {getQuickDateButtons().map((dateBtn) => (
                <button
                  key={dateBtn.date}
                  onClick={() => setSelectedDate(dateBtn.date)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    selectedDate === dateBtn.date
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={dateBtn.fullLabel}
                >
                  {dateBtn.label}
                </button>
              ))}
            </div>
          </div>

          {/* 사용자 정의 날짜 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <HiOutlineCalendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">전체 사용자</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="환자명, 전화번호 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchDailyTasks()}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 선택된 날짜의 요약 */}
      {currentDayData && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {format(new Date(selectedDate), 'yyyy년 M월 d일', { locale: ko })} 업무 요약
            </h3>
            <div className="text-sm text-gray-500">
              총 {currentDayData.totalTasks}건 처리
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center">
                <HiOutlineCheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-900">콜백 완료</span>
              </div>
              <div className="text-2xl font-bold text-green-600 mt-2">
                {currentDayData.taskBreakdown.callbackComplete}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center">
                <HiOutlinePhone className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">콜백 등록</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-2">
                {currentDayData.taskBreakdown.callbackRegistered}
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center">
                <HiOutlineCalendar className="w-5 h-5 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-orange-900">예정된 콜</span>
              </div>
              <div className="text-2xl font-bold text-orange-600 mt-2">
                {currentDayData.taskBreakdown.scheduledCallHandled}
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center">
                <HiOutlineUserGroup className="w-5 h-5 text-yellow-600 mr-2" />
                <span className="text-sm font-medium text-yellow-900">환자 업데이트</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600 mt-2">
                {currentDayData.taskBreakdown.patientUpdated}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center">
                <HiOutlineClipboardCheck className="w-5 h-5 text-purple-600 mr-2" />
                <span className="text-sm font-medium text-purple-900">상담 완료</span>
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-2">
                {currentDayData.taskBreakdown.consultationCompleted}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 사용자별 업무 상세 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">업무 데이터를 불러오는 중...</span>
          </div>
        ) : currentDayData?.userTasks.length === 0 ? (
          <div className="text-center py-12">
            <HiOutlineExclamationCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">처리된 업무가 없습니다</h3>
            <p className="text-gray-500">
              {format(new Date(selectedDate), 'yyyy년 M월 d일', { locale: ko })}에 처리된 업무가 없습니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {currentDayData?.userTasks.map((userTask) => (
              <div key={userTask.userId} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleUserExpansion(userTask.userId)}
                      className="flex items-center space-x-2 text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
                    >
                      {expandedUsers.has(userTask.userId) ? (
                        <HiOutlineChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <HiOutlineChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {userTask.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{userTask.userName}</h4>
                        <p className="text-sm text-gray-500">총 {userTask.totalCount}건 처리</p>
                      </div>
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>콜백완료 {userTask.taskCounts.callbackComplete}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>콜백등록 {userTask.taskCounts.callbackRegistered}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>예정콜 {userTask.taskCounts.scheduledCallHandled}</span>
                    </div>
                  </div>
                </div>

                {expandedUsers.has(userTask.userId) && (
                  <div className="mt-4 ml-10">
                    <div className="space-y-3">
                      {userTask.tasks.map((task) => {
                        const IconComponent = getTaskIcon(task.taskType);
                        const colorClasses = getTaskColor(task.taskType);
                        
                        return (
                          <div key={task._id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClasses}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="font-medium text-gray-900">{task.taskTypeName}</h5>
                                  <p className="text-sm text-gray-600">
                                    {task.patientName} ({task.patientPhone})
                                  </p>
                                  {task.details && (
                                    <p className="text-sm text-gray-500 mt-1">{task.details}</p>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {format(new Date(task.timestamp), 'HH:mm:ss', { locale: ko })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}