const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 배포 최적화
  experimental: {
    serverComponentsExternalPackages: ['mongodb', 'sharp'],
  },
  
  // 🔥 성능 최적화 설정
  swcMinify: true, // SWC 압축 활성화
  compress: true,  // gzip 압축 활성화
  
  // 이미지 처리 설정
  images: {
    domains: ['localhost'],
    unoptimized: true, // Vercel에서 이미지 최적화 문제 해결
  },
  
  // 🔥 API 라우트 최적화 (속도개선 2 버전) + 보안 헤더
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
  
  // 환경 변수 런타임 설정
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Webpack 설정 (Sharp 라이브러리 최적화)
  webpack: (config, { dev, isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('sharp');
    }
    
    return config;
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Sentry 빌드 플러그인 옵션
  silent: true,           // 빌드 로그 억제
  hideSourceMaps: true,   // 소스맵 클라이언트 노출 방지
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
});