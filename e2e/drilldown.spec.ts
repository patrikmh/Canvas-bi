import { test, expect } from '@playwright/test'

test('revenue detail, product bars, order lines, add chart and return to canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Utforska Omsättning', exact: true }).click()
  await expect(page.getByTestId('detail-value')).toHaveText(/503\s+tkr/)
  await expect(page.getByTestId('detail-view')).toContainText(/\+9,7\s+% mot augusti i fjol/)
  await page.screenshot({ path: 'e2e-screens/03-revenue-detail.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Dela upp per produkt' }).click()
  await expect(page.locator('.product-links button').first()).toHaveAttribute('data-testid', 'product-Ullfilt')
  await expect(page.getByRole('img', { name: 'Omsättning per produkt' })).toContainText('Ullfilt')
  await page.screenshot({ path: 'e2e-screens/04-revenue-per-product.png', animations: 'disabled' })
  // Click the actual chart axis label, not an implementation-only navigation hook.
  await page.getByRole('img', { name: 'Omsättning per produkt' }).getByText('Ullfilt', { exact: true }).click()
  await expect(page.getByTestId('orders-table')).toBeVisible()
  await expect(page.getByTestId('detail-view')).toContainText('Orderrader · Ullfilt')
  await expect(page.getByTestId('orders-table').locator('tbody tr').first()).toContainText('2026-08')
  await page.getByRole('button', { name: 'Tillbaka till produkter' }).click()
  await page.getByRole('button', { name: 'Lägg på ytan', exact: true }).click()
  await expect(page.locator('.kind-bars')).toHaveCount(1)
  await page.getByRole('button', { name: 'Utforska Omsättning', exact: true }).click()
  await page.getByRole('button', { name: 'Tillbaka till ytan', exact: true }).click()
  await expect(page.getByTestId('card-insight')).toBeVisible()
})

test('margin product outliers are red and every chart exposes its exact SQL', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Utforska Bruttomarginal', exact: true }).click()
  await page.getByRole('button', { name: 'Dela upp per produkt' }).click()
  for (const product of ['Linnepläd', 'Ullfilt']) {
    await expect(page.getByTestId(`product-${product}`)).toHaveAttribute('data-outlier', 'true')
  }
  expect(await page.getByRole('img', { name: 'Bruttomarginal per produkt' }).locator('svg [fill="#b3263a"]').count()).toBeGreaterThanOrEqual(2)
  await page.screenshot({ path: 'e2e-screens/05-margin-per-product.png', animations: 'disabled' })
  await page.getByTestId('how-detail').click()
  await expect(page.getByTestId('calculation-drawer')).toContainText('FROM sales')
  await expect(page.getByTestId('calculation-drawer')).toContainText('Marginalförändring')
  await page.getByRole('button', { name: 'Stäng beräkningen' }).click()
  await page.getByRole('button', { name: 'Tillbaka till ytan', exact: true }).click()
  await page.getByTestId('how-kpi-revenue').click()
  await expect(page.getByTestId('calculation-drawer')).toContainText('FROM sales')
  await expect(page.getByTestId('calculation-drawer')).toContainText(/503\s+tkr/)
  await page.screenshot({ path: 'e2e-screens/06-how-calculated.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Stäng beräkningen' }).click()
  for (const id of ['kpi-margin', 'kpi-orders', 'kpi-customers', 'trend-revenue', 'trend-margin', 'waterfall']) {
    await page.getByTestId(`how-${id}`).click()
    await expect(page.getByTestId('calculation-drawer')).toContainText('FROM sales')
    await page.keyboard.press('Escape')
  }
  await page.getByTestId('card-trend-revenue').dblclick({ position: { x: 140, y: 15 } })
  await expect(page.getByTestId('detail-view')).toBeVisible()
})

test('orders and customers retain their units; an order table can be added to the canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  for (const metric of ['Ordrar', 'Kunder']) {
    await page.getByRole('button', { name: `Utforska ${metric}`, exact: true }).click()
    await page.getByRole('button', { name: 'Dela upp per produkt' }).click()
    await expect(page.getByRole('img', { name: `${metric} per produkt` })).not.toContainText('tkr')
    await page.getByTestId('how-detail').click()
    await expect(page.getByTestId('calculation-drawer')).toContainText('COUNT(DISTINCT order_id)')
    await page.keyboard.press('Escape')
    await page.getByTestId('product-Ullfilt').click()
    await expect(page.getByTestId('orders-table')).toBeVisible()
    if (metric === 'Kunder') {
      await page.getByRole('button', { name: 'Lägg på ytan', exact: true }).click()
      await expect(page.locator('.kind-table')).toContainText('Orderrader · Ullfilt')
      await expect(page.locator('.kind-table').getByTestId('orders-table')).toBeVisible()
    } else await page.getByRole('button', { name: 'Tillbaka till ytan', exact: true }).click()
  }
})
