import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/coverage',
    '**/playwright-report',
    '**/test-results',
    'apps/web/src/backend/database.types.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      '**/*.config.{js,ts}',
      'apps/web/e2e/**/*.ts',
      'supabase/**/*.ts',
      'scripts/**/*.{js,ts}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
]);
