import { test, expect } from '@playwright/test'

test('app boots and renders the dashboard', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await expect(page.getByTestId('app-root')).toBeVisible()
  await page.screenshot({ path: 'e2e-screens/smoke-dashboard.png' })
  expect(errors).toEqual([])
})
