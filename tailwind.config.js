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
        // 디자인에서 사용된 색상
        'primary': '#4fc3f7',
        'secondary': '#212b36',
        'light-bg': '#f7f9fc',
        'dark-bg': '#161c24',
        'sidebar': '#212b36',
        'sidebar-active': '#36414c',
        'text-primary': '#212b36',
        'text-secondary': '#637381',
        'text-muted': '#8a94a0',
        'border': '#f1f3f5',
        // 상태 색상
        'success': '#4caf50',
        'warning': '#ffab00',
        'error': '#ff5252',
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