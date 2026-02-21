// src/app/v2/reports/mobile/[date]/error.tsx
'use client';

import { useEffect } from 'react';

export default function MobileReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[MobileReport Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">보고서 로딩 오류</h2>
        <p className="text-sm text-gray-600 mb-2">
          {error.message || '알 수 없는 오류가 발생했습니다.'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">오류 코드: {error.digest}</p>
        )}
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            다시 시도
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
