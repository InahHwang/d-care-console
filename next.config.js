/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 빌드 최적화 설정
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
  // 파일 크기 제한 완화
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;