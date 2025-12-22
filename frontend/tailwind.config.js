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
          50: '#ffffff',
          100: '#fafafa',
          200: '#f5f5f5',
          300: '#e8e8e8',
          400: '#d4d4d4',
          500: '#a3a3a3',
          600: '#737373',
          700: '#525252',
          800: '#404040',
          900: '#262626',
        },
        'ink': {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        'gold': {
          50: '#fff5f3',
          100: '#ffe8e4',
          200: '#ffd0c7',
          300: '#ffab9c',
          400: '#ff7a66',
          500: '#ff2400',
          600: '#e62000',
          700: '#c01a00',
          800: '#991500',
          900: '#801200',
        },
        'amber': {
          50: '#fffbf0',
          100: '#fff3d4',
          200: '#ffe6a8',
          300: '#ffd770',
          400: '#ffc53d',
          500: '#f0a500',
          600: '#cc8800',
          700: '#a66d00',
          800: '#855700',
          900: '#6b4600',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'mic-pulse': 'micPulse 2s ease-in-out infinite',
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
        micPulse: {
          '0%, 100%': { 
            filter: 'drop-shadow(0 0 8px rgba(255, 36, 0, 0.6))',
            transform: 'scale(1)',
          },
          '50%': { 
            filter: 'drop-shadow(0 0 16px rgba(255, 36, 0, 0.8))',
            transform: 'scale(1.05)',
          },
        },
      },
    },
  },
  plugins: [],
}
