// /src/components/widget/WidgetContainer.tsx

'use client';

import { useState } from 'react';
import { FiPhone, FiX, FiMinus } from 'react-icons/fi';
import QuickPatientForm from './QuickPatientForm';


interface WidgetContainerProps {
  className?: string;
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleWidget = () => {
    if (isMinimized) {
      setIsMinimized(false);
      setIsOpen(true);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const minimizeWidget = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMinimized(true);
    setIsOpen(false);
  };

  const closeWidget = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsMinimized(false);
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* 위젯 버튼 */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={toggleWidget}
          className={`
            flex items-center justify-center w-14 h-14 
            bg-blue-600 hover:bg-blue-700 text-white 
            rounded-full shadow-lg transition-all duration-300
            ${isMinimized ? 'animate-pulse' : 'hover:scale-110'}
          `}
          title="인바운드 상담 등록"
        >
          <FiPhone className="w-6 h-6" />
        </button>
      )}

      {/* 위젯 패널 */}
      {isOpen && !isMinimized && (
        <div className="absolute bottom-16 right-0 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* 헤더 */}
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FiPhone className="w-4 h-4" />
              <span className="font-semibold text-sm">인바운드 상담</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={minimizeWidget}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                title="최소화"
              >
                <FiMinus className="w-3 h-3" />
              </button>
              <button
                onClick={closeWidget}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                title="닫기"
              >
                <FiX className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* 컨텐츠 */}
          <div className="p-4">
            <QuickPatientForm onSuccess={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default WidgetContainer;