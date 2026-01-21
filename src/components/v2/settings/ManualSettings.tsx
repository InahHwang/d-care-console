// src/components/v2/settings/ManualSettings.tsx
// 상담 매뉴얼 설정 컴포넌트

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FileText,
  Search,
  GripVertical,
} from 'lucide-react';
import { Manual, ManualCategory } from '@/types/v2/manual';

export default function ManualSettings() {
  const [categories, setCategories] = useState<ManualCategory[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // 모달 상태
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ManualCategory | null>(null);
  const [editingManual, setEditingManual] = useState<Manual | null>(null);

  // 폼 상태
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [manualForm, setManualForm] = useState({
    categoryId: '',
    title: '',
    keywords: '',
    script: '',
    shortScript: '',
  });

  const [searchKeyword, setSearchKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      const [catRes, manualRes] = await Promise.all([
        fetch('/api/v2/manual-categories'),
        fetch('/api/v2/manuals?limit=200'),
      ]);

      const catData = await catRes.json();
      const manualData = await manualRes.json();

      if (catData.success) setCategories(catData.data);
      if (manualData.success) setManuals(manualData.data);

      // 첫 카테고리 펼치기
      if (catData.data?.length > 0) {
        setExpandedCategories(new Set([catData.data[0]._id.toString()]));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 카테고리 토글
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // 카테고리별 매뉴얼 필터링
  const getManualsByCategory = (categoryId: string) => {
    return manuals.filter(m => m.categoryId === categoryId);
  };

  // 검색 필터링
  const filteredManuals = searchKeyword
    ? manuals.filter(m =>
        m.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        m.keywords.some(k => k.toLowerCase().includes(searchKeyword.toLowerCase())) ||
        m.script.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : manuals;

  // 카테고리 저장
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    setSaving(true);
    try {
      const url = '/api/v2/manual-categories';
      const method = editingCategory ? 'PATCH' : 'POST';
      const body = editingCategory
        ? { id: editingCategory._id, name: categoryForm.name }
        : { name: categoryForm.name };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchData();
        setShowCategoryModal(false);
        setEditingCategory(null);
        setCategoryForm({ name: '' });
      }
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('카테고리 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 카테고리 삭제
  const handleDeleteCategory = async (category: ManualCategory) => {
    const manualsInCategory = getManualsByCategory(category._id?.toString() || '');
    if (manualsInCategory.length > 0) {
      alert(`이 카테고리에 ${manualsInCategory.length}개의 매뉴얼이 있습니다. 먼저 매뉴얼을 삭제해주세요.`);
      return;
    }

    if (!confirm(`"${category.name}" 카테고리를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/v2/manual-categories?id=${category._id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  // 매뉴얼 저장
  const handleSaveManual = async () => {
    if (!manualForm.categoryId || !manualForm.title.trim() || !manualForm.script.trim()) {
      alert('카테고리, 제목, 스크립트는 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const keywords = manualForm.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k);

      if (editingManual) {
        // 수정
        const res = await fetch(`/api/v2/manuals/${editingManual._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: manualForm.categoryId,
            title: manualForm.title,
            keywords,
            script: manualForm.script,
            shortScript: manualForm.shortScript,
          }),
        });

        if (res.ok) {
          await fetchData();
          closeManualModal();
        }
      } else {
        // 생성
        const res = await fetch('/api/v2/manuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: manualForm.categoryId,
            title: manualForm.title,
            keywords,
            script: manualForm.script,
            shortScript: manualForm.shortScript,
          }),
        });

        if (res.ok) {
          await fetchData();
          closeManualModal();
        }
      }
    } catch (error) {
      console.error('Failed to save manual:', error);
      alert('매뉴얼 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 매뉴얼 삭제
  const handleDeleteManual = async (manual: Manual) => {
    if (!confirm(`"${manual.title}" 매뉴얼을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/v2/manuals/${manual._id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to delete manual:', error);
    }
  };

  // 매뉴얼 편집 모달 열기
  const openManualModal = (manual?: Manual, categoryId?: string) => {
    if (manual) {
      setEditingManual(manual);
      setManualForm({
        categoryId: manual.categoryId,
        title: manual.title,
        keywords: manual.keywords.join(', '),
        script: manual.script,
        shortScript: manual.shortScript || '',
      });
    } else {
      setEditingManual(null);
      setManualForm({
        categoryId: categoryId || categories[0]?._id?.toString() || '',
        title: '',
        keywords: '',
        script: '',
        shortScript: '',
      });
    }
    setShowManualModal(true);
  };

  const closeManualModal = () => {
    setShowManualModal(false);
    setEditingManual(null);
    setManualForm({
      categoryId: '',
      title: '',
      keywords: '',
      script: '',
      shortScript: '',
    });
  };

  if (loading) {
    return <div className="text-center text-gray-500 py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">상담 매뉴얼 관리</h3>
          <p className="text-sm text-gray-500 mt-1">
            전화/채팅 상담 시 참고할 매뉴얼을 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ name: '' });
              setShowCategoryModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <FolderOpen className="w-4 h-4" />
            카테고리 추가
          </button>
          <button
            onClick={() => openManualModal()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            매뉴얼 추가
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="매뉴얼 검색..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
        />
      </div>

      {/* 검색 결과 또는 카테고리별 목록 */}
      {searchKeyword ? (
        // 검색 결과
        <div className="border border-gray-200 rounded-lg divide-y">
          {filteredManuals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            filteredManuals.map(manual => (
              <ManualItem
                key={manual._id?.toString()}
                manual={manual}
                onEdit={() => openManualModal(manual)}
                onDelete={() => handleDeleteManual(manual)}
              />
            ))
          )}
        </div>
      ) : (
        // 카테고리별 목록
        <div className="border border-gray-200 rounded-lg divide-y">
          {categories.map(category => {
            const categoryManuals = getManualsByCategory(category._id?.toString() || '');
            const isExpanded = expandedCategories.has(category._id?.toString() || '');

            return (
              <div key={category._id?.toString()}>
                {/* 카테고리 헤더 */}
                <div
                  className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleCategory(category._id?.toString() || '')}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <FolderOpen className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-gray-700">{category.name}</span>
                    <span className="text-xs text-gray-400">({categoryManuals.length})</span>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openManualModal(undefined, category._id?.toString())}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                      title="매뉴얼 추가"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryForm({ name: category.name });
                        setShowCategoryModal(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded"
                      title="카테고리 수정"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      title="카테고리 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 매뉴얼 목록 */}
                {isExpanded && (
                  <div className="divide-y divide-gray-100">
                    {categoryManuals.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        이 카테고리에 매뉴얼이 없습니다.
                      </div>
                    ) : (
                      categoryManuals.map(manual => (
                        <ManualItem
                          key={manual._id?.toString()}
                          manual={manual}
                          onEdit={() => openManualModal(manual)}
                          onDelete={() => handleDeleteManual(manual)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 카테고리 모달 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingCategory ? '카테고리 수정' : '카테고리 추가'}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리명
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ name: e.target.value })}
                  placeholder="예: 임플란트, 교정, 불만대응"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveCategory}
                  disabled={saving || !categoryForm.name.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 매뉴얼 모달 */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingManual ? '매뉴얼 수정' : '매뉴얼 추가'}
              </h3>
              <button
                onClick={closeManualModal}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리 *
                </label>
                <select
                  value={manualForm.categoryId}
                  onChange={(e) => setManualForm(prev => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">카테고리 선택</option>
                  {categories.map(cat => (
                    <option key={cat._id?.toString()} value={cat._id?.toString()}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 *
                </label>
                <input
                  type="text"
                  value={manualForm.title}
                  onChange={(e) => setManualForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 임플란트 비용 안내"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  검색 키워드
                  <span className="text-gray-400 font-normal ml-1">(쉼표로 구분)</span>
                </label>
                <input
                  type="text"
                  value={manualForm.keywords}
                  onChange={(e) => setManualForm(prev => ({ ...prev, keywords: e.target.value }))}
                  placeholder="예: 가격, 비용, 얼마, 금액"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  스크립트 (전화 상담용) *
                </label>
                <textarea
                  value={manualForm.script}
                  onChange={(e) => setManualForm(prev => ({ ...prev, script: e.target.value }))}
                  placeholder="전화 상담 시 참고할 전체 스크립트를 입력하세요..."
                  rows={8}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  짧은 스크립트 (채팅 삽입용)
                  <span className="text-gray-400 font-normal ml-1">(선택)</span>
                </label>
                <textarea
                  value={manualForm.shortScript}
                  onChange={(e) => setManualForm(prev => ({ ...prev, shortScript: e.target.value }))}
                  placeholder="채팅 상담 시 바로 삽입할 짧은 버전..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
              <button
                onClick={closeManualModal}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSaveManual}
                disabled={saving || !manualForm.categoryId || !manualForm.title.trim() || !manualForm.script.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 매뉴얼 아이템 컴포넌트
function ManualItem({
  manual,
  onEdit,
  onDelete,
}: {
  manual: Manual;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 py-3 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div
          className="flex-1 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-800">{manual.title}</span>
            {manual.categoryName && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                {manual.categoryName}
              </span>
            )}
          </div>
          {manual.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 ml-6">
              {manual.keywords.slice(0, 5).map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                >
                  {keyword}
                </span>
              ))}
              {manual.keywords.length > 5 && (
                <span className="text-xs text-gray-400">
                  +{manual.keywords.length - 5}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
            title="수정"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 펼쳐진 스크립트 */}
      {expanded && (
        <div className="mt-3 ml-6 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-wrap">
          {manual.script}
          {manual.shortScript && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <span className="text-xs font-medium text-gray-500">채팅용 짧은 버전:</span>
              <p className="mt-1">{manual.shortScript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
