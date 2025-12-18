/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Crimson Text', 'Georgia', 'serif'],
        'display': ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        'parchment': {
          50: '#fefdfb',
          100: '#fdf9f3',
          200: '#f8f0e3',
          300: '#f0e4ce',
          400: '#e4d2b0',
          500: '#d4bc8c',
          600: '#c4a66a',
          700: '#a88b4a',
          800: '#8a7139',
          900: '#6d592e',
        },
        'ink': {
          50: '#f6f5f4',
          100: '#e8e6e3',
          200: '#d4d0c9',
          300: '#b8b1a6',
          400: '#9a9184',
          500: '#7f7567',
          600: '#6a6257',
          700: '#574f47',
          800: '#4a433d',
          900: '#3d3832',
          950: '#2a2622',
        },
        'gold': {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#c9a227',
          600: '#a17e1e',
          700: '#7a5f18',
          800: '#634c16',
          900: '#4d3b12',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
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
      },
    },
  },
  plugins: [],
}

