/**
 * Tailwind CSS v4 configuration for the GST Reconciliation frontend.
 * Phase 1: Base configuration.
 * Phase 7: Added Noto Sans (heading/body) and Fira Code (mono) font families.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    ['Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['Fira Code', 'ui-monospace', 'Cascadia Code', 'Source Code Pro', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
