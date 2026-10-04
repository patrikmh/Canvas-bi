import { test, expect } from '@playwright/test'
import { readUiManifest, runUiSteps } from '../../../../design-shots/ui-harness'

test('04: consecutive pointer drags reveal the gap; reset and keyboard input work', async ({ page }) => {
  await page.goto('/?ui=04&fast=1')
  await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
  const definition = (await readUiManifest(page)).find(item => item.id === '04')!
  await runUiSteps(page, definition.shots.interaction)
  await expect(page.locator('.gap-band')).toHaveCount(1)
  await expect(page.locator('.actual-line')).toHaveCount(1)
  await expect(page.getByTestId('guess-outcome')).toContainText('44,7')
  await page.getByTestId('guess-reset').click()
  await expect(page.getByTestId('guess-outcome')).toHaveCount(0)
  await expect(page.getByTestId('guess-reveal')).toBeDisabled()
  for (let index = 0; index < 6; index++) await page.getByTestId(`guess-month-${index}`).fill('55')
  await page.getByTestId('guess-reveal').click()
  await expect(page.getByTestId('guess-outcome')).toContainText('55')
  await page.getByTestId('ui-edit-3').click()
  await expect(page.getByTestId('ui-save-review')).toBeDisabled()
  await page.getByTestId('ui-review-reason').fill('Kontrollera produktmix med inköpsansvarig')
  await page.getByTestId('ui-save-review').click()
  await expect(page.getByTestId('ui-review-note-3')).toContainText('Kontrollera produktmix')
  await page.getByTestId('ui-citation-3').first().click()
  await expect(page.getByTestId('calculation-drawer')).toContainText('Resultatrader (urval)')
  await expect(page.getByTestId('calculation-drawer')).toContainText('Ullfilt')
})

test('05: changing the sentence updates the months and citation rows; unknown input is honest', async ({ page }) => {
  await page.goto('/?ui=05&fast=1')
  await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
  await page.getByTestId('search-suggestion-0').click()
  await expect(page.getByTestId('search-window')).toContainText('juni 2026')
  await page.getByTestId('search-period').selectOption('6')
  await expect(page.getByTestId('search-window')).toContainText('mars 2026')
  await page.getByRole('button', { name: 'Visa SQL och rader för Ullfilt', exact: true }).click()
  await expect(page.getByTestId('calculation-drawer')).toContainText('2026-03')
  await expect(page.getByTestId('calculation-drawer')).toContainText('2025-03')
  await expect(page.getByTestId('calculation-drawer')).toContainText('Resultatrader (urval)')
  await page.getByRole('button', { name: 'Stäng beräkningen' }).click()
  await page.getByTestId('search-metric').selectOption('revenue')
  await expect(page.getByTestId('search-conclusion')).toContainText('Omsättning')
  await page.getByTestId('search-question').fill('Vad kostar lagret?')
  await page.getByTestId('search-submit').click()
  await expect(page.getByTestId('search-unknown')).toContainText('Kan inte tolka')
  await expect(page.getByTestId('search-answer')).toHaveCount(0)
})

test('06: the sticky figure follows scroll and the decision has review and sign-off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?ui=06&fast=1')
  await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
  await page.getByTestId('essay-jump-waterfall').click()
  await expect(page.getByTestId('essay-figure')).toHaveAttribute('data-section', 'waterfall')
  await expect(page.getByTestId('essay-waterfall')).toContainText('juli–augusti 2026')
  await page.locator('#essay-economics-section').scrollIntoViewIfNeeded()
  await page.evaluate(() => document.getElementById('essay-economics-section')!.scrollIntoView({ block: 'start' }))
  await expect(page.getByTestId('essay-figure')).toHaveAttribute('data-section', 'economics')
  await expect(page.locator('.essay-economics')).toContainText('Ullfilt')
  await page.getByTestId('essay-jump-decision').click()
  await expect(page.getByTestId('essay-decision')).toBeVisible()
  await page.getByTestId('ui-reject-1').click()
  await page.getByTestId('ui-review-reason').fill('Kontrollera data före beslut')
  await page.getByTestId('ui-save-review').click()
  await expect(page.getByTestId('ui-memo-status')).toContainText('Returnerad')
  await expect(page.getByTestId('ui-signoff-submit')).toBeDisabled()
})

for (const id of ['04', '05', '06']) {
  test(`${id}: mobile signature interaction and explicit approval at 375 px`, async ({ page }) => {
    const external: string[] = [], errors: string[] = []
    page.on('request', request => { if (request.url().startsWith('http') && new URL(request.url()).hostname !== '127.0.0.1') external.push(request.url()) })
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/?ui=${id}&fast=1`)
    await expect(page.getByTestId('ui-root')).toHaveAttribute('data-ready', 'true')
    const definition = (await readUiManifest(page)).find(item => item.id === id)!
    if (id === '04') {
      for (let index = 0; index < 6; index++) await page.getByTestId(`guess-month-${index}`).fill('50')
      await page.getByTestId('guess-reveal').click()
      await page.getByTestId('guess-drawing').scrollIntoViewIfNeeded()
    } else if (id === '05') {
      await page.getByTestId('search-suggestion-0').click()
      await page.getByTestId('search-period').selectOption('6')
      await page.getByTestId('search-figure').evaluate(element => element.scrollIntoView({ block: 'start' }))
    } else {
      await runUiSteps(page, definition.shots.interaction)
      await expect(page.locator('[data-testid="essay-waterfall"] .chart')).toContainText('Ullfilt')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `design-shots/out/u${id}-mobile.png`, animations: 'disabled' })
    if (id === '04') { /* already revealed via keyboard */ }
    else await runUiSteps(page, definition.smoke.openApproval)
    await page.getByTestId('ui-propose-watch').click()
    await page.getByTestId('ui-approve-watch').click()
    await expect(page.getByTestId('ui-watch-status')).toContainText('Aktiv')
    await expect(page.getByTestId('ui-activity-entry').filter({ hasText: 'Bevakning godkänd' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(external).toEqual([])
    expect(errors).toEqual([])
  })
}
