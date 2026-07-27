import AxeBuilder from '@axe-core/playwright'
import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import type { Result } from 'axe-core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

interface ScreenScan {
  screen: string
  violations: Result[]
}

async function scan(page: Page, screen: string): Promise<ScreenScan> {
  const { violations } = await new AxeBuilder({ page })
    .setLegacyMode()
    .withTags(WCAG_TAGS)
    .analyze()
  return { screen, violations }
}

function summarize(scans: ScreenScan[]): string {
  const details = scans.flatMap(({ screen, violations }) =>
    violations.map((violation) => {
      const nodes = violation.nodes
        .map(
          (node) =>
            `  ${node.target.map(String).join(' -> ')}\n  ${node.failureSummary ?? 'No failure summary.'}`
        )
        .join('\n')
      return `${screen}: ${violation.id} [${violation.impact ?? 'unknown impact'}] ${violation.help}\n${violation.helpUrl}\n${nodes}`
    })
  )
  return details.length ? `Accessibility violations:\n\n${details.join('\n\n')}` : ''
}

test('critical CanvasNote screens meet automated WCAG A/AA checks', async () => {
  test.setTimeout(120_000)
  const testRoot = await mkdtemp(path.join(tmpdir(), 'canvasnote-accessibility-'))
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') environment[key] = value
  }

  let application: ElectronApplication | undefined
  const scans: ScreenScan[] = []

  try {
    application = await electron.launch({
      args: ['.', `--user-data-dir=${path.join(testRoot, 'user-data')}`],
      cwd: process.cwd(),
      env: environment
    })
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: 'Start in CanvasNote' })).toBeVisible()
    scans.push(await scan(page, 'Welcome'))

    await page.getByRole('button', { name: 'Open settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    scans.push(await scan(page, 'Settings dialog (light)'))
    await page.getByLabel('Theme').selectOption('dark')
    await expect(page.locator('html')).toHaveClass(/dark/)
    scans.push(await scan(page, 'Settings dialog (dark)'))
    await page.getByRole('button', { name: 'Close settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
    scans.push(await scan(page, 'Welcome (dark)'))

    await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByLabel('Theme').selectOption('light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Close settings' }).click()

    await application.evaluate(({ dialog }, workspaceParent) => {
      Object.defineProperty(dialog, 'showOpenDialog', {
        configurable: true,
        value: async () => ({ canceled: false, filePaths: [workspaceParent] })
      })
    }, testRoot)
    await page.getByLabel('New workspace name').fill('Accessibility Workspace')
    await page.getByRole('button', { name: 'Create workspace' }).click()
    await expect(page.getByRole('heading', { name: 'Create your first board' })).toBeVisible()
    scans.push(await scan(page, 'Empty dashboard'))

    await page.getByRole('button', { name: 'New board' }).click()
    await page.getByPlaceholder('Board title').fill('Accessibility board')
    await page.locator('form').getByRole('button', { name: 'Create board', exact: true }).click()
    await expect(page.getByTestId('canvas-editor')).toBeVisible()
    await expect(page.getByLabel('Board title')).toHaveValue('Accessibility board')
    scans.push(await scan(page, 'Empty board editor'))

    const violationCount = scans.reduce((total, result) => total + result.violations.length, 0)
    expect(violationCount, summarize(scans)).toBe(0)
  } finally {
    await application?.close()
    await rm(testRoot, { recursive: true, force: true })
  }
})
