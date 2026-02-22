'use client';

// src/app/v2/api-docs/page.tsx
// Swagger UI를 렌더링하는 API 문서 페이지

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div style={{ height: '100vh' }}>
      <SwaggerUI url="/api/docs" />
    </div>
  );
}
