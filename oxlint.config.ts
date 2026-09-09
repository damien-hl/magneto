import { defineConfig } from 'oxlint'

export default defineConfig({
  $schema: './node_modules/oxlint/configuration_schema.json',
  plugins: ['eslint', 'typescript', 'unicorn', 'import', 'oxc', 'vue', 'vitest'],

  options: {
    // Type checking performed by vue-tsc
    typeCheck: false,
    typeAware: true,
    maxWarnings: 0,
  },

  rules: {
    // JavaScript / TypeScript
    'no-debugger': 'error',
    'no-console': 'warn',

    'typescript/no-explicit-any': 'warn',
    'typescript/no-floating-promises': 'error',

    // Vue
    'vue/define-props-declaration': ['error', 'type-based'],
    'vue/define-emits-declaration': ['error', 'type-based'],
  },

  overrides: [
    {
      files: ['src/**/*.test.ts', 'src/**/*.spec.ts'],

      env: {
        vitest: true,
      },
    },

    {
      files: ['e2e/**/*.ts', 'playwright.config.ts'],

      env: {
        node: true,
      },
    },

    {
      files: ['vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'],

      env: {
        node: true,
      },
    },
  ],
})
