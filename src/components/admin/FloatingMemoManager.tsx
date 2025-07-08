// src/components/admin/FloatingMemoManager.tsx

'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/reduxHooks';
import { 
  fetchMemos, 
  createMemo, 
  toggleMemoManager,
  setMemoManagerVisible,
  clearError 
} from '@/store/slices/memosSlice';
import StickyNote from './StickyNote';
import { FiEdit, FiPlus } from 'react-icons/fi';

const MEMO_COLORS = [
  '#fef3c7', // yellow
  '#fecaca', // red
  '#bfdbfe', // blue
  '#bbf7d0', // green
  '#e9d5ff', // purple
  '#fed7d7', // pink
];

export default function FloatingMemoManager() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { memos, isLoading, error, isManagerVisible } = useAppSelector((state) => state.memos);

  // 컴포넌트 마운트시 메모 불러오기
  useEffect(() => {
    if (user?.role === 'master') {
      dispatch(fetchMemos());
    }
  }, [dispatch, user]);

  // 에러 알림
  useEffect(() => {
    if (error) {
      console.error('메모 오류:', error);
      // 3초 후 에러 메시지 클리어
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  // 마스터 권한이 없으면 렌더링하지 않음
  if (user?.role !== 'master') {
    return null;
  }

  // 새 메모 생성
  const handleCreateMemo = () => {
    const randomColor = MEMO_COLORS[Math.floor(Math.random() * MEMO_COLORS.length)];
    const randomPosition = {
      x: Math.random() * (window.innerWidth - 300) + 50,
      y: Math.random() * (window.innerHeight - 200) + 50,
    };

    dispatch(createMemo({
      title: '새 메모',
      content: '',
      position: randomPosition,
      color: randomColor,
    }));
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      <div className="fixed bottom-24 right-6 z-50">
        <div className="flex flex-col items-end gap-3">
          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm max-w-xs">
              {error}
            </div>
          )}
          
          {/* 새 메모 추가 버튼 - 메모 매니저가 열려있을 때만 표시 */}
          {isManagerVisible && (
            <button
              onClick={handleCreateMemo}
              disabled={isLoading}
              className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              title="새 메모 추가"
            >
              <FiPlus size={20} />
            </button>
          )}
          
          {/* 메모 매니저 토글 버튼 */}
          <button
            onClick={() => dispatch(toggleMemoManager())}
            className={`p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110 ${
              isManagerVisible 
                ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            title={isManagerVisible ? "메모 숨기기" : "메모 보기"}
          >
            <FiEdit size={20} />
          </button>
        </div>
      </div>

      {/* 메모들 렌더링 */}
      {isManagerVisible && (
        <div className="fixed inset-0 z-40" style={{ pointerEvents: 'none' }}>
          <div className="relative w-full h-full">
            {memos.map((memo) => (
              <div key={memo._id} style={{ pointerEvents: 'auto' }}>
                <StickyNote memo={memo} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메모 수 표시 */}
      {isManagerVisible && memos.length > 0 && (
        <div className="fixed bottom-6 left-6 z-50">
          <div className="bg-black bg-opacity-70 text-white px-3 py-2 rounded-lg text-sm">
            활성 메모: {memos.filter(m => !m.isMinimized).length}/{memos.length}
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="fixed bottom-36 right-6 z-50">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            메모 처리 중...
          </div>
        </div>
      )}
    </>
  );
}