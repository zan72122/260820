import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        performance: 'readonly', requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly', setTimeout: 'readonly',
        clearTimeout: 'readonly', localStorage: 'readonly',
        console: 'readonly', HTMLElement: 'readonly', HTMLCanvasElement: 'readonly',
        PointerEvent: 'readonly', TouchEvent: 'readonly', Event: 'readonly',
        AudioContext: 'readonly', devicePixelRatio: 'readonly',
        ImageData: 'readonly', URLSearchParams: 'readonly', location: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
);
