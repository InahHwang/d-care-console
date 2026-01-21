// src/components/v2/settings/RecallSettings.tsx
// 리콜 발송 설정 컴포넌트 (설정 페이지용)

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

interface RecallSchedule {
  id: string;
  timing: string;
  timingDays: number;
  message: string;
  enabled: boolean;
}

interface RecallSetting {
  id: string;
  treatment: string;
  schedules: RecallSchedule[];
}

// 기본 발송 시점 옵션
const TIMING_OPTIONS = [
  { label: '1일 후', days: 1 },
  { label: '3일 후', days: 3 },
  { label: '1주 후', days: 7 },
  { label: '2주 후', days: 14 },
  { label: '1개월 후', days: 30 },
  { label: '3개월 후', days: 90 },
  { label: '6개월 후', days: 180 },
  { label: '1년 후', days: 365 },
];

export default function RecallSettings() {
  const [settings, setSettings] = useState<RecallSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [showAddTreatmentModal, setShowAddTreatmentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<RecallSchedule | null>(null);

  // 폼 상태
  const [newTreatment, setNewTreatment] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    timing: '1주 후',
    timingDays: 7,
    message: '',
  });

  // 설정 조회
  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/v2/recall-settings');
      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('리콜 설정 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 치료 추가
  const handleAddTreatment = async () => {
    if (!newTreatment.trim()) {
      alert('치료 종류를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/v2/recall-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treatment: newTreatment.trim(),
          schedules: [],
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSettings([...settings, result.data]);
        setNewTreatment('');
        setShowAddTreatmentModal(false);
      } else {
        alert(result.error || '추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('치료 추가 실패:', error);
      alert('추가에 실패했습니다.');
    }
  };

  // 치료 삭제
  const handleDeleteTreatment = async (id: string) => {
    if (!confirm('이 치료 설정을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/v2/recall-settings?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSettings(settings.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('치료 삭제 실패:', error);
    }
  };

  // 스케줄 추가/수정 모달 열기
  const openScheduleModal = (settingId: string, schedule?: RecallSchedule) => {
    setEditingSettingId(settingId);
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({
        timing: schedule.timing,
        timingDays: schedule.timingDays,
        message: schedule.message,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        timing: '1주 후',
        timingDays: 7,
        message: '',
      });
    }
    setShowScheduleModal(true);
  };

  // 스케줄 저장
  const handleSaveSchedule = async () => {
    if (!scheduleForm.message.trim()) {
      alert('메시지를 입력해주세요.');
      return;
    }

    const setting = settings.find(s => s.id === editingSettingId);
    if (!setting) return;

    let updatedSchedules: RecallSchedule[];

    if (editingSchedule) {
      // 수정
      updatedSchedules = setting.schedules.map(s =>
        s.id === editingSchedule.id
          ? { ...s, ...scheduleForm }
          : s
      );
    } else {
      // 추가
      const newSchedule: RecallSchedule = {
        id: `schedule-${Date.now()}`,
        timing: scheduleForm.timing,
        timingDays: scheduleForm.timingDays,
        message: scheduleForm.message.trim(),
        enabled: true,
      };
      updatedSchedules = [...setting.schedules, newSchedule];
    }

    try {
      const response = await fetch('/api/v2/recall-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSettingId,
          schedules: updatedSchedules,
        }),
      });

      if (response.ok) {
        setSettings(settings.map(s =>
          s.id === editingSettingId
            ? { ...s, schedules: updatedSchedules }
            : s
        ));
        setShowScheduleModal(false);
      }
    } catch (error) {
      console.error('스케줄 저장 실패:', error);
    }
  };

  // 스케줄 삭제
  const handleDeleteSchedule = async (settingId: string, scheduleId: string) => {
    if (!confirm('이 발송 시점을 삭제하시겠습니까?')) return;

    const setting = settings.find(s => s.id === settingId);
    if (!setting) return;

    const updatedSchedules = setting.schedules.filter(s => s.id !== scheduleId);

    try {
      const response = await fetch('/api/v2/recall-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: settingId,
          schedules: updatedSchedules,
        }),
      });

      if (response.ok) {
        setSettings(settings.map(s =>
          s.id === settingId
            ? { ...s, schedules: updatedSchedules }
            : s
        ));
      }
    } catch (error) {
      console.error('스케줄 삭제 실패:', error);
    }
  };

  // 스케줄 토글
  const handleToggleSchedule = async (settingId: string, scheduleId: string, enabled: boolean) => {
    const setting = settings.find(s => s.id === settingId);
    if (!setting) return;

    const updatedSchedules = setting.schedules.map(s =>
      s.id === scheduleId ? { ...s, enabled } : s
    );

    try {
      const response = await fetch('/api/v2/recall-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: settingId,
          schedules: updatedSchedules,
        }),
      });

      if (response.ok) {
        setSettings(settings.map(s =>
          s.id === settingId
            ? { ...s, schedules: updatedSchedules }
            : s
        ));
      }
    } catch (error) {
      console.error('스케줄 토글 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">치료별 자동 발송 설정</h3>
          <p className="text-sm text-gray-500 mt-1">
            환자가 치료를 완료하면 설정된 시점에 자동으로 알림톡이 발송됩니다.
            <br />
            메시지에 <code className="bg-gray-100 px-1 rounded">{'{환자명}'}</code>을 넣으면 자동으로 치환됩니다.
          </p>
        </div>
        <button
          onClick={() => setShowAddTreatmentModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          치료 추가
        </button>
      </div>

      {/* 치료 목록 */}
      <div className="space-y-4">
        {settings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">등록된 치료 설정이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">치료를 추가하고 발송 시점을 설정하세요</p>
          </div>
        ) : (
          settings.map(setting => (
            <div key={setting.id} className="border rounded-xl overflow-hidden">
              {/* 치료 헤더 */}
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-gray-900">{setting.treatment}</span>
                <button
                  onClick={() => handleDeleteTreatment(setting.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* 스케줄 목록 */}
              <div className="divide-y">
                {setting.schedules.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-400 text-sm">
                    발송 시점을 추가해주세요
                  </div>
                ) : (
                  setting.schedules.map(schedule => (
                    <div key={schedule.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* 토글 스위치 */}
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={schedule.enabled}
                            onChange={(e) => handleToggleSchedule(setting.id, schedule.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                        </label>
                        <div>
                          <span className={`text-sm font-medium ${schedule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                            {schedule.timing}
                          </span>
                          <p className={`text-sm mt-0.5 max-w-md truncate ${schedule.enabled ? 'text-gray-500' : 'text-gray-300'}`}>
                            {schedule.message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openScheduleModal(setting.id, schedule)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} className="text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(setting.id, schedule.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} className="text-gray-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* 스케줄 추가 버튼 */}
                <div className="px-4 py-3">
                  <button
                    onClick={() => openScheduleModal(setting.id)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={16} />
                    발송 시점 추가
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 치료 추가 모달 */}
      {showAddTreatmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">치료 추가</h3>
              <button onClick={() => setShowAddTreatmentModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                치료 종류
              </label>
              <input
                type="text"
                value={newTreatment}
                onChange={(e) => setNewTreatment(e.target.value)}
                placeholder="예: 임플란트, 스케일링, 교정"
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddTreatmentModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleAddTreatment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스케줄 추가/수정 모달 */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {editingSchedule ? '발송 시점 수정' : '발송 시점 추가'}
              </h3>
              <button onClick={() => setShowScheduleModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  발송 시점
                </label>
                <select
                  value={scheduleForm.timingDays}
                  onChange={(e) => {
                    const days = parseInt(e.target.value);
                    const option = TIMING_OPTIONS.find(o => o.days === days);
                    setScheduleForm({
                      ...scheduleForm,
                      timingDays: days,
                      timing: option?.label || `${days}일 후`,
                    });
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  {TIMING_OPTIONS.map(option => (
                    <option key={option.days} value={option.days}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메시지 내용
                </label>
                <textarea
                  value={scheduleForm.message}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, message: e.target.value })}
                  placeholder="{환자명}님, 치료 후 불편하신 점이 있으시면 연락주세요."
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {'{환자명}'} - 환자 이름으로 자동 치환됩니다
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSaveSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save size={16} />
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
