import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
      'public',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // 全角スペースはUI文言（テンプレート文字列）で意図的に使う
    rules: {
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipTemplates: true },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      // Determinism: world generation and simulation must use the seeded RNG
      // (src/core/rng.ts) so identical seeds rebuild identical worlds.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded rng from src/core/rng.ts instead.',
        },
      ],
    },
  },
)
