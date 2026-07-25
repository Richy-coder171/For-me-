import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let application: ElectronApplication
let page: Page
let testRoot: string
let imageFixture: string
let fileFixture: string

test.beforeAll(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), 'canvasnote-e2e-'))
  imageFixture = path.join(testRoot, 'sample.png')
  fileFixture = path.join(testRoot, 'research.txt')
  await writeFile(
    imageFixture,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    )
  )
  await writeFile(fileFixture, 'Portable CanvasNote attachment.\n', 'utf8')
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
  page.on('pageerror', (error) =>
    process.stderr.write(`[renderer] ${error.stack ?? error.message}\n`)
  )
  page.on('console', (message) => {
    if (message.type() === 'error') process.stderr.write(`[renderer console] ${message.text()}\n`)
  })
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
    bridgeDomains: ['app', 'boards', 'media', 'workspace']
  })
})

test('creates, edits, persists, trashes, restores, and reopens a local board', async () => {
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
  await page.locator('form').getByRole('button', { name: 'Create board', exact: true }).click()
  await expect(page.getByTestId('canvas-editor')).toBeVisible()

  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note title').fill('Opening idea')
  await page.getByLabel('Note content').fill('Start with the key question.')

  await page.getByRole('button', { name: 'New checklist' }).click()
  await page.getByLabel('Checklist title').fill('Review steps')
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByLabel('Checklist item').fill('Watch the source')

  await application.evaluate(({ dialog }, fixture) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [fixture] })
    })
  }, imageFixture)
  await page.getByRole('button', { name: 'Import image' }).click()
  await page.getByLabel('Alternative text').fill('A one pixel test image')
  await page.getByLabel('Caption').fill('Imported reference')
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  const importedImage = page.locator('img[src^="canvasnote-media://"]')
  await expect(importedImage).toHaveCount(1)
  await expect
    .poll(() =>
      importedImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
    )
    .toBe(true)

  const mediaUrl = await importedImage.getAttribute('src')
  expect(mediaUrl).toBeTruthy()
  const range = await application.evaluate(async ({ net }, url) => {
    const response = await net.fetch(url, { headers: { Range: 'bytes=0-7' } })
    return {
      status: response.status,
      contentRange: response.headers.get('content-range'),
      length: (await response.arrayBuffer()).byteLength
    }
  }, mediaUrl!)
  expect(range).toEqual({
    status: 206,
    contentRange: expect.stringMatching(/^bytes 0-7\//),
    length: 8
  })

  await application.evaluate(({ dialog }, fixture) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [fixture] })
    })
  }, fileFixture)
  await page.getByRole('button', { name: 'Attach file' }).click()
  await expect(page.getByText('research.txt', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open research.txt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reveal research.txt in folder' })).toBeVisible()

  const title = page.getByLabel('Board title')
  await title.fill('Edited video research')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await expect(page.getByText('Saved locally')).toBeVisible()
  await page.getByRole('button', { name: 'Save board' }).click()
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

  await page.getByRole('button', { name: 'Open Edited video research' }).click()
  await expect(page.getByText('Opening idea')).toBeVisible()
  await expect(page.getByText('Start with the key question.')).toBeVisible()
  await expect(page.getByText('Review steps')).toBeVisible()
  await expect(page.getByText('Watch the source')).toBeVisible()
  await expect(page.getByRole('img', { name: 'A one pixel test image' })).toBeVisible()
  await expect(page.getByText('Imported reference')).toBeVisible()
  await expect(page.getByText('research.txt', { exact: true })).toBeVisible()

  const manifest = JSON.parse(
    await readFile(path.join(testRoot, 'E2E Workspace', 'workspace.json'), 'utf8')
  ) as { format: string }
  expect(manifest.format).toBe('canvasnote-workspace')
  expect(await readdir(path.join(testRoot, 'E2E Workspace', 'media', 'images'))).toHaveLength(1)
  const copiedFiles = await readdir(path.join(testRoot, 'E2E Workspace', 'media', 'files'))
  expect(copiedFiles).toHaveLength(1)

  await rm(path.join(testRoot, 'E2E Workspace', 'media', 'files', copiedFiles[0]!))
  await page.getByRole('button', { name: 'Back to boards' }).click()
  await page.getByRole('button', { name: 'Open Edited video research' }).click()
  await expect(page.getByText('File unavailable')).toBeVisible()
})
