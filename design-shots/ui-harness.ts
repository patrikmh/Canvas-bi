import { readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Step, UiManifest } from '../src/ui/types.ts'

const directory = fileURLToPath(new URL('../src/ui/uis/', import.meta.url))
export const registeredUiIds = readdirSync(directory).flatMap(folder => {
  const id = folder.match(/^(0[1-9]|[1-9][0-9])-[^/]+$/)?.[1]
  return id && existsSync(`${directory}/${folder}/index.tsx`) ? [id] : []
}).sort()

export async function readUiManifest(page: Page): Promise<UiManifest[]> {
  return JSON.parse((await page.getByTestId('ui-root').getAttribute('data-ui-registry'))!) as UiManifest[]
}
export async function runUiSteps(page: Page, steps: Step[]) {
  for (const step of steps) {
    if ('click' in step) await page.getByTestId(step.click).click()
    else if ('fill' in step) await page.getByTestId(step.fill[0]).fill(step.fill[1])
    else if ('press' in step) await page.keyboard.press(step.press)
    else if ('wait' in step) await expect(page.getByTestId(step.wait)).toBeVisible()
    else {
      const [testid, dx, dy] = step.drag
      const element = page.getByTestId(testid)
      await element.scrollIntoViewIfNeeded()
      const box = await element.boundingBox()
      expect(box, `Drag target ${testid} has bounds`).not.toBeNull()
      const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2
      await page.mouse.move(x, y); await page.mouse.down()
      await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up()
    }
  }
}
