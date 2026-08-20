import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'e2e/**/*.js', 'test/**/*.js', 'tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        globalThis: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        URLSearchParams: 'readonly',
        AudioContext: 'readonly',
        WebGL2RenderingContext: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        HTMLCanvasElement: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'error',
    },
  },
];
