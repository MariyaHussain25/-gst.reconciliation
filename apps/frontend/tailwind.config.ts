/**
 * Tailwind CSS v4 configuration for the GST Reconciliation frontend.
 * Phase 1: Base configuration with custom color tokens.
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
