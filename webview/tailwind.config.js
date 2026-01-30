/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'ide-bg': 'var(--ide-bg)',
        'ide-fg': 'var(--ide-fg)',
        'ide-border': 'var(--ide-border)',
        'ide-accent': 'var(--ide-accent)',
        'ide-error': 'var(--ide-error)',
        'ide-warning': 'var(--ide-warning)',
        'ide-success': 'var(--ide-success)',
      },
      fontFamily: {
        'ide-ui': 'var(--ide-font-ui)',
        'ide-code': 'var(--ide-font-code)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
    }
  },
  plugins: []
};
