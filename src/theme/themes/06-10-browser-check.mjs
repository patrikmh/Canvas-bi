// Additional theme checks against built dist. E2E_PORT is supplied by the conductor.
// Run: node src/theme/themes/06-10-browser-check.mjs (with vite preview running).
import { chromium, expect } from '@playwright/test'
const browser = await chromium.launch()
const base = `http://127.0.0.1:${process.env.E2E_PORT}`
try {
  for (const id of ['06', '07', '08', '09', '10']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'sv-SE' })
    await page.goto(`${base}/?theme=${id}&fast=1`)
    await expect(page.locator('[data-ready="true"]')).toBeVisible()
    await expect(page.getByTestId('memo-finding-5')).toBeAttached()
    await page.evaluate(() => document.fonts.ready)
    const font = await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)
    expect(font).not.toMatch(/Inter|Geist|Space Grotesk|Instrument Serif/)
    await page.getByRole('button', { name: 'Hur räknas fynd 3? marginWaterfall', exact: true }).click()
    await expect(page.getByTestId('calculation-drawer')).toContainText('Resultatrader (urval):')
    await expect(page.getByTestId('calculation-drawer')).toContainText('Ullfilt')
    await page.screenshot({ path: `design-shots/out/${id}-citation.png`, animations: 'disabled' })
    await page.getByRole('button', { name: 'Stäng beräkningen', exact: true }).click()
    if (id === '07') {
      await page.getByTestId('memo-finding-1').getByRole('button', { name: 'Ändra', exact: true }).focus()
      await page.keyboard.press('a')
      await expect(page.getByTestId('memo-finding-1').getByRole('button', { name: 'Acceptera', exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
    if (id === '09') {
      await page.keyboard.press('F4')
      await expect(page.getByTestId('detail-view')).toBeVisible()
      await page.getByRole('button', { name: 'Tillbaka till ytan', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Visa marginal per produkt', exact: true }).click()
    await expect(page.getByTestId('detail-view')).toBeVisible()
    await expect(page.getByTestId('detail-view').locator('svg')).toContainText('③④')
    if (id === '10') {
      await expect(page.locator('.product-detail pattern')).toHaveCount(2)
      await expect(page.locator('.product-detail path[fill^="url(#excel-"]')).not.toHaveCount(0)
    }
    await page.screenshot({ path: `design-shots/out/${id}-products.png`, animations: 'disabled' })
    await page.getByRole('button', { name: 'Tillbaka till ytan', exact: true }).click()
    await page.getByText('Körningslogg', { exact: true }).click()
    await page.getByTestId('agent-trace').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `design-shots/out/${id}-log.png`, animations: 'disabled' })
    await page.getByText('Körningslogg', { exact: true }).click()
    for (const width of [1024, 900, 375, 320]) {
      await page.setViewportSize({ width, height: 900 })
      // React's mobile switch and the grid ResizeObserver settle on the next frame.
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth), { message: `theme ${id}, ${width}px horizontal overflow` }).toBe(false)
      await expect.poll(() => page.locator('.canvas-card').evaluateAll(cards => cards.flatMap(card => {
        const parent = card.getBoundingClientRect()
        return [...card.querySelectorAll('.insight-content h2, .insight-content > p, .insight-actions, .kpi-value, .bullet-variance')].filter(child => {
          const rect = child.getBoundingClientRect()
          return rect.bottom > parent.bottom + 2 || rect.right > parent.right + 2
        }).map(child => `${card.getAttribute('data-card-id')}: ${child.className || child.tagName}`)
      })), { message: `theme ${id}, ${width}px content outside card` }).toEqual([])
      if (width === 375) {
        await page.screenshot({ path: `design-shots/out/${id}-mobile.png`, fullPage: true, animations: 'disabled' })
        await page.getByRole('button', { name: 'Assistent', exact: true }).click()
        await page.getByTestId('memo-finding-1').scrollIntoViewIfNeeded()
        await expect(page.getByTestId('memo-finding-1')).toBeVisible()
        await page.screenshot({ path: `design-shots/out/${id}-mobile-memo.png`, animations: 'disabled' })
        await page.getByRole('button', { name: 'Stäng assistenten', exact: true }).click()
      }
    }
    console.log(`Theme ${id}: fonts, citations/markers, review/commands, log, 1024/900/375/320px overflow and card bounds: PASS`)
    await page.close()
  }
} finally { await browser.close() }
