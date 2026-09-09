import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      root: fileURLToPath(new URL('./', import.meta.url)),
      environment: 'jsdom',
      include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      exclude: [...configDefaults.exclude, 'dist/**'],
    },
  }),
)
