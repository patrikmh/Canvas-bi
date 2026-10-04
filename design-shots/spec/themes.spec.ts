import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'

// Theme definitions follow NN-slug.ts; no second list needs maintenance.
const registered = readdirSync(fileURLToPath(new URL('../../src/theme/themes/', import.meta.url)))
  .flatMap(file => file.match(/^(0[0-9]|10)-.+\.ts$/)?.[1] ?? []).sort()
const ids = [...new Set((process.env.THEMES?.split(',') ?? registered).map(id => id.trim()))]

for (const id of ids) {
  test(`theme ${id}: dashboard and agent`, async ({ page }) => {
    expect(registered, `Theme ${id} must have a registered definition`).toContain(id)
    await page.goto(`/?theme=${id}&fast=1`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', id)
    await expect(page.locator('[data-ready="true"]')).toBeVisible()
    await expect(page.locator('.trace-step')).toHaveCount(5)
    for (let index = 0; index < 5; index++) {
      await expect(page.getByTestId(`trace-step-${index}`)).toHaveAttribute('data-status', 'done')
    }
    await expect(page.locator('.theme-indicator')).toContainText(`Tema ${id}`)
    await page.screenshot({ path: `design-shots/out/${id}-dashboard.png`, animations: 'disabled' })

    await page.getByRole('button', { name: 'Varför ändrades marginalen?', exact: true }).click()
    await expect(page.getByTestId('assistant-message').last().getByRole('button', { name: 'Visa förklaringen' })).toBeVisible()
    await page.getByTestId('trace-step-0').locator('summary').click()
    await expect(page.getByTestId('trace-step-0')).toHaveAttribute('open', '')
    await page.getByRole('button', { name: 'Bevaka marginalen', exact: true }).last().click()
    await expect(page.getByTestId('approval-card')).toBeVisible()
    await page.getByTestId('approval-card').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `design-shots/out/${id}-agent.png`, animations: 'disabled' })
  })
}
