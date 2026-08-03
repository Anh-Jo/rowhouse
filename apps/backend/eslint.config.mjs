// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Generated code is never linted (regenerated in CI, not prettier-formatted)
    ignores: ['eslint.config.mjs', 'src/generated/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  // Guardrail: env vars go through the validated singleton, never process.env.
  // NODE_ENV is the one exception (read before env.init(), not in EnvSchema).
  {
    name: 'guardrails/no-direct-process-env',
    files: ['src/**/*.ts'],
    ignores: ['src/config/env.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][computed=false][property.name!='NODE_ENV']",
          message:
            "Read env vars via env.get() from '@/config/env', not process.env. Declare new vars in EnvSchema.",
        },
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value!='NODE_ENV']",
          message:
            "Read env vars via env.get() from '@/config/env', not process.env. Declare new vars in EnvSchema.",
        },
      ],
    },
  },
  // Guardrail: module silo — a module never imports from another module.
  // Anything imported from outside your own module must use the '@/' alias,
  // so cross-module imports are detectable here.
  {
    name: 'guardrails/module-silo',
    files: ['src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*'],
              message:
                'Modules must not import from other modules. Promote shared code to a global folder (helpers/, interceptors/, ...).',
            },
          ],
        },
      ],
    },
  },
);
