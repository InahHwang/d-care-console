// src/components/common/EnvironmentBanner.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface EnvironmentInfo {
  environment: string;
  database: string;
  isProduction: boolean;
}

const EnvironmentBanner: React.FC = () => {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);

  useEffect(() => {
    fetch('/api/admin/environment')
      .then(res => res.json())
      .then(setEnvInfo)
      .catch(console.error);
  }, []);

  if (!envInfo || envInfo.isProduction) return null;

  return (
    <div className="bg-yellow-400 text-black px-4 py-2 text-sm font-bold text-center border-b">
      🚧 개발 환경 - 데이터베이스: {envInfo.database}
    </div>
  );
};

export default EnvironmentBanner;