import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserSite = repositoryName?.endsWith('.github.io')

// https://vite.dev/config/
export default defineConfig({
  base: repositoryName && !isUserSite ? `/${repositoryName}/` : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
})
