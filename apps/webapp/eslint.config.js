import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'storybook-static', 'src/api/generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  // Guardrail: feature silo — a feature never imports from another feature.
  // Anything imported from outside your own feature must use the '@/' alias,
  // so cross-feature imports are detectable here.
  {
    name: 'guardrails/feature-silo',
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*'],
              message:
                'Features must not import from other features. Promote shared code to the global folders (components/, hooks/, helpers/).',
            },
          ],
        },
      ],
    },
  },
  // Guardrail: all API calls go through the typed OpenAPI client.
  {
    name: 'guardrails/api-client-only',
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/api/**',
      '**/__tests__/**',
      '**/*.test.{ts,tsx}',
      'src/test-setup.ts',
      'src/stories/**',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use fetchClient from @/api/client (typed by the OpenAPI contract) instead of raw fetch.',
        },
      ],
    },
  },
])
