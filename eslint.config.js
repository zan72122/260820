import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['tests/**/*.js', 'vite.config.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
];
