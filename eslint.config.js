import js from '@eslint/js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/*.js'],
  },
];
