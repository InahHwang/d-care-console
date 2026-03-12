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
  
  // 🔥 API 라우트 최적화 + 보안 헤더 (상용화 Step 2)
  async headers() {
    // 공통 보안 헤더
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    // Vercel HTTPS 환경에서만 HSTS 적용 (로컬 개발 시 제외)
    if (process.env.VERCEL) {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [
      // 모든 페이지에 보안 헤더 적용
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // CORS 헤더 - 외부 웹훅 연동용 (네이버톡톡, 카카오, 인스타그램)
      {
        source: '/api/v2/webhooks/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      // CORS 헤더 - 채널챗 외부 연동용
      {
        source: '/api/v2/channel-chats/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      // CORS 헤더 - 외부 임베드 위젯용
      {
        source: '/widget/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
      // API 캐시 비활성화
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
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