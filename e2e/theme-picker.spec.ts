import { test, expect } from '@playwright/test'

const publicIds = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10']

test('sidebar appearance control chooses 07 with a full reload and preserves the URL', async ({ page }) => {
  await page.goto('/?fast=1&filter=demo#report')
  await expect(page.locator('html')).toHaveAttribute('data-theme', '00')
  const footer = page.locator('.palette-footer')
  await expect(footer.getByRole('button', { name: 'Utseende: Standard ▾' })).toBeVisible()
  await footer.getByRole('button', { name: 'Utseende: Standard ▾' }).click()
  const picker = footer.getByTestId('theme-picker')
  await expect(picker).toBeVisible()
  expect(await picker.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(publicIds)
  await page.evaluate(() => { document.documentElement.dataset.beforeThemeReload = 'true' })
  await picker.selectOption('07')
  await expect(page).toHaveURL(/fast=1&filter=demo&theme=07#report$/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', '07')
  await expect(page.locator('html')).not.toHaveAttribute('data-before-theme-reload', 'true')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await expect(footer.getByRole('button', { name: 'Utseende: Lugn arbetsyta ▾' })).toBeVisible()
})

test('settings lists public themes and Standard removes the theme parameter on reload', async ({ page }) => {
  await page.goto('/?fast=1&theme=07#report')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click()
  const picker = page.getByTestId('settings-llm').getByTestId('theme-picker')
  await expect(page.getByTestId('settings-llm').getByLabel('Utseende', { exact: true })).toBeVisible()
  await expect(picker).toHaveValue('07')
  expect(await picker.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(publicIds)
  await picker.selectOption('00')
  await expect(page).toHaveURL(/\/\?fast=1#report$/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', '00')
  await expect(page.getByTestId('app-root')).toHaveAttribute('data-ready', 'true')
})

test('appearance remains visible in the collapsed mobile sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?fast=1')
  await page.getByRole('button', { name: 'Utseende: Standard ▾' }).click()
  await expect(page.locator('.palette-footer').getByTestId('theme-picker')).toBeVisible()
})

test('footer control stays plain text and inherits typography in every public theme', async ({ page }) => {
  for (const id of publicIds) {
    await page.goto(id === '00' ? '/?fast=1' : `/?fast=1&theme=${id}`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', id)
    const button = page.locator('.theme-footer-toggle')
    await expect(button).toBeVisible()
    await expect(button).toHaveCSS('box-shadow', 'none')
    await expect(button).toHaveCSS('border-radius', '0px')
    await expect(button).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    const family = await page.locator('.theme-footer').evaluate(element => getComputedStyle(element).fontFamily)
    await expect(button).toHaveCSS('font-family', family)
  }
})
