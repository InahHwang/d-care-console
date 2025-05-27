/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 배포 최적화
  experimental: {
    serverComponentsExternalPackages: ['mongodb', 'sharp'],
  },
  
  // 이미지 처리 설정
  images: {
    domains: ['localhost'],
    unoptimized: true, // Vercel에서 이미지 최적화 문제 해결
    remotePatterns: [
      {
        protocol: 'data',
        hostname: '',
      },
    ],
  },
  
  // API 라우트 설정
  api: {
    bodyParser: {
      sizeLimit: '10mb', // 파일 업로드 크기 제한
    },
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