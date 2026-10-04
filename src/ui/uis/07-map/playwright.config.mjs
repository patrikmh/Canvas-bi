import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const port = process.env.E2E_PORT ?? '4431'
export default defineConfig({
  testDir: '..', testMatch: '**/{07-map,08-comic,09-postcard,10-gallery}/*.pw.ts',
  timeout: 60000, expect: { timeout: 15000 }, workers: 1, reporter: 'list', outputDir: '/tmp/ui3-playwright-results',
  use: { baseURL: `http://127.0.0.1:${port}`, locale: 'sv-SE' },
  webServer: { command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`, cwd: fileURLToPath(new URL('../../../../', import.meta.url)), url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }, { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } }],
})
