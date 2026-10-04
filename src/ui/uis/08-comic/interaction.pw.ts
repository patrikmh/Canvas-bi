import { expect, test } from '@playwright/test'
test('Dataserie: arrow navigation, mobile scroll snap and explicit decision', async ({ page }, info) => {
  await page.goto('/?ui=08&fast=1')
  await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
  await page.getByTestId('comic-panel-3').click()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('comic-panel-4')).toHaveAttribute('aria-current', 'step')
  if (info.project.name === 'mobile') {
    await page.locator('.comic-track').evaluate(element => element.scrollBy({ left: element.clientWidth, behavior: 'instant' }))
    await expect(page.getByTestId('comic-panel-5')).toHaveAttribute('aria-current', 'step')
  }
  await page.getByTestId('comic-panel-6').click()
  await page.getByTestId('ui-propose-watch').click()
  await expect(page.getByTestId('ui-watch-status')).toHaveText('Föreslagen')
  await page.getByTestId('ui-approve-watch').click()
  await expect(page.getByTestId('ui-watch-status')).toContainText('Aktiv')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (info.project.name === 'mobile') { await page.getByTestId('comic-panel-4').click(); await page.screenshot({ path: 'design-shots/out/u08-mobile.png', fullPage: true }) }
})
