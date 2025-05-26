/** @type {import('next').NextConfig} */
const nextConfig = {
  // 빌드 최적화 비활성화 (에러 해결용)
  swcMinify: false,
  
  // 이미지 최적화 비활성화
  images: {
    unoptimized: true,
  },
  
  // 웹팩 설정 - 빌드 에러 해결
  webpack: (config, { isServer }) => {
    // 파일 시스템 폴백 설정
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // 메모리 한계 증가
    config.optimization.minimize = false;
    
    return config;
  },
  
  // 실험적 기능 비활성화
  experimental: {
    // 모든 실험적 기능 끄기
  },
  
  // 출력 설정
  output: 'standalone',
  
  // 빌드 추적 완전 비활성화
  outputFileTracing: false,
};

module.exports = nextConfig;