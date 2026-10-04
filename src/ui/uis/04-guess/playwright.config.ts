import { defineConfig, devices } from '@playwright/test'
const port = process.env.E2E_PORT ?? '4421'
export default defineConfig({
  testDir: '.', testMatch: 'interaction.e2e.ts', timeout: 60000, expect: { timeout: 15000 }, workers: 1,
  reporter: 'list', use: { baseURL: `http://127.0.0.1:${port}`, locale: 'sv-SE' },
  webServer: { command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`, cwd: '../../../..', url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
