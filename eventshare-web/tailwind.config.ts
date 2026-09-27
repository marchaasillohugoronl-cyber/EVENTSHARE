import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F2F3EF',
        ink: '#17191C',
        muted: '#6B7075',
        line: '#DCDED8',
        brand: 'rgb(var(--brand-rgb) / <alpha-value>)',
        onbrand: 'rgb(var(--on-brand-rgb) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
        sheet: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        reveal: 'reveal 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        pop: 'pop 0.3s ease-out',
        sheet: 'sheet 0.3s cubic-bezier(0.2, 0.7, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
