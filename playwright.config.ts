import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.E2E_PORT ?? '4317'
// e2e runs against the BUILT static site (vite preview of dist/), like the real deploy.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:' + PORT, viewport: { width: 1440, height: 900 }, locale: 'sv-SE' },
  webServer: {
    command: 'npx vite preview --port ' + PORT + ' --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:' + PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
