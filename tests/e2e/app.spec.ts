import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let application: ElectronApplication
let page: Page
let testRoot: string

test.beforeAll(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), 'canvasnote-e2e-'))
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') environment[key] = value
  }
  application = await electron.launch({
    args: ['.', `--user-data-dir=${path.join(testRoot, 'user-data')}`],
    cwd: process.cwd(),
    env: environment
  })
  page = await application.firstWindow()
})

test.afterAll(async () => {
  await application?.close()
  if (testRoot) await rm(testRoot, { recursive: true, force: true })
})

test('launches the isolated welcome screen', async () => {
  await expect(page.getByRole('heading', { name: /ideas make more sense/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create workspace' })).toBeEnabled()
  await expect(page.getByText(/CanvasNote 0\.1\.0/)).toBeVisible()

  const security = await page.evaluate(() => {
    return {
      nodeProcess: typeof (window as unknown as { process?: unknown }).process,
      nodeRequire: typeof (window as unknown as { require?: unknown }).require,
      bridgeDomains: Object.keys(window.canvasNote).sort()
    }
  })

  expect(security).toEqual({
    nodeProcess: 'undefined',
    nodeRequire: 'undefined',
    bridgeDomains: ['app', 'boards', 'workspace']
  })
})

test('creates, edits, trashes, restores, and reopens a local board', async () => {
  await application.evaluate(({ dialog }, workspaceParent) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [workspaceParent] })
    })
  }, testRoot)

  await page.getByLabel('New workspace name').fill('E2E Workspace')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(page.getByRole('heading', { name: 'Recent boards' })).toBeVisible()

  await page.getByRole('button', { name: 'New board' }).click()
  await page.getByPlaceholder('Board title').fill('Video research')
  await page.getByRole('button', { name: 'Create board' }).click()
  await expect(page.getByText('This board is empty')).toBeVisible()

  const title = page.getByLabel('Board title')
  await title.fill('Edited video research')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Back to boards' }).click()
  await expect(page.getByRole('button', { name: 'Open Edited video research' })).toBeVisible()

  await page.getByRole('button', { name: /Add Edited video research to favourites/ }).click()
  await page.getByRole('button', { name: /Move Edited video research to trash/ }).click()
  await page.getByRole('button', { name: /^Trash/ }).click()
  await expect(page.getByRole('button', { name: 'Restore Edited video research' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore Edited video research' }).click()

  await page.getByRole('button', { name: 'Close workspace' }).click()
  await expect(page.getByRole('heading', { name: /ideas make more sense/i })).toBeVisible()
  await page.getByRole('button', { name: /E2E Workspace/ }).click()
  await expect(page.getByRole('button', { name: 'Open Edited video research' })).toBeVisible()

  const manifest = JSON.parse(
    await readFile(path.join(testRoot, 'E2E Workspace', 'workspace.json'), 'utf8')
  ) as { format: string }
  expect(manifest.format).toBe('canvasnote-workspace')
})
