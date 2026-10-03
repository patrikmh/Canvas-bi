import { test, expect } from '@playwright/test'

test('app boots and renders the dashboard', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const externalRequests: string[] = []
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      externalRequests.push(url.href)
      await route.abort()
    } else await route.continue()
  })
  await page.goto('/')
  await expect(page.getByTestId('app-root')).toBeVisible()
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('demo-banner')).toHaveText('KONCEPTDEMO – syntetisk demonstrationsdata')
  await expect(page.getByTestId('kpi-revenue')).toContainText(/503\s+tkr/)
  await expect(page.getByTestId('kpi-revenue')).toContainText(/\+9,7\s+% mot augusti i fjol/)
  await expect(page.getByTestId('kpi-margin')).toContainText(/44,7\s+%/)
  await expect(page.getByTestId('kpi-margin')).toContainText(/−6,5\s+p\.e\./)
  await expect(page.getByTestId('kpi-orders')).toContainText('793')
  await expect(page.getByTestId('kpi-customers')).toContainText('627')
  await page.screenshot({ path: 'e2e-screens/smoke-dashboard.png' })
  expect(externalRequests).toEqual([])
  expect(errors).toEqual([])
})
