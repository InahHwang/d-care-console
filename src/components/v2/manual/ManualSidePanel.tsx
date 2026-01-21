// src/components/v2/manual/ManualSidePanel.tsx
// CTI 패널 및 채널 상담에서 사용하는 매뉴얼 사이드 패널

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FileText,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import { Manual, ManualCategory } from '@/types/v2/manual';

interface ManualSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert?: (text: string) => void;  // 채팅용 삽입 콜백
  mode?: 'phone' | 'chat';             // 전화 모드 / 채팅 모드
}

export default function ManualSidePanel({
  isOpen,
  onClose,
  onInsert,
  mode = 'phone',
}: ManualSidePanelProps) {
  const [categories, setCategories] = useState<ManualCategory[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedManual, setSelectedManual] = useState<Manual | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      const [catRes, manualRes] = await Promise.all([
        fetch('/api/v2/manual-categories'),
        fetch('/api/v2/manuals?limit=200&isActive=true'),
      ]);

      const catData = await catRes.json();
      const manualData = await manualRes.json();

      if (catData.success) setCategories(catData.data);
      if (manualData.success) setManuals(manualData.data);

      // 모든 카테고리 펼치기
      if (catData.data?.length > 0) {
        setExpandedCategories(new Set(catData.data.map((c: ManualCategory) => c._id?.toString())));
      }
    } catch (error) {
      console.error('Failed to fetch manuals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

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
  const searchManuals = useCallback(() => {
    if (!searchKeyword.trim()) return null;

    return manuals.filter(m =>
      m.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      m.keywords.some(k => k.toLowerCase().includes(searchKeyword.toLowerCase())) ||
      m.script.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [manuals, searchKeyword]);

  // 복사
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // 삽입 (채팅 모드)
  const handleInsert = (manual: Manual) => {
    const text = manual.shortScript || manual.script;
    onInsert?.(text);
  };

  if (!isOpen) return null;

  const searchResults = searchManuals();

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">상담 매뉴얼</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* 검색 */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="키워드로 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
          {searchKeyword && (
            <button
              onClick={() => setSearchKeyword('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">로딩 중...</div>
        ) : selectedManual ? (
          // 매뉴얼 상세
          <ManualDetail
            manual={selectedManual}
            mode={mode}
            onBack={() => setSelectedManual(null)}
            onCopy={(text) => handleCopy(text, selectedManual._id?.toString() || '')}
            onInsert={() => handleInsert(selectedManual)}
            copied={copiedId === selectedManual._id?.toString()}
          />
        ) : searchResults ? (
          // 검색 결과
          <div className="divide-y">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                검색 결과가 없습니다.
              </div>
            ) : (
              searchResults.map(manual => (
                <ManualListItem
                  key={manual._id?.toString()}
                  manual={manual}
                  onClick={() => setSelectedManual(manual)}
                />
              ))
            )}
          </div>
        ) : (
          // 카테고리별 목록
          <div className="divide-y">
            {categories.map(category => {
              const categoryManuals = getManualsByCategory(category._id?.toString() || '');
              const isExpanded = expandedCategories.has(category._id?.toString() || '');

              if (categoryManuals.length === 0) return null;

              return (
                <div key={category._id?.toString()}>
                  <button
                    onClick={() => toggleCategory(category._id?.toString() || '')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <FolderOpen className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-gray-700">{category.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{categoryManuals.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-gray-50">
                      {categoryManuals.map(manual => (
                        <ManualListItem
                          key={manual._id?.toString()}
                          manual={manual}
                          onClick={() => setSelectedManual(manual)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 매뉴얼 리스트 아이템
function ManualListItem({
  manual,
  onClick,
}: {
  manual: Manual;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <FileText className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{manual.title}</div>
          {manual.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {manual.keywords.slice(0, 3).map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// 매뉴얼 상세
function ManualDetail({
  manual,
  mode,
  onBack,
  onCopy,
  onInsert,
  copied,
}: {
  manual: Manual;
  mode: 'phone' | 'chat';
  onBack: () => void;
  onCopy: (text: string) => void;
  onInsert: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <button
          onClick={onBack}
          className="text-sm text-blue-500 hover:text-blue-600 mb-2"
        >
          ← 목록으로
        </button>
        <h4 className="font-semibold text-gray-900">{manual.title}</h4>
        {manual.categoryName && (
          <span className="text-xs text-gray-500">{manual.categoryName}</span>
        )}
      </div>

      {/* 스크립트 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {manual.script}
        </div>

        {manual.shortScript && mode === 'chat' && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs font-medium text-gray-500 mb-2">채팅용 짧은 버전</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 p-3 rounded-lg">
              {manual.shortScript}
            </div>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="p-3 border-t bg-gray-50">
        {mode === 'chat' ? (
          <div className="flex gap-2">
            <button
              onClick={() => onCopy(manual.shortScript || manual.script)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? '복사됨' : '복사'}
            </button>
            <button
              onClick={onInsert}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              입력창에 삽입
            </button>
          </div>
        ) : (
          <button
            onClick={() => onCopy(manual.script)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? '클립보드에 복사됨' : '스크립트 복사'}
          </button>
        )}
      </div>
    </div>
  );
}
