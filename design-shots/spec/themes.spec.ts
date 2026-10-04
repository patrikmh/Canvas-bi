import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

// Theme definitions follow NN-slug.ts; no second list needs maintenance.
const registered = readdirSync(fileURLToPath(new URL('../../src/theme/themes/', import.meta.url)))
  .flatMap(file => file.match(/^(0[0-9]|10|99)-.+\.ts$/)?.[1] ?? []).sort()
const ids = [...new Set((process.env.THEMES?.split(',') ?? registered.filter(id => id !== '99')).map(id => id.trim()))]

for (const id of ids) {
  test(`theme ${id}: dashboard and agent`, async ({ page }) => {
    expect(registered, `Theme ${id} must have a registered definition`).toContain(id)
    await page.goto(`/?theme=${id}&fast=1${id === '99' ? '&designPreview=1' : ''}`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', id)
    await expect(page.locator('[data-ready="true"]')).toBeVisible()
    await expect(page.locator('.trace-step')).toHaveCount(5)
    for (let index = 0; index < 5; index++) {
      await expect(page.getByTestId(`trace-step-${index}`)).toHaveAttribute('data-status', 'done')
    }
    await expect(page.locator('.theme-indicator')).toContainText(`Tema ${id}`)
    await page.screenshot({ path: `design-shots/out/${id}-dashboard.png`, animations: 'disabled' })

    await page.getByRole('button', { name: 'Varför ändrades marginalen?', exact: true }).click()
    const memo = await page.getByTestId('analyst-memo').count() > 0
    if (memo) {
      await expect(page.getByTestId('memo-finding-5')).toBeVisible()
      await expect(page.getByTestId('memo-signoff')).toContainText('offline-läge, regelbaserad')
      await expect(page.getByTestId('analyst-memo').getByRole('button', { name: 'Visa förklaringen', exact: true })).toBeVisible()
      await page.getByText('Körningslogg', { exact: true }).click()
    } else await expect(page.getByTestId('assistant-message').last().getByRole('button', { name: 'Visa förklaringen' })).toBeVisible()
    await page.getByTestId('trace-step-0').locator('summary').click()
    await expect(page.getByTestId('trace-step-0')).toHaveAttribute('open', '')
    if (memo) await page.getByText('Körningslogg', { exact: true }).click()
    await page.getByRole('button', { name: 'Bevaka marginalen', exact: true }).last().click()
    await expect(page.getByTestId('approval-card')).toBeVisible()
    if (memo) await page.setViewportSize({ width: 1440, height: 1400 })
    await page.getByTestId('approval-card').scrollIntoViewIfNeeded()
    if (memo) {
      await expect(page.getByTestId('memo-finding-1')).toBeVisible()
      await expect(page.getByTestId('memo-signoff')).toBeVisible()
    }
    await page.screenshot({ path: `design-shots/out/${id}-agent.png`, animations: 'disabled' })
    if (memo) {
      await page.getByTestId('approval-card').getByRole('button', { name: 'Godkänn', exact: true }).click()
      await expect(page.getByTestId('memo-status')).toContainText('Godkänd')
      await expect(page.getByTestId('memo-signoff')).toContainText('Granskad av: Granskare')
      await page.screenshot({ path: `design-shots/out/${id}-approved.png`, animations: 'disabled' })
    }
  })
}

if (ids.includes('99')) {
  test('memo preview: citations, finding review, markers and KPI table', async ({ page }) => {
    await page.goto('/?theme=99&designPreview=1&fast=1')
    await expect(page.getByTestId('memo-finding-5')).toBeVisible()
    await page.getByRole('button', { name: 'Hur räknas fynd 3? marginWaterfall', exact: true }).click()
    await expect(page.getByTestId('calculation-drawer')).toContainText('Resultatrader (urval):')
    await expect(page.getByTestId('calculation-drawer')).toContainText('Ullfilt')
    await page.getByRole('button', { name: 'Stäng beräkningen', exact: true }).click()
    await page.getByTestId('memo-finding-1').getByRole('button', { name: 'Avvisa', exact: true }).click()
    await expect(page.getByLabel('Skäl till avvisning')).toBeVisible()
    await page.getByLabel('Skäl till avvisning').fill('Kontrollera periodvalet')
    await page.getByTestId('memo-finding-1').getByRole('button', { name: 'Spara', exact: true }).click()
    await expect(page.getByTestId('memo-status')).toContainText('Returnerad')
    for (let number = 1; number <= 5; number++) await page.getByTestId(`memo-finding-${number}`).getByRole('button', { name: 'Acceptera', exact: true }).click()
    await expect(page.getByTestId('memo-status')).toContainText('Godkänd')
    await page.getByTestId('analyst-memo').getByRole('button', { name: 'Visa förklaringen', exact: true }).click()
    await page.getByTestId('card-waterfall').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('card-waterfall').locator('svg')).toContainText('③④')
    await page.screenshot({ path: 'design-shots/out/99-markers.png', animations: 'disabled' })
    await page.getByRole('button', { name: 'Visa marginal per produkt', exact: true }).click()
    await expect(page.getByTestId('detail-view').locator('svg')).toContainText('③④')
    await page.screenshot({ path: 'design-shots/out/99-product-markers.png', animations: 'disabled' })
    await page.goto('/?theme=99&designPreview=1&kpi=table&fast=1')
    await expect(page.locator('[data-ready="true"]')).toBeVisible()
    await expect(page.locator('.kpi-table-row')).toHaveCount(4)
    await expect(page.locator('.indexed-sparkline')).toHaveCount(4)
    await page.screenshot({ path: 'design-shots/out/99-table.png', animations: 'disabled' })
    await page.getByRole('textbox', { name: 'Fråga eller föreslå en ändring', exact: true }).fill('Vad är marginalen i juli?')
    await page.getByRole('button', { name: 'Skicka', exact: true }).click()
    await expect(page.getByTestId('analyst-memo').getByRole('heading', { name: 'Uppföljning', exact: true })).toBeVisible()
    await expect(page.getByTestId('analyst-memo').locator('.memo-followup')).toContainText('juli')
    await page.getByTestId('card-kpi-revenue').hover()
    await page.getByTestId('remove-kpi-revenue').click()
    await expect(page.locator('.kpi-table-row')).toHaveCount(3)
    await expect(page.locator('.kpi-table-row thead').first()).toHaveCSS('visibility', 'visible')
  })
}
