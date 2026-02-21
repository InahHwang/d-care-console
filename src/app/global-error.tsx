// src/app/global-error.tsx
// 루트 레이아웃에서 발생하는 에러를 잡는 글로벌 에러 바운더리
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f9fafb',
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              오류가 발생했습니다
            </h2>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {error.message || '알 수 없는 오류'}
            </p>
            {error.digest && (
              <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
                코드: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '8px',
              }}
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
