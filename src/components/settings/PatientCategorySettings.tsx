// src/components/settings/PatientCategorySettings.tsx
// 환자 등록 카테고리 관리 - 상담타입, 유입경로, 관심분야

'use client';

import { useState, useEffect } from 'react';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineEyeOff,
} from 'react-icons/hi';
import { Icon } from '@/components/common/Icon';

interface CategoryItem {
  id: string;
  label: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Categories {
  consultationTypes: CategoryItem[];
  referralSources: CategoryItem[];
  interestedServices: CategoryItem[];
}

type CategoryType = 'consultationTypes' | 'referralSources' | 'interestedServices';

const CATEGORY_LABELS: Record<CategoryType, string> = {
  consultationTypes: '상담 타입',
  referralSources: '유입 경로',
  interestedServices: '관심 분야',
};

const CATEGORY_DESCRIPTIONS: Record<CategoryType, string> = {
  consultationTypes: '환자 상담 유형을 분류합니다. (예: 인바운드, 아웃바운드, 구신환)',
  referralSources: '환자가 병원을 알게 된 경로입니다. (예: 네이버, 지인소개, 간판)',
  interestedServices: '환자가 관심있는 진료 분야입니다. (예: 임플란트, 틀니, 라미네이트)',
};

export default function PatientCategorySettings() {
  const [categories, setCategories] = useState<Categories>({
    consultationTypes: [],
    referralSources: [],
    interestedServices: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryType>('consultationTypes');

  // 새 항목 추가 상태
  const [newItemLabel, setNewItemLabel] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // 수정 상태
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  // 저장 중 상태
  const [isSaving, setIsSaving] = useState(false);

  // 카테고리 데이터 로드
  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/settings/categories');
      const data = await response.json();

      if (data.success) {
        setCategories(data.categories);
      } else {
        setError(data.error || '카테고리를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('카테고리를 불러오는데 실패했습니다.');
      console.error('카테고리 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 새 항목 추가
  const handleAddItem = async () => {
    if (!newItemLabel.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryType: activeCategory,
          item: { label: newItemLabel.trim() },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCategories((prev) => ({
          ...prev,
          [activeCategory]: [...prev[activeCategory], data.item],
        }));
        setNewItemLabel('');
        setIsAddingItem(false);
      } else {
        alert(data.error || '항목 추가에 실패했습니다.');
      }
    } catch (err) {
      alert('항목 추가에 실패했습니다.');
      console.error('항목 추가 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 항목 수정
  const handleUpdateItem = async (itemId: string) => {
    if (!editingLabel.trim()) return;

    const updatedItems = categories[activeCategory].map((item) =>
      item.id === itemId ? { ...item, label: editingLabel.trim() } : item
    );

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryType: activeCategory,
          categories: updatedItems,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCategories((prev) => ({
          ...prev,
          [activeCategory]: updatedItems,
        }));
        setEditingItemId(null);
        setEditingLabel('');
      } else {
        alert(data.error || '항목 수정에 실패했습니다.');
      }
    } catch (err) {
      alert('항목 수정에 실패했습니다.');
      console.error('항목 수정 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 항목 활성화/비활성화 토글
  const handleToggleActive = async (itemId: string) => {
    const updatedItems = categories[activeCategory].map((item) =>
      item.id === itemId ? { ...item, isActive: !item.isActive } : item
    );

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryType: activeCategory,
          categories: updatedItems,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCategories((prev) => ({
          ...prev,
          [activeCategory]: updatedItems,
        }));
      } else {
        alert(data.error || '상태 변경에 실패했습니다.');
      }
    } catch (err) {
      alert('상태 변경에 실패했습니다.');
      console.error('상태 토글 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 항목 삭제
  const handleDeleteItem = async (itemId: string) => {
    const item = categories[activeCategory].find((i) => i.id === itemId);

    if (item?.isDefault) {
      if (!confirm('기본 항목은 삭제할 수 없습니다. 비활성화하시겠습니까?')) return;
    } else {
      if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/settings/categories?categoryType=${activeCategory}&itemId=${itemId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        if (data.wasDefault) {
          // 기본 항목은 비활성화만
          setCategories((prev) => ({
            ...prev,
            [activeCategory]: prev[activeCategory].map((item) =>
              item.id === itemId ? { ...item, isActive: false } : item
            ),
          }));
        } else {
          // 커스텀 항목은 완전 삭제
          setCategories((prev) => ({
            ...prev,
            [activeCategory]: prev[activeCategory].filter((item) => item.id !== itemId),
          }));
        }
      } else {
        alert(data.error || '항목 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('항목 삭제에 실패했습니다.');
      console.error('항목 삭제 오류:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 수정 시작
  const startEditing = (item: CategoryItem) => {
    setEditingItemId(item.id);
    setEditingLabel(item.label);
  };

  // 수정 취소
  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingLabel('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-text-secondary">카테고리 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchCategories}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const currentItems = categories[activeCategory];
  const activeCount = currentItems.filter((i) => i.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-text-primary mb-2">환자 등록 카테고리 관리</h3>
        <p className="text-sm text-text-secondary">
          환자 등록 시 사용되는 상담타입, 유입경로, 관심분야 항목을 관리합니다.
        </p>
      </div>

      {/* 카테고리 타입 선택 탭 */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {(Object.keys(CATEGORY_LABELS) as CategoryType[]).map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveCategory(type);
              setIsAddingItem(false);
              setEditingItemId(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeCategory === type
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {CATEGORY_LABELS[type]}
            <span className="ml-2 text-xs opacity-75">
              ({categories[type].filter((i) => i.isActive).length}/{categories[type].length})
            </span>
          </button>
        ))}
      </div>

      {/* 선택된 카테고리 설명 */}
      <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        {CATEGORY_DESCRIPTIONS[activeCategory]}
      </div>

      {/* 새 항목 추가 */}
      <div className="flex items-center space-x-2">
        {isAddingItem ? (
          <>
            <input
              type="text"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              placeholder="새 항목 이름 입력"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
              disabled={isSaving}
            />
            <button
              onClick={handleAddItem}
              disabled={isSaving || !newItemLabel.trim()}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300"
              title="추가"
            >
              <Icon icon={HiOutlineCheck} size={20} />
            </button>
            <button
              onClick={() => {
                setIsAddingItem(false);
                setNewItemLabel('');
              }}
              disabled={isSaving}
              className="p-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
              title="취소"
            >
              <Icon icon={HiOutlineX} size={20} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsAddingItem(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Icon icon={HiOutlinePlus} size={18} />
            <span>새 항목 추가</span>
          </button>
        )}

        <button
          onClick={fetchCategories}
          disabled={isSaving}
          className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          title="새로고침"
        >
          <Icon icon={HiOutlineRefresh} size={20} />
        </button>
      </div>

      {/* 항목 목록 */}
      <div className="space-y-2">
        {currentItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 항목이 없습니다.
          </div>
        ) : (
          currentItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                item.isActive
                  ? 'bg-white border-gray-200 hover:border-gray-300'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-3">
                {/* 순서 번호 */}
                <span className="w-6 h-6 flex items-center justify-center text-xs text-gray-400 bg-gray-100 rounded">
                  {index + 1}
                </span>

                {/* 활성화 상태 아이콘 */}
                <button
                  onClick={() => handleToggleActive(item.id)}
                  disabled={isSaving}
                  className={`p-1.5 rounded transition-colors ${
                    item.isActive
                      ? 'text-green-500 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={item.isActive ? '활성화됨 (클릭하여 비활성화)' : '비활성화됨 (클릭하여 활성화)'}
                >
                  <Icon icon={item.isActive ? HiOutlineEye : HiOutlineEyeOff} size={18} />
                </button>

                {/* 항목 이름 (수정 모드) */}
                {editingItemId === item.id ? (
                  <input
                    type="text"
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    className="px-2 py-1 border border-primary rounded focus:outline-none min-w-[200px]"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && handleUpdateItem(item.id)}
                    disabled={isSaving}
                  />
                ) : (
                  <span className={`font-medium ${!item.isActive && 'line-through text-gray-400'}`}>
                    {item.label}
                  </span>
                )}

                {/* 기본 항목 뱃지 */}
                {item.isDefault && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                    기본
                  </span>
                )}

                {/* 비활성화 뱃지 */}
                {!item.isActive && (
                  <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-500 rounded">
                    비활성화
                  </span>
                )}
              </div>

              {/* 액션 버튼들 */}
              <div className="flex items-center space-x-1">
                {editingItemId === item.id ? (
                  <>
                    <button
                      onClick={() => handleUpdateItem(item.id)}
                      disabled={isSaving}
                      className="p-1.5 text-green-500 hover:bg-green-50 rounded"
                      title="저장"
                    >
                      <Icon icon={HiOutlineCheck} size={18} />
                    </button>
                    <button
                      onClick={cancelEditing}
                      disabled={isSaving}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                      title="취소"
                    >
                      <Icon icon={HiOutlineX} size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(item)}
                      disabled={isSaving}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                      title="수정"
                    >
                      <Icon icon={HiOutlinePencil} size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isSaving}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      title={item.isDefault ? '비활성화' : '삭제'}
                    >
                      <Icon icon={HiOutlineTrash} size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 통계 */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
        <span>전체 {currentItems.length}개 항목</span>
        <span>활성화 {activeCount}개 / 비활성화 {currentItems.length - activeCount}개</span>
      </div>

      {/* 안내 메시지 */}
      <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
        <p className="font-medium mb-1">사용 안내</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li><strong>기본 항목</strong>은 삭제할 수 없으며, 비활성화만 가능합니다.</li>
          <li><strong>비활성화</strong>된 항목은 환자 등록 시 선택 목록에 표시되지 않습니다.</li>
          <li>새로 추가한 <strong>사용자 항목</strong>은 완전히 삭제할 수 있습니다.</li>
          <li>항목 이름을 클릭하면 수정할 수 있습니다.</li>
        </ul>
      </div>
    </div>
  );
}
