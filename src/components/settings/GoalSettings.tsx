// src/components/settings/GoalSettings.tsx
import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { setGoalTargets } from '@/store/slices/goalsSlice';
import { HiOutlineTag, HiOutlineSave, HiOutlineRefresh } from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';

const GoalSettings: React.FC = () => {
  const dispatch = useDispatch();
  const { currentMonth } = useSelector((state: RootState) => state.goals);
  
  const [targets, setTargets] = useState({
    newPatients: currentMonth.newPatients.target,
    appointments: currentMonth.appointments.target,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 컴포넌트 마운트 시 localStorage에서 목표 불러오기
  useEffect(() => {
    const loadGoalsFromStorage = () => {
      try {
        const savedGoals = localStorage.getItem('monthlyGoals');
        if (savedGoals) {
          const parsedGoals = JSON.parse(savedGoals);
          const currentMonthKey = getCurrentMonthKey();
          
          // 현재 월의 목표가 저장되어 있다면 사용
          if (parsedGoals[currentMonthKey]) {
            const monthlyGoals = parsedGoals[currentMonthKey];
            setTargets({
              newPatients: monthlyGoals.newPatients || currentMonth.newPatients.target,
              appointments: monthlyGoals.appointments || currentMonth.appointments.target,
            });
            
            // Redux 스토어에도 반영
            dispatch(setGoalTargets({
              newPatientsTarget: monthlyGoals.newPatients || currentMonth.newPatients.target,
              appointmentsTarget: monthlyGoals.appointments || currentMonth.appointments.target,
            }));
          }
        }
      } catch (error) {
        console.error('목표 불러오기 중 오류:', error);
      }
    };

    loadGoalsFromStorage();
  }, [dispatch, currentMonth.newPatients.target, currentMonth.appointments.target]);

  // 현재 월 키 생성 함수
  const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // localStorage에 목표 저장하는 함수
  const saveGoalsToStorage = (newTargets: typeof targets) => {
    try {
      const currentMonthKey = getCurrentMonthKey();
      const existingGoals = JSON.parse(localStorage.getItem('monthlyGoals') || '{}');
      
      existingGoals[currentMonthKey] = {
        newPatients: newTargets.newPatients,
        appointments: newTargets.appointments,
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('monthlyGoals', JSON.stringify(existingGoals));
    } catch (error) {
      console.error('목표 저장 중 오류:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Redux 스토어에 목표 설정 저장
      dispatch(setGoalTargets({
        newPatientsTarget: targets.newPatients,
        appointmentsTarget: targets.appointments,
      }));
      
      // localStorage에 목표 저장
      saveGoalsToStorage(targets);
      
      // 성공 메시지 표시
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      
      // 실제 프로젝트에서는 여기서 API 호출
      // await api.saveGoalTargets(targets);
      
    } catch (error) {
      console.error('목표 저장 중 오류:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaultTargets = {
      newPatients: 30, // 기본값
      appointments: 50, // 기본값
    };
    
    setTargets(defaultTargets);
    
    // localStorage에서도 현재 월 목표 제거
    try {
      const currentMonthKey = getCurrentMonthKey();
      const existingGoals = JSON.parse(localStorage.getItem('monthlyGoals') || '{}');
      delete existingGoals[currentMonthKey];
      localStorage.setItem('monthlyGoals', JSON.stringify(existingGoals));
    } catch (error) {
      console.error('목표 초기화 중 오류:', error);
    }
  };

  const getCurrentMonthName = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Icon icon={HiOutlineTag} size={24} className="text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-text-primary">월간 목표 설정</h3>
          <p className="text-sm text-text-secondary">
            {getCurrentMonthName()} 신규 환자 및 예약 목표를 설정하세요
          </p>
        </div>
      </div>

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
            <span className="text-blue-600">/ {targets.newPatients}명</span>
          </div>
          <div className="mt-2">
            <div className="text-xs text-blue-600 mb-1">
              달성률: {Math.round((currentMonth.newPatients.current / targets.newPatients) * 100)}%
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((currentMonth.newPatients.current / targets.newPatients) * 100, 100)}%` }}
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
            <span className="text-green-600">/ {targets.appointments}건</span>
          </div>
          <div className="mt-2">
            <div className="text-xs text-green-600 mb-1">
              달성률: {Math.round((currentMonth.appointments.current / targets.appointments) * 100)}%
            </div>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((currentMonth.appointments.current / targets.appointments) * 100, 100)}%` }}
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
            disabled={isSaving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon={HiOutlineSave} size={16} />
            {isSaving ? '저장 중...' : '목표 저장'}
          </button>
          
          <button
            onClick={handleReset}
            className="btn-secondary flex items-center gap-2"
          >
            <Icon icon={HiOutlineRefresh} size={16} />
            초기화
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
          <li>• 설정한 목표는 자동으로 저장되어 새로고침 후에도 유지됩니다</li>
        </ul>
      </div>
    </div>
  );
};

export default GoalSettings;