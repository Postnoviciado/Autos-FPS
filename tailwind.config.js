/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fbf1e6',
          100: '#f3dfc6',
          200: '#e5c49b',
          300: '#d3a06c',
          400: '#b3743e',
          500: '#8c4f22',
          600: '#6d3a19',
          700: '#533015',
          800: '#3c230f',
          900: '#27170b',
        },
        cream: {
          50: '#fdf7ef',
          100: '#faf0dd',
          200: '#f5e1bb',
          300: '#eed297',
          400: '#e4bd6f',
          500: '#d5a13f',
          600: '#b0762f',
          700: '#8a5824',
          800: '#66401b',
          900: '#473214',
        },
        slate: {
          850: '#172033',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
}
