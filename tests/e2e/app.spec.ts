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
let videoFixture: string

// Chromium's BSD-licensed 1,746-byte black/white VP8 test video:
// https://chromium.googlesource.com/chromium/src/+/38.0.2125.92/media/test/data/blackwhite_yuv420p.webm
const CHROMIUM_WEBM_FIXTURE = [
  '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'
].join('')

test.beforeAll(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), 'canvasnote-e2e-'))
  imageFixture = path.join(testRoot, 'sample.png')
  fileFixture = path.join(testRoot, 'research.txt')
  videoFixture = path.join(testRoot, 'sample.webm')
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
  await page.waitForLoadState('domcontentloaded')
  await writeFile(videoFixture, Buffer.from(CHROMIUM_WEBM_FIXTURE, 'base64'))
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
    bridgeDomains: ['app', 'boards', 'export', 'media', 'workspace']
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

  await application.evaluate(({ dialog }, fixture) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [fixture] })
    })
  }, videoFixture)
  const generatedVideo = await readFile(videoFixture)
  expect([...generatedVideo.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
  expect(
    generatedVideo.indexOf(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]))
  ).toBeGreaterThanOrEqual(4)
  await page.getByRole('button', { name: 'Import local video' }).click()
  await page.getByLabel('Caption').fill('Interview clip')
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  const localVideo = page.getByLabel('Interview clip')
  await expect(localVideo).toBeVisible()
  await expect
    .poll(() => localVideo.evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(1)
  await localVideo.evaluate(async (video: HTMLVideoElement) => {
    const target = Math.min(0.2, video.duration / 2)
    video.currentTime = target
    await new Promise<void>((resolve) => {
      if (Math.abs(video.currentTime - target) < 0.02) resolve()
      else video.addEventListener('seeked', () => resolve(), { once: true })
    })
  })
  await page
    .getByRole('complementary', { name: 'Properties panel' })
    .getByRole('button', { name: 'Add note at current time' })
    .click()
  await page.getByLabel('Timestamp note content').fill('Key interview moment')
  await page.getByLabel('Timestamp (seconds)').fill('0.1')
  await localVideo.evaluate((video: HTMLVideoElement) => {
    video.currentTime = Math.min(0.4, video.duration)
  })
  await page.getByRole('button', { name: 'Seek video to 00:00' }).click()
  await expect
    .poll(() => localVideo.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeLessThanOrEqual(0.15)

  await page.getByRole('button', { name: 'Embed YouTube or Vimeo video' }).click()
  await page.getByLabel('Video URL').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await page.getByRole('button', { name: 'Embed video' }).click()
  const embeddedVideo = page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')
  await expect(embeddedVideo).toHaveAttribute('src', /dQw4w9WgXcQ/)
  await page.getByLabel('Caption').fill('YouTube reference')

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
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await expect(page.getByText('Opening idea')).toBeVisible()
  await expect(page.getByText('Start with the key question.')).toBeVisible()
  await expect(page.getByText('Review steps')).toBeVisible()
  await expect(page.getByText('Watch the source')).toBeVisible()
  await expect(page.getByRole('img', { name: 'A one pixel test image' })).toBeVisible()
  await expect(page.getByText('Imported reference')).toBeVisible()
  await expect(page.getByText('research.txt', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Interview clip')).toBeVisible()
  await expect(page.getByText('Key interview moment')).toBeVisible()
  await expect(
    page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')
  ).toHaveCount(1)

  await page.getByRole('button', { name: 'Export board' }).click()
  await expect(page.getByRole('dialog', { name: 'Export board' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^JSON/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^PNG/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^PDF/ })).toBeEnabled()
  await page.getByRole('button', { name: 'Close export dialog' }).click()

  const manifest = JSON.parse(
    await readFile(path.join(testRoot, 'E2E Workspace', 'workspace.json'), 'utf8')
  ) as { format: string }
  expect(manifest.format).toBe('canvasnote-workspace')
  expect(await readdir(path.join(testRoot, 'E2E Workspace', 'media', 'images'))).toHaveLength(1)
  expect(await readdir(path.join(testRoot, 'E2E Workspace', 'media', 'videos'))).toHaveLength(1)
  const copiedFiles = await readdir(path.join(testRoot, 'E2E Workspace', 'media', 'files'))
  expect(copiedFiles).toHaveLength(1)

  await rm(path.join(testRoot, 'E2E Workspace', 'media', 'files', copiedFiles[0]!))
  await page.getByRole('button', { name: 'Back to boards' }).click()
  await page.getByRole('button', { name: 'Open Edited video research' }).click()
  await expect(page.getByText('File unavailable')).toBeVisible()

  await page.keyboard.press('Control+K')
  const boardSearch = page.getByRole('searchbox', {
    name: 'Search notes, tags, files, and captions'
  })
  await boardSearch.fill('key interview moment')
  await expect(page.getByRole('option', { name: /Key interview moment/i })).toBeVisible()
  await page.getByRole('option', { name: /Key interview moment/i }).click()
  await expect(
    page
      .getByRole('complementary', { name: 'Properties panel' })
      .getByRole('heading', { name: 'Timestamp note' })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Back to boards' }).click()
  const dashboardSearch = page.getByRole('searchbox', { name: 'Search boards' })
  await dashboardSearch.fill('key interview moment')
  await expect(page.getByRole('button', { name: 'Open Edited video research' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear board search' }).click()

  const boardFiles = await readdir(path.join(testRoot, 'E2E Workspace', 'boards'))
  const importSource = path.join(testRoot, 'E2E Workspace', 'boards', boardFiles[0]!)
  await application.evaluate(({ dialog }, source) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [source] })
    })
  }, importSource)
  await page.getByRole('button', { name: 'Import board' }).click()
  await expect(page.getByLabel('Board title')).toHaveValue('Edited video research')
  await page.getByRole('button', { name: 'Back to boards' }).click()

  await page.getByRole('button', { name: /^Templates/ }).click()
  await page.getByRole('button', { name: /Video research.*Capture questions/i }).click()
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await expect(page.getByText('Research question')).toBeVisible()
  await expect(page.getByText('What do I want to learn?')).toBeVisible()

})
