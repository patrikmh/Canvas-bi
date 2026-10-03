/// <reference lib="dom" />
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function boot(page: Page) {
  await page.goto('/?fast=1')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
}
async function upload(page: Page, name: string) {
  await page.getByTestId('upload-entry').click()
  await expect(page.getByTestId('upload-dialog')).toContainText('Data stannar i din webbläsare')
  await page.getByTestId('upload-file').setInputFiles(`e2e/fixtures/${name}`)
  await expect(page.getByTestId('upload-mapping')).toBeVisible()
}
async function confirm(page: Page) {
  await page.getByTestId('confirm-upload').click()
  await expect(page.getByTestId('upload-mapping')).toHaveCount(0)
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
}
// Independent fixture arithmetic, without app parsers, formatters or expected.json.
function shopRevenue() {
  const rows = readFileSync('e2e/fixtures/annan-butik.csv', 'utf8').trim().split(/\r?\n/).slice(1).map(row => row.split(';'))
  const month = rows.map(row => row[0].slice(0, 7)).sort().at(-1)!
  const total = rows.filter(row => row[0].startsWith(month)).reduce((sum, row) => sum + Number(row[2]) * Math.round(Number(row[3].replace(',', '.')) * 100), 0) / 100
  return { month, formatted: `${new Intl.NumberFormat('sv-SE').format(Math.round(total / 1000))}\u00a0tkr` }
}

test('CSV mapping auto-detects, accepts a manual change, computes fixture revenue and resets the demo', async ({ page }) => {
  await boot(page)
  await upload(page, 'annan-butik.csv')
  for (const [field, header] of Object.entries({ date: 'Orderdatum', product: 'Artikel', qty: 'Antal', unit_price: 'Styckpris', unit_cost: 'Inköpspris', customer_id: 'Kundnr', order_id: 'Ordernr' })) await expect(page.getByTestId(`mapping-${field}`)).toHaveValue(header)
  await expect(page.getByTestId('upload-preview').locator('tbody tr')).toHaveCount(8)
  await page.getByTestId('mapping-region').selectOption('Artikel')
  await expect(page.getByTestId('confirm-upload')).toBeDisabled()
  await page.getByTestId('mapping-product').selectOption('')
  await expect(page.getByTestId('confirm-upload')).toBeEnabled()
  await page.getByTestId('mapping-region').selectOption('')
  await page.getByTestId('mapping-product').selectOption('Artikel')
  // The preview keeps the actual customer column and correctly omits unavailable dimensions.
  await expect(page.getByTestId('mapping-customer_id')).toHaveValue('Kundnr')
  await expect(page.getByTestId('mapping-channel')).toHaveValue('')
  await expect(page.getByTestId('mapping-region')).toHaveValue('')
  await page.screenshot({ path: 'e2e-screens/13-upload-mapping.png', animations: 'disabled' })
  await confirm(page)
  const revenue = shopRevenue()
  await expect(page.getByTestId('demo-banner')).toHaveCount(0)
  await expect(page.getByTestId('dataset-name')).toHaveText('annan-butik.csv')
  await expect(page.getByLabel('Period')).toHaveValue(revenue.month)
  await expect(page.getByLabel('Period').locator('option')).toHaveCount(14)
  await expect(page.getByTestId('kpi-revenue').locator('.kpi-value')).toHaveText(revenue.formatted)
  await expect(page.getByTestId('card-kpi-customers').getByTestId('upload-empty-state')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ändra kolumnmappning' }).click()
  await expect(page.getByTestId('mapping-region')).toHaveValue('')
  await page.getByTestId('mapping-customer_id').selectOption('')
  await confirm(page)
  await expect(page.getByTestId('card-kpi-customers').getByTestId('upload-empty-state')).toContainText('Kundkolumn saknas')
  await page.getByRole('button', { name: 'Ändra kolumnmappning' }).click()
  await page.getByTestId('mapping-customer_id').selectOption('Kundnr')
  await confirm(page)
  await expect(page.getByTestId('card-kpi-customers').getByTestId('upload-empty-state')).toHaveCount(0)
  await page.getByRole('button', { name: 'Återställ demon', exact: true }).click()
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('demo-banner')).toBeVisible()
  await expect(page.getByTestId('kpi-revenue')).toContainText(/503\s+tkr/)
  await expect(page.getByTestId('dataset-name')).toHaveCount(0)
})

test('missing cost fails visibly without a margin number; explicit assumption is labelled on every margin surface', async ({ page }) => {
  await boot(page)
  await upload(page, 'utan-kostnad.csv')
  await expect(page.getByTestId('mapping-cost')).toHaveValue('')
  await expect(page.getByTestId('mapping-unit_cost')).toHaveValue('')
  await confirm(page)
  await expect(page.getByTestId('trace-step-0')).toHaveAttribute('data-status', 'failed')
  await expect(page.getByTestId('trace-step-0')).toContainText('Kontrollerar att kostnad finns')
  await expect(page.getByTestId('card-kpi-margin')).toContainText('Kostnad saknas')
  await expect(page.getByTestId('card-kpi-margin')).not.toContainText(/\d[,.]?\d*\s*%/)
  await expect(page.getByTestId('card-waterfall')).toContainText('utan kostnad')
  await expect(page.getByTestId('card-insight').getByRole('button', { name: 'Bevaka marginalen', exact: true })).toHaveCount(0)
  for (const metric of ['revenue', 'orders', 'customers']) await expect(page.getByTestId(`kpi-${metric}`).locator('.kpi-value')).not.toHaveText('—')
  await expect(page.getByTestId('kpi-revenue').locator('.kpi-delta')).toHaveCSS('color', 'rgb(120, 134, 127)')
  await page.screenshot({ path: 'e2e-screens/14-failure-path.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Anta 50 % bruttomarginal', exact: true }).click()
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('card-kpi-margin')).toContainText(/50,0\s*%/)
  await expect(page.getByTestId('card-kpi-margin')).toContainText('ANTAGANDE')
  await expect(page.getByTestId('card-trend-margin')).toContainText('ANTAGANDE')
  await expect(page.getByTestId('card-waterfall')).toContainText('ANTAGANDE')
  await expect(page.getByTestId('card-insight')).toContainText('ANTAGANDE')
  await expect(page.locator('.assistant-heading')).toContainText('ANTAGANDE')
  await page.getByTestId('kpi-margin').getByRole('button', { name: 'Utforska Bruttomarginal' }).click()
  await expect(page.getByTestId('detail-view')).toContainText('ANTAGANDE')
  await expect(page.locator('.detail-summary > span').first()).toHaveCSS('color', 'rgb(120, 134, 127)')
  await page.getByRole('button', { name: 'Tillbaka till ytan' }).click()
  await page.getByTestId('how-kpi-margin').click()
  await expect(page.getByTestId('calculation-drawer')).toContainText('ANTAGANDE')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Ändra kolumnmappning' }).click()
  await confirm(page)
  await expect(page.getByTestId('trace-step-0')).toHaveAttribute('data-status', 'failed')
  await expect(page.getByTestId('card-kpi-margin')).not.toContainText(/\d[,.]?\d*\s*%/)
  await expect(page.locator('.assistant-heading')).not.toContainText('ANTAGANDE')
})

test('few rows display low confidence and demo reset restores SQL story', async ({ page }) => {
  await boot(page)
  await upload(page, 'fa-rader.csv')
  await confirm(page)
  await expect(page.getByTestId('agent-trace')).toContainText('Låg säkerhet')
  await expect(page.getByTestId('card-insight')).toContainText('Mer data behövs')
  await page.screenshot({ path: 'e2e-screens/15-low-confidence.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Återställ demon', exact: true }).click()
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('kpi-revenue')).toContainText(/503\s+tkr/)
  await expect(page.getByTestId('agent-trace')).toContainText('Hög säkerhet')
})

test('empty canvas upload supports drag/drop and XLSX without external runtime requests', async ({ page }) => {
  const remote: string[] = []
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => { remote.push(route.request().url()); return route.abort() })
  await boot(page)
  await page.getByRole('button', { name: 'Töm ytan', exact: true }).click()
  await page.locator('.empty-upload-entry').getByRole('button', { name: 'Ladda upp data', exact: true }).click()
  const bytes = readFileSync('e2e/fixtures/annan-butik.xlsx').toString('base64')
  const transfer = await page.evaluateHandle(base64 => {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([bytes], 'annan-butik.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    return data
  }, bytes)
  await page.getByTestId('upload-dropzone').dispatchEvent('drop', { dataTransfer: transfer })
  await expect(page.getByTestId('upload-mapping')).toBeVisible()
  await confirm(page)
  await expect(page.getByTestId('dataset-name')).toHaveText('annan-butik.xlsx')
  await expect(page.getByTestId('kpi-revenue').locator('.kpi-value')).toHaveText(shopRevenue().formatted)
  expect(remote).toEqual([])
})

test('invalid CSV stays in mapping with a useful error and preserves current dashboard', async ({ page }) => {
  await boot(page)
  await page.getByTestId('upload-entry').click()
  await page.getByTestId('upload-file').setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('date,amount\nnot-a-date,invalid\n') })
  await page.getByTestId('confirm-upload').click()
  await expect(page.getByRole('alert')).toContainText('inga giltiga försäljningsrader')
  await page.getByRole('button', { name: 'Avbryt', exact: true }).click()
  await expect(page.getByTestId('demo-banner')).toBeVisible()
  await expect(page.getByTestId('kpi-revenue')).toContainText(/503\s+tkr/)
})

test('missing identifiers and product give explanatory cards; trailing empty headers and partial months work', async ({ page }) => {
  await boot(page)
  await page.getByTestId('upload-entry').click()
  await page.getByTestId('upload-file').setInputFiles({ name: 'totals.csv', mimeType: 'text/csv', buffer: Buffer.from('date,amount,cost,,\n2026-07-15,100,50,,\n2026-08-01 10:00:00,200,100,,\n') })
  await confirm(page)
  await expect(page.getByTestId('card-kpi-orders')).toContainText('Orderkolumn saknas')
  await expect(page.getByTestId('card-kpi-customers')).toContainText('Kundkolumn saknas')
  await expect(page.getByTestId('card-waterfall')).toContainText('Produktkolumn saknas')
  await expect(page.getByTestId('card-insight')).toContainText('Produktkolumn saknas')
  await expect(page.getByLabel('Period').locator('option[value="2026-08"]')).toContainText('pågående')
  await page.getByLabel('Period').selectOption('2026-08')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('dataset-name')).toHaveText('totals.csv')
})
