// src/components/settings/GoalSettings.tsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { loadGoalsFromServer, saveGoalsToServer, clearError } from '@/store/slices/goalsSlice';
import { HiOutlineTag, HiOutlineSave, HiOutlineRefresh, HiOutlineExclamationCircle } from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';

const GoalSettings: React.FC = () => {
  const dispatch = useDispatch();
  const { currentMonth, isLoading, error, lastUpdated } = useSelector((state: RootState) => state.goals);
  
  const [targets, setTargets] = useState({
    newPatients: currentMonth.newPatients.target,
    appointments: currentMonth.appointments.target,
  });
  
  const [showSuccess, setShowSuccess] = useState(false);

  // 컴포넌트 마운트 시 서버에서 목표 불러오기
  useEffect(() => {
    dispatch(loadGoalsFromServer() as any);
  }, [dispatch]);

  // Redux 상태가 변경되면 로컬 상태도 업데이트
  useEffect(() => {
    setTargets({
      newPatients: currentMonth.newPatients.target,
      appointments: currentMonth.appointments.target,
    });
  }, [currentMonth.newPatients.target, currentMonth.appointments.target]);

  // 에러 상태 클리어
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  const handleSave = async () => {
    try {
      const result = await dispatch(saveGoalsToServer({
        newPatientsTarget: targets.newPatients,
        appointmentsTarget: targets.appointments,
      }) as any);
      
      if (result.type === 'goals/saveToServer/fulfilled') {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('목표 저장 중 오류:', error);
    }
  };

  const handleReset = () => {
    const defaultTargets = {
      newPatients: 30,
      appointments: 50,
    };
    
    setTargets(defaultTargets);
  };

  const handleRefresh = () => {
    dispatch(loadGoalsFromServer() as any);
  };

  const getCurrentMonthName = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  };

  const formatLastUpdated = (dateString: string | null) => {
    if (!dateString) return '설정되지 않음';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return '방금 전';
    if (diffHours < 1) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon icon={HiOutlineTag} size={24} className="text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-text-primary">월간 목표 설정</h3>
            <p className="text-sm text-text-secondary">
              {getCurrentMonthName()} 신규 환자 및 예약 목표를 설정하세요
            </p>
          </div>
        </div>
        
        {/* 새로고침 버튼 */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1 text-sm text-text-secondary hover:text-primary hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
        >
          <Icon icon={HiOutlineRefresh} size={16} className={isLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 마지막 업데이트 정보 */}
      {lastUpdated && (
        <div className="text-xs text-text-muted bg-gray-50 p-2 rounded">
          마지막 업데이트: {formatLastUpdated(lastUpdated)}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Icon icon={HiOutlineExclamationCircle} size={20} className="text-red-500" />
            <span className="text-red-800 text-sm font-medium">오류가 발생했습니다</span>
          </div>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* 성공 메시지 */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-800 text-sm font-medium">
              목표가 성공적으로 저장되었습니다!
            </span>
          </div>
        </div>
      )}

      {/* 현재 달성 현황 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">신규 환자 현황</h4>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {currentMonth.newPatients.current}
            </span>
            <span className="text-blue-600">/ {currentMonth.newPatients.target}명</span>
          </div>
          <div className="mt-2">
            <div className="text-xs text-blue-600 mb-1">
              달성률: {currentMonth.newPatients.percentage}%
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(currentMonth.newPatients.percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 mb-2">예약 현황</h4>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-green-600">
              {currentMonth.appointments.current}
            </span>
            <span className="text-green-600">/ {currentMonth.appointments.target}건</span>
          </div>
          <div className="mt-2">
            <div className="text-xs text-green-600 mb-1">
              달성률: {currentMonth.appointments.percentage}%
            </div>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(currentMonth.appointments.percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 목표 설정 폼 */}
      <div className="card p-6">
        <h4 className="text-md font-semibold text-text-primary mb-4">목표 수정</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 신규 환자 목표 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              신규 환자 목표 (명)
            </label>
            <input
              type="number"
              min="0"
              value={targets.newPatients}
              onChange={(e) => setTargets(prev => ({ 
                ...prev, 
                newPatients: parseInt(e.target.value) || 0 
              }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="예: 30"
              disabled={isLoading}
            />
            <p className="text-xs text-text-muted mt-1">
              이번 달 신규 환자 유치 목표를 설정하세요
            </p>
          </div>

          {/* 예약 목표 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              예약 목표 (건)
            </label>
            <input
              type="number"
              min="0"
              value={targets.appointments}
              onChange={(e) => setTargets(prev => ({ 
                ...prev, 
                appointments: parseInt(e.target.value) || 0 
              }))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="예: 50"
              disabled={isLoading}
            />
            <p className="text-xs text-text-muted mt-1">
              이번 달 예약 건수 목표를 설정하세요
            </p>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon={HiOutlineSave} size={16} />
            {isLoading ? '저장 중...' : '목표 저장'}
          </button>
          
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="btn-secondary flex items-center gap-2"
          >
            <Icon icon={HiOutlineRefresh} size={16} />
            기본값으로
          </button>
        </div>
      </div>

      {/* 도움말 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-800 mb-2">💡 목표 설정 팁</h5>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 현실적이고 달성 가능한 목표를 설정하세요</li>
          <li>• 이전 달 성과를 참고하여 10-20% 향상된 목표를 권장합니다</li>
          <li>• 목표는 언제든지 수정할 수 있습니다</li>
          <li>• 달성률은 실시간으로 대시보드에 반영됩니다</li>
          <li>• <strong>설정한 목표는 서버에 저장되어 모든 컴퓨터에서 동일하게 표시됩니다</strong></li>
        </ul>
      </div>
    </div>
  );
};

export default GoalSettings;