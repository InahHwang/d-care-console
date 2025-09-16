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
  
  // 🔥 API 라우트 최적화
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
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

module.exports = nextConfig