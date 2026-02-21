import React, { useState } from 'react';

// 치아 번호 데이터 (FDI 국제 표기법)
const teethData = {
  upperPermanent: {
    right: [18, 17, 16, 15, 14, 13, 12, 11],
    left: [21, 22, 23, 24, 25, 26, 27, 28]
  },
  lowerPermanent: {
    right: [48, 47, 46, 45, 44, 43, 42, 41],
    left: [31, 32, 33, 34, 35, 36, 37, 38]
  },
  upperPrimary: {
    right: [55, 54, 53, 52, 51],
    left: [61, 62, 63, 64, 65]
  },
  lowerPrimary: {
    right: [85, 84, 83, 82, 81],
    left: [71, 72, 73, 74, 75]
  }
};

const allPermanentTeeth = [
  ...teethData.upperPermanent.right,
  ...teethData.upperPermanent.left,
  ...teethData.lowerPermanent.right,
  ...teethData.lowerPermanent.left
];

export default function ToothSelector() {
  const [selectedTeeth, setSelectedTeeth] = useState([]);
  const [showPrimary, setShowPrimary] = useState(false);

  const toggleTooth = (toothNum) => {
    setSelectedTeeth(prev =>
      prev.includes(toothNum)
        ? prev.filter(t => t !== toothNum)
        : [...prev, toothNum]
    );
  };

  const upperTeeth = [
    ...teethData.upperPermanent.right,
    ...teethData.upperPermanent.left
  ];

  const lowerTeeth = [
    ...teethData.lowerPermanent.right,
    ...teethData.lowerPermanent.left
  ];

  const toggleTeethGroup = (teeth) => {
    const allSelected = teeth.every(t => selectedTeeth.includes(t));
    if (allSelected) {
      setSelectedTeeth(prev => prev.filter(t => !teeth.includes(t)));
    } else {
      setSelectedTeeth(prev => {
        const newTeeth = teeth.filter(t => !prev.includes(t));
        return [...prev, ...newTeeth];
      });
    }
  };

  const isGroupFullySelected = (teeth) => {
    return teeth.every(t => selectedTeeth.includes(t));
  };

  const ToothButton = ({ num, size = 'normal' }) => {
    const isSelected = selectedTeeth.includes(num);
    const sizeClasses = size === 'small' 
      ? 'w-6 h-6 text-xs' 
      : 'w-7 h-7 text-xs';
    
    return (
      <button
        onClick={() => toggleTooth(num)}
        className={`
          ${sizeClasses} rounded font-medium transition-all flex-shrink-0
          ${isSelected 
            ? 'bg-rose-600 text-white shadow-md' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }
        `}
      >
        {num}
      </button>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded-2xl shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">🦷 불편한 치아 선택</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showPrimary}
            onChange={(e) => setShowPrimary(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          유치 표시
        </label>
      </div>

      {/* 치아 차트 */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        
        {/* 상악 영구치 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleTeethGroup(upperTeeth)}
            className={`w-16 text-sm font-bold text-left flex-shrink-0 transition-colors ${
              isGroupFullySelected(upperTeeth) 
                ? 'text-rose-600' 
                : 'text-gray-700 hover:text-rose-600'
            }`}
          >
            상악
          </button>
          <div className="flex gap-0.5">
            {teethData.upperPermanent.right.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
          <div className="w-px h-6 bg-gray-400"></div>
          <div className="flex gap-0.5">
            {teethData.upperPermanent.left.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
        </div>

        {/* 상악 유치 */}
        {showPrimary && (
          <div className="flex items-center gap-3">
            <div className="w-16 text-xs text-gray-500 text-left flex-shrink-0">유치</div>
            <div className="flex gap-0.5 justify-end" style={{ width: '192px' }}>
              {teethData.upperPrimary.right.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
            <div className="w-px h-5 bg-gray-300"></div>
            <div className="flex gap-0.5">
              {teethData.upperPrimary.left.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
          </div>
        )}

        {/* 구분선 + 전체선택 */}
        <div className="flex items-center gap-3 py-1">
          <button
            onClick={() => toggleTeethGroup(allPermanentTeeth)}
            className={`w-16 text-sm font-bold text-left flex-shrink-0 transition-colors ${
              isGroupFullySelected(allPermanentTeeth) 
                ? 'text-blue-600' 
                : 'text-gray-700 hover:text-blue-600'
            }`}
          >
            {isGroupFullySelected(allPermanentTeeth) ? '전체해제' : '전체선택'}
          </button>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* 하악 유치 */}
        {showPrimary && (
          <div className="flex items-center gap-3">
            <div className="w-16 text-xs text-gray-500 text-left flex-shrink-0">유치</div>
            <div className="flex gap-0.5 justify-end" style={{ width: '192px' }}>
              {teethData.lowerPrimary.right.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
            <div className="w-px h-5 bg-gray-300"></div>
            <div className="flex gap-0.5">
              {teethData.lowerPrimary.left.map(num => (
                <ToothButton key={num} num={num} size="small" />
              ))}
            </div>
          </div>
        )}

        {/* 하악 영구치 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleTeethGroup(lowerTeeth)}
            className={`w-16 text-sm font-bold text-left flex-shrink-0 transition-colors ${
              isGroupFullySelected(lowerTeeth) 
                ? 'text-rose-600' 
                : 'text-gray-700 hover:text-rose-600'
            }`}
          >
            하악
          </button>
          <div className="flex gap-0.5">
            {teethData.lowerPermanent.right.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
          <div className="w-px h-6 bg-gray-400"></div>
          <div className="flex gap-0.5">
            {teethData.lowerPermanent.left.map(num => (
              <ToothButton key={num} num={num} />
            ))}
          </div>
        </div>
      </div>

      {/* 선택된 치아 표시 */}
      <div className="mt-3 p-3 bg-blue-50 rounded-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-blue-600 font-medium">선택된 치아</span>
            <div className="mt-1">
              {selectedTeeth.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedTeeth.sort((a, b) => a - b).map(num => (
                    <span
                      key={num}
                      className="px-2 py-0.5 bg-rose-600 text-white text-xs rounded font-medium"
                    >
                      #{num}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 text-sm">치아를 선택해주세요</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <span className="text-2xl font-bold text-blue-600">{selectedTeeth.length}</span>
            <span className="text-sm text-blue-500 ml-1">개</span>
          </div>
        </div>
      </div>
    </div>
  );
}
