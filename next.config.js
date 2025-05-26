/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🚀 Vercel 배포 최적화 설정
  
  // SWC 미니파이어 활성화 (Vercel 권장)
  swcMinify: true,
  
  // 이미지 최적화는 Vercel에서 자동 처리되므로 활성화
  images: {
    // Vercel에서는 최적화 활성화 권장
    unoptimized: false,
    // 외부 이미지 도메인 설정 (필요시)
    domains: [],
  },
  
  // 웹팩 설정 - Vercel 친화적
  webpack: (config, { isServer }) => {
    // 파일 시스템 폴백 (API 라우트용)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // ⚠️ Vercel에서는 최적화 활성화 권장
    // config.optimization.minimize = false; // 제거!
    
    return config;
  },
  
  // 🎯 Vercel에서는 standalone 불필요 (자동 처리)
  // output: 'standalone', // 제거!
  
  // 🎯 Vercel에서는 파일 추적 활성화 권장
  // outputFileTracing: false, // 제거!
  
  // 실험적 기능 - MongoDB 외부 패키지
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  
  // ESLint 설정
  eslint: {
    // 빌드 시 린트 에러로 실패하지 않도록
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  
  // TypeScript 설정
  typescript: {
    // 빌드 시 타입 에러로 실패하지 않도록 (임시)
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;