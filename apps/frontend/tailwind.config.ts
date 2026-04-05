/**
 * Tailwind CSS v4 configuration for the GST Reconciliation frontend.
 * Phase 1: Base configuration.
 * Phase 7: Added Noto Sans (heading/body) and Fira Code (mono) font families.
 * Phase 9: Added darkMode: 'class' and semantic CSS variable color mappings.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['Fira Code', 'ui-monospace', 'Cascadia Code', 'Source Code Pro', 'monospace'],
      },
      colors: {
        /* Brand */
        primary:   { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        accent:    { DEFAULT: 'var(--accent)',  foreground: 'var(--accent-foreground)'  },

        /* Backgrounds & surfaces */
        background: 'var(--background)',
        surface:    'var(--surface)',
        muted:      { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },

        /* Text */
        foreground: 'var(--foreground)',

        /* Borders */
        border: 'var(--border)',
        ring:   'var(--ring)',

        /* Info */
        info: 'var(--info)',

        /* Status badges */
        status: {
          'success-bg':   'var(--status-success-bg)',
          'success-text': 'var(--status-success-text)',
          'warning-bg':   'var(--status-warning-bg)',
          'warning-text': 'var(--status-warning-text)',
          'danger-bg':    'var(--status-danger-bg)',
          'danger-text':  'var(--status-danger-text)',
        },

        /* Sidebar */
        sidebar: {
          bg:     'var(--sidebar-bg)',
          fg:     'var(--sidebar-fg)',
          accent: 'var(--sidebar-accent)',
          border: 'var(--sidebar-border)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
