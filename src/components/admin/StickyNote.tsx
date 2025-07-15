// src/components/admin/StickyNote.tsx

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch } from '@/hooks/reduxHooks';
import { 
  updateMemo, 
  deleteMemo, 
  updateMemoPosition, 
  updateMemoSize, 
  bringMemoToFront, 
  toggleMemoMinimized 
} from '@/store/slices/memosSlice';
import { Memo } from '@/types/memo';
import { FiMinus, FiX, FiMaximize2, FiEdit3, FiSave } from 'react-icons/fi';

interface StickyNoteProps {
  memo: Memo;
}

const MEMO_COLORS = [
  '#fef3c7', // yellow
  '#fecaca', // red
  '#bfdbfe', // blue
  '#bbf7d0', // green
  '#e9d5ff', // purple
  '#fed7d7', // pink
];

// 디바운스 함수
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function StickyNote({ memo }: StickyNoteProps) {
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(memo.title);
  const [editContent, setEditContent] = useState(memo.content);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  // 드래그 중 임시 위치와 크기 (로컬 상태)
  const [tempPosition, setTempPosition] = useState(memo.position);
  const [tempSize, setTempSize] = useState(memo.size);
  
  const noteRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // memo가 변경될 때 임시 상태 동기화
  useEffect(() => {
    if (!isDragging && !isResizing) {
      setTempPosition(memo.position);
      setTempSize(memo.size);
    }
  }, [memo.position, memo.size, isDragging, isResizing]);

  // 디바운스된 API 호출 함수들
  const debouncedUpdatePosition = useCallback(
    debounce((position: { x: number; y: number }) => {
      dispatch(updateMemo({
        id: memo._id,
        updates: { position }
      }));
    }, 300), // 300ms 후 API 호출
    [memo._id, dispatch]
  );

  const debouncedUpdateSize = useCallback(
    debounce((size: { width: number; height: number }) => {
      dispatch(updateMemo({
        id: memo._id,
        updates: { size }
      }));
    }, 300), // 300ms 후 API 호출
    [memo._id, dispatch]
  );

  // 메모를 최상단으로 가져오기
  const handleBringToFront = useCallback(() => {
    dispatch(bringMemoToFront(memo._id));
  }, [dispatch, memo._id]);

  // 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('드래그 시도:', { 
      isEditing, 
      target: e.target, 
      isButton: !!(e.target as HTMLElement).closest('button'),
      isTextarea: e.target === contentRef.current 
    });
    
    // 편집 모드이거나 버튼 클릭시에는 드래그 방지
    if (isEditing || 
        (e.target as HTMLElement).closest('button') || 
        e.target === contentRef.current ||
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA') {
      console.log('드래그 방지됨');
      return;
    }
    
    console.log('드래그 시작!');
    setIsDragging(true);
    setDragStart({
      x: e.clientX - tempPosition.x,
      y: e.clientY - tempPosition.y,
    });
    handleBringToFront();
    e.preventDefault();
    e.stopPropagation();
  }, [isEditing, tempPosition, handleBringToFront]);

  // 리사이즈 시작
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: tempSize.width,
      height: tempSize.height,
    });
    handleBringToFront();
    e.preventDefault();
    e.stopPropagation();
  }, [tempSize, handleBringToFront]);

  // 마우스 이동 처리
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newPosition = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };
        
        // 화면 경계 체크
        const maxX = window.innerWidth - tempSize.width;
        const maxY = window.innerHeight - tempSize.height;
        
        newPosition.x = Math.max(0, Math.min(newPosition.x, maxX));
        newPosition.y = Math.max(0, Math.min(newPosition.y, maxY));
        
        // 로컬 상태만 즉시 업데이트 (부드러운 드래그)
        setTempPosition(newPosition);
      } else if (isResizing) {
        const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(150, resizeStart.height + (e.clientY - resizeStart.y));
        
        // 로컬 상태만 즉시 업데이트 (부드러운 리사이즈)
        setTempSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        console.log('드래그 완료 - 위치 업데이트:', tempPosition);
        
        // 1. 즉시 Redux 상태 업데이트 (UI 반응성)
        dispatch(updateMemoPosition({ id: memo._id, position: tempPosition }));
        
        // 2. 디바운스된 API 호출 (네트워크 최적화)
        debouncedUpdatePosition(tempPosition);
      }
      if (isResizing) {
        setIsResizing(false);
        console.log('리사이즈 완료 - 크기 업데이트:', tempSize);
        
        // 1. 즉시 Redux 상태 업데이트 (UI 반응성)
        dispatch(updateMemoSize({ id: memo._id, size: tempSize }));
        
        // 2. 디바운스된 API 호출 (네트워크 최적화)
        debouncedUpdateSize(tempSize);
      }
    };

    if (isDragging || isResizing) {
      // passive: false로 preventDefault 허용
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [
    isDragging, 
    isResizing, 
    dragStart, 
    resizeStart, 
    tempPosition, 
    tempSize, 
    memo._id, 
    dispatch, 
    debouncedUpdatePosition, 
    debouncedUpdateSize
  ]);

  // 편집 모드 저장
  const handleSave = useCallback(() => {
    dispatch(updateMemo({
      id: memo._id,
      updates: { 
        title: editTitle.trim() || '제목 없음', 
        content: editContent 
      }
    }));
    setIsEditing(false);
    
    // 저장 후 포커스 제거
    if (contentRef.current) {
      contentRef.current.blur();
    }
  }, [dispatch, memo._id, editTitle, editContent]);

  // 편집 취소
  const handleCancelEdit = useCallback(() => {
    setEditTitle(memo.title);
    setEditContent(memo.content);
    setIsEditing(false);
    
    // 취소 후 포커스 제거
    if (contentRef.current) {
      contentRef.current.blur();
    }
  }, [memo.title, memo.content]);

  // 메모 삭제
  const handleDelete = useCallback(() => {
    if (window.confirm('이 메모를 삭제하시겠습니까?')) {
      dispatch(deleteMemo(memo._id));
    }
  }, [dispatch, memo._id]);

  // 최소화/복원
  const handleToggleMinimize = useCallback(() => {
    dispatch(toggleMemoMinimized(memo._id));
    dispatch(updateMemo({
      id: memo._id,
      updates: { isMinimized: !memo.isMinimized }
    }));
  }, [dispatch, memo._id, memo.isMinimized]);

  // 색상 변경
  const handleColorChange = useCallback((color: string) => {
    dispatch(updateMemo({
      id: memo._id,
      updates: { color }
    }));
  }, [dispatch, memo._id]);

  return (
    <div
      ref={noteRef}
      className={`absolute border-2 border-gray-300 rounded-lg shadow-lg select-none transition-all duration-200 ${
        isDragging ? 'shadow-2xl scale-105' : ''
      } ${memo.isMinimized ? 'h-10' : ''}`}
      style={{
        left: tempPosition.x,
        top: tempPosition.y,
        width: tempSize.width,
        height: memo.isMinimized ? 40 : tempSize.height,
        backgroundColor: memo.color,
        zIndex: memo.zIndex,
        cursor: isDragging ? 'grabbing' : (isEditing ? 'default' : 'grab'),
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s ease',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleBringToFront}
    >
      {/* 헤더 */}
      <div 
        className="flex items-center justify-between p-2 border-b border-gray-300 bg-black bg-opacity-10 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex-1 min-w-0">
          {isEditing && !memo.isMinimized ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-sm font-medium bg-transparent border-none outline-none placeholder-gray-500"
              placeholder="메모 제목"
              autoFocus
            />
          ) : (
            <h3 className="text-sm font-medium truncate text-gray-800">
              {memo.title || '제목 없음'}
            </h3>
          )}
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          {/* 색상 변경 */}
          {!memo.isMinimized && (
            <div className="flex gap-1">
              {MEMO_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleColorChange(color);
                  }}
                  className={`w-3 h-3 rounded-full border border-gray-400 hover:scale-110 transition-transform ${
                    memo.color === color ? 'ring-2 ring-gray-600' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
          
          {/* 편집/저장 버튼 */}
          {!memo.isMinimized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
              title={isEditing ? "저장" : "편집"}
            >
              {isEditing ? <FiSave size={12} /> : <FiEdit3 size={12} />}
            </button>
          )}
          
          {/* 최소화/복원 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleMinimize();
            }}
            className="p-1 rounded hover:bg-black hover:bg-opacity-10 transition-colors"
            title={memo.isMinimized ? "복원" : "최소화"}
          >
            {memo.isMinimized ? <FiMaximize2 size={12} /> : <FiMinus size={12} />}
          </button>
          
          {/* 삭제 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-1 rounded hover:bg-red-200 transition-colors text-red-600"
            title="삭제"
          >
            <FiX size={12} />
          </button>
        </div>
      </div>

      {/* 내용 */}
      {!memo.isMinimized && (
        <div className="flex-1 p-2" style={{ height: tempSize.height - 40 }}>
          {isEditing ? (
            <div className="h-full flex flex-col gap-2">
              <textarea
                ref={contentRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()} // 드래그 이벤트 방지
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSave();
                  }
                }}
                className="flex-1 w-full bg-transparent border-none outline-none resize-none text-sm placeholder-gray-500"
                placeholder="메모 내용을 입력하세요..."
                style={{ minHeight: tempSize.height - 80 }}
              />
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div 
              className="h-full overflow-auto text-sm text-gray-700 whitespace-pre-wrap cursor-text"
              onClick={(e) => {
                e.stopPropagation();
                if (!isEditing) {
                  setIsEditing(true);
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation(); // 드래그 이벤트 방지
              }}
            >
              {memo.content || '내용을 입력하려면 클릭하세요...'}
            </div>
          )}
        </div>
      )}

      {/* 리사이즈 핸들 */}
      {!memo.isMinimized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400"></div>
        </div>
      )}
    </div>
  );
}