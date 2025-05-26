/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 최적화 설정
  experimental: {
    optimizePackageImports: ['@heroicons/react'],
  },
  
  // 정적 생성에서 제외할 경로
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
  
  // 웹팩 설정 - 빌드 에러 해결
  webpack: (config, { isServer }) => {
    // 파일 시스템 폴백 설정
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // 빌드 추적에서 제외할 패턴들
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/public/uploads/**',
        '**/public/다운로드/**',
        '**/*.pdf',
        '**/*.hwp',
      ],
    };
    
    return config;
  },
  
  // 빌드 추적에서 제외할 파일들
  outputFileTracingIncludes: {
    '/': ['./public/**/*'],
  },
  
  // 이미지 최적화 설정
  images: {
    domains: [],
    unoptimized: true, // 빌드 에러 방지
  },
};

module.exports = nextConfig;