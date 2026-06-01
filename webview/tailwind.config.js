/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy (deprecated, remove after migration)
        'ide-bg': 'var(--ide-bg)',
        'ide-fg': 'var(--ide-fg)',
        'ide-border': 'var(--ide-border)',
        'ide-accent': 'var(--ide-accent)',
        'ide-error': 'var(--ide-error)',
        'ide-warning': 'var(--ide-warning)',
        'ide-success': 'var(--ide-success)',

        // Surface
        surface: {
          base: 'var(--surface-base)',
          raised: 'var(--surface-raised)',
          overlay: 'var(--surface-overlay)',
          sunken: 'var(--surface-sunken)',
          hover: 'var(--surface-hover)',
          pressed: 'var(--surface-pressed)',
          selected: 'var(--surface-selected)',
          tooltip: 'var(--surface-tooltip)',
        },

        // Text  (usage: text-text-primary, text-text-secondary ...)
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          disabled: 'var(--text-disabled)',
          inverse: 'var(--text-inverse)',
          link: 'var(--text-link)',
          'on-tooltip': 'var(--text-on-tooltip)',
        },

        // Border (usage: border-border-default, border-border-focus)
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
          divider: 'var(--border-divider)',
        },

        // Accent
        accent: {
          DEFAULT: 'var(--accent-primary)',
          primary: 'var(--accent-primary)',
          'primary-hover': 'var(--accent-primary-hover)',
          'primary-pressed': 'var(--accent-primary-pressed)',
          'primary-fg': 'var(--accent-primary-fg)',
          'primary-subtle': 'var(--accent-primary-subtle)',
          claude: 'var(--accent-claude)',
          'claude-hover': 'var(--accent-claude-hover)',
        },

        // State (usage: bg-state-success-bg, text-state-success-fg)
        state: {
          'success-bg':     'var(--state-success-bg)',
          'success-fg':     'var(--state-success-fg)',
          'success-border': 'var(--state-success-border)',
          'warning-bg':     'var(--state-warning-bg)',
          'warning-fg':     'var(--state-warning-fg)',
          'warning-border': 'var(--state-warning-border)',
          'error-bg':       'var(--state-error-bg)',
          'error-fg':       'var(--state-error-fg)',
          'error-border':   'var(--state-error-border)',
          'info-bg':        'var(--state-info-bg)',
          'info-fg':        'var(--state-info-fg)',
          'info-border':    'var(--state-info-border)',
          'pending-bg':     'var(--state-pending-bg)',
          'pending-fg':     'var(--state-pending-fg)',
          'pending-border': 'var(--state-pending-border)',
        },

        // Overlay (usage: bg-overlay-scrim)
        overlay: {
          scrim: 'var(--overlay-scrim)',
          dim: 'var(--overlay-dim)',
        },

        // Tool call rows (usage: text-tool-label-fg)
        tool: {
          'label-fg': 'var(--tool-label-fg)',
        },
      },
      boxShadow: {
        'token-sm': 'var(--shadow-sm)',
        'token-md': 'var(--shadow-md)',
        'token-lg': 'var(--shadow-lg)',
      },
      ringColor: {
        focus: 'var(--border-focus)',
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
