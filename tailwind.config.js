/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f6f7',
          100: '#e1e1e3',
          200: '#c2c2c6',
          300: '#9a9aa1',
          400: '#6e6e78',
          500: '#4a4a54',
          600: '#34343c',
          700: '#25252b',
          800: '#161619',
          900: '#0a0a0b',
          950: '#050505',
        },
        gold: {
          50: '#fbf7ec',
          100: '#f5eccf',
          200: '#ecd99e',
          300: '#e2c46d',
          400: '#d4af37',
          500: '#bd9a2c',
          600: '#9a7a22',
          700: '#735b1a',
          800: '#4d3c11',
          900: '#2a2109',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.25em',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'shimmer': 'shimmer 1.5s infinite linear',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
};
