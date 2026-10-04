import { defineConfig, devices } from '@playwright/test'

const port = process.env.E2E_PORT ?? '4330'

// Deliberately independent of the gate; callers build dist before capturing.
export default defineConfig({
  testDir: './design-shots/spec',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${port}`, locale: 'sv-SE' },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
