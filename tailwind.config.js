/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 브랜드 컬러 (catchall.ai.kr 기반 오렌지 톤)
        'primary': '#ff7a00',
        'primary-light': '#ffa24d',
        'primary-pale': '#fff1e6',
        'secondary': '#222222',
        'light-bg': '#f9fafb',
        'dark-bg': '#1a1a2e',
        'sidebar': '#1e1e2d',
        'sidebar-active': '#2d2d44',
        'text-primary': '#222222',
        'text-secondary': '#666666',
        'text-muted': '#99a1af',
        'border': '#e5e7eb',
        // 상태 색상
        'success': '#2ecc71',
        'warning': '#ffab00',
        'error': '#e74c3c',
        'info': '#0288d1',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0,0,0,0.05)',
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}