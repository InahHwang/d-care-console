// src/components/settings/CallRetentionSettings.tsx
// 통화기록 보존 설정 컴포넌트

import React, { useState, useEffect } from 'react';
import {
  HiOutlineArchive,
  HiOutlineSave,
  HiOutlineRefresh,
  HiOutlineExclamationCircle,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
} from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';

// 카테고리 설정 타입
interface CategoryRetentionSetting {
  category: string;
  label: string;
  description: string;
  showInMainList: boolean;
  retentionPeriod: string;
  isActive: boolean;
}

// 보존기간 옵션 타입
interface RetentionPeriodOption {
  value: string;
  label: string;
  days: number;
}

const CallRetentionSettings: React.FC = () => {
  const [categories, setCategories] = useState<CategoryRetentionSetting[]>([]);
  const [autoArchiveEnabled, setAutoArchiveEnabled] = useState(true);
  const [archiveRunTime, setArchiveRunTime] = useState('03:00');
  const [retentionOptions, setRetentionOptions] = useState<RetentionPeriodOption[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // 설정 불러오기
  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/call-retention');
      const data = await response.json();

      if (data.success) {
        setCategories(data.data.categories);
        setAutoArchiveEnabled(data.data.autoArchiveEnabled);
        setArchiveRunTime(data.data.archiveRunTime);
        setRetentionOptions(data.data.retentionPeriodOptions);
      } else {
        setError(data.error || '설정을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
      console.error('[CallRetention] 설정 로딩 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 설정 불러오기
  useEffect(() => {
    loadSettings();
  }, []);

  // 설정 저장
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/call-retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories,
          autoArchiveEnabled,
          archiveRunTime,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setError(data.error || '설정 저장에 실패했습니다.');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.');
      console.error('[CallRetention] 설정 저장 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 카테고리 설정 변경
  const handleCategoryChange = (
    index: number,
    field: keyof CategoryRetentionSetting,
    value: boolean | string
  ) => {
    setCategories(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // 메인 목록 표시 카테고리 개수
  const mainListCount = categories.filter(c => c.showInMainList).length;
  const archiveCount = categories.filter(c => !c.showInMainList).length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon icon={HiOutlineArchive} size={24} className="text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-text-primary">통화기록 보존 설정</h3>
            <p className="text-sm text-text-secondary">
              AI 분류 결과에 따른 통화기록 보존 규칙을 설정하세요
            </p>
          </div>
        </div>

        <button
          onClick={loadSettings}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1 text-sm text-text-secondary hover:text-primary hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
        >
          <Icon icon={HiOutlineRefresh} size={16} className={isLoading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Icon icon={HiOutlineInformationCircle} size={20} className="text-blue-500 mt-0.5" />
          <div>
            <span className="text-blue-800 text-sm font-medium">통화기록 자동 분류 안내</span>
            <p className="text-blue-700 text-sm mt-1">
              AI가 통화 내용을 분석하여 자동으로 분류합니다.
              아래에서 각 분류별로 메인 목록 표시 여부와 보존 기간을 설정할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Icon icon={HiOutlineExclamationCircle} size={20} className="text-red-500" />
            <span className="text-red-800 text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* 성공 메시지 */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Icon icon={HiOutlineCheckCircle} size={20} className="text-green-500" />
            <span className="text-green-800 text-sm font-medium">
              설정이 성공적으로 저장되었습니다!
            </span>
          </div>
        </div>
      )}

      {/* 현재 설정 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 mb-1">메인 목록 표시</h4>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-green-600">{mainListCount}</span>
            <span className="text-green-600 text-sm">개 분류</span>
          </div>
          <p className="text-xs text-green-600 mt-1">중요 통화로 관리됩니다</p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-orange-800 mb-1">아카이브 대상</h4>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-orange-600">{archiveCount}</span>
            <span className="text-orange-600 text-sm">개 분류</span>
          </div>
          <p className="text-xs text-orange-600 mt-1">보존 기간 후 자동 정리됩니다</p>
        </div>
      </div>

      {/* 카테고리별 설정 */}
      <div className="card p-6">
        <h4 className="text-md font-semibold text-text-primary mb-4">분류별 보존 설정</h4>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-text-secondary">
              설정을 불러오는 중...
            </div>
          ) : (
            categories.map((category, index) => (
              <div
                key={category.category}
                className={`border rounded-lg p-4 transition-colors ${
                  category.showInMainList
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* 왼쪽: 체크박스 + 라벨 */}
                  <div className="flex items-start gap-3 flex-1">
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input
                        type="checkbox"
                        checked={category.showInMainList}
                        onChange={(e) => handleCategoryChange(index, 'showInMainList', e.target.checked)}
                        className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                    </label>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{category.label}</span>
                        {category.showInMainList && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            메인 표시
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary mt-1">{category.description}</p>
                    </div>
                  </div>

                  {/* 오른쪽: 보존기간 선택 */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary whitespace-nowrap">보존기간:</span>
                    <select
                      value={category.retentionPeriod}
                      onChange={(e) => handleCategoryChange(index, 'retentionPeriod', e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[100px]"
                    >
                      {retentionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 설명 */}
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <div className="flex items-start gap-2 text-sm text-text-secondary">
            <span className="text-lg">💡</span>
            <div>
              <p><strong>체크된 항목:</strong> 메인 통화기록 목록에 표시됩니다</p>
              <p><strong>체크 해제된 항목:</strong> 아카이브로 자동 이동되며, 보존기간 후 정리됩니다</p>
            </div>
          </div>
        </div>
      </div>

      {/* 자동 아카이브 설정 */}
      <div className="card p-6">
        <h4 className="text-md font-semibold text-text-primary mb-4">자동 아카이브 설정</h4>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoArchiveEnabled}
              onChange={(e) => setAutoArchiveEnabled(e.target.checked)}
              className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <div>
              <span className="font-medium text-text-primary">자동 아카이브 활성화</span>
              <p className="text-sm text-text-secondary">
                설정된 보존 기간이 지난 통화기록을 자동으로 아카이브합니다
              </p>
            </div>
          </label>

          {autoArchiveEnabled && (
            <div className="ml-8 flex items-center gap-3">
              <span className="text-sm text-text-secondary">실행 시간:</span>
              <input
                type="time"
                value={archiveRunTime}
                onChange={(e) => setArchiveRunTime(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <span className="text-xs text-text-muted">(매일 이 시간에 자동 실행)</span>
            </div>
          )}
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon icon={HiOutlineSave} size={16} />
          {isSaving ? '저장 중...' : '설정 저장'}
        </button>
      </div>

      {/* 도움말 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-800 mb-2">통화기록 관리 안내</h5>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>신규환자 상담, 컴플레인</strong>은 중요하므로 메인 목록에 유지하는 것을 권장합니다</li>
          <li>• <strong>단순 문의, 스케줄 변경</strong>은 아카이브로 이동해도 필요시 검색 가능합니다</li>
          <li>• 아카이브된 통화기록은 별도의 &quot;아카이브 보기&quot; 메뉴에서 확인할 수 있습니다</li>
          <li>• 보존 기간이 지난 후에도 바로 삭제되지 않고, 별도 요청 시 정리됩니다</li>
          <li>• AI 분류가 잘못된 경우, 개별 통화기록에서 수동으로 분류를 변경할 수 있습니다</li>
        </ul>
      </div>
    </div>
  );
};

export default CallRetentionSettings;
