import { test, expect } from '@playwright/test'
import { registeredUiIds, readUiManifest, runUiSteps } from '../ui-harness'

test('registered UI main and interaction screenshots', async ({ page }) => {
  test.setTimeout(60_000 * Math.max(1, registeredUiIds.length))
  await page.setViewportSize({ width: 1440, height: 900 })
  // Discover hidden flags and steps from the actual browser registry, not a second list.
  await page.goto(`/?ui=${registeredUiIds[0]}&fast=1`)
  await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
  const manifest = await readUiManifest(page)
  const ids = process.env.UIS ? [...new Set(process.env.UIS.split(',').map(id => id.trim()))] : manifest.filter(def => !def.hidden).map(def => def.id)
  for (const id of ids) {
    const def = manifest.find(def => def.id === id)
    expect(def, `UI ${id} must be registered`).toBeDefined()
    await test.step(`UI ${id}: main and interaction`, async () => {
      await page.goto(`/?ui=${id}&fast=1`)
      await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: `design-shots/out/u${id}-main.png`, animations: 'disabled' })
      await runUiSteps(page, def!.shots.interaction)
      await page.screenshot({ path: `design-shots/out/u${id}-interaction.png`, animations: 'disabled' })
    })
  }
})
