import { _electron as electron } from '@playwright/test'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const captureSet = process.argv[2]
if (captureSet !== 'before' && captureSet !== 'after') {
  throw new Error('Use: node scripts/captureDesignScreenshots.mjs <before|after>')
}

const repository = process.cwd()
const output = path.join(repository, 'docs', 'design', captureSet)
await mkdir(output, { recursive: true })
const testRoot = await mkdtemp(path.join(repository, '.canvasnote-design-'))
const exportDirectory = path.join(testRoot, 'exports')
await mkdir(exportDirectory)

const imageFixture = path.join(testRoot, 'research.png')
const videoFixture = path.join(testRoot, 'interview.webm')
await writeFile(
  imageFixture,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )
)

const e2eSource = await readFile(path.join(repository, 'tests', 'e2e', 'app.spec.ts'), 'utf8')
const fixtureBlock = e2eSource.match(
  /const CHROMIUM_WEBM_FIXTURE = \[([\s\S]*?)\]\.join\(''\)/
)?.[1]
if (!fixtureBlock) throw new Error('Could not find the deterministic video fixture.')
const videoBase64 = [...fixtureBlock.matchAll(/'([^']*)'/g)].map((match) => match[1]).join('')
await writeFile(videoFixture, Buffer.from(videoBase64, 'base64'))

const environment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key, value]) => value !== undefined && key !== 'ELECTRON_RUN_AS_NODE'
  )
)
environment.CANVASNOTE_TEST_EXPORT_DIRECTORY = exportDirectory
environment.TZ = 'UTC'

const application = await electron.launch({
  args: [
    '.',
    `--user-data-dir=${path.join(testRoot, 'user-data')}`,
    '--lang=en-US',
    '--force-device-scale-factor=1'
  ],
  cwd: repository,
  env: environment
})
const page = await application.firstWindow()
const errors = []
page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

async function setWindow(width, height) {
  await application.evaluate(
    ({ BrowserWindow }, size) => {
      const window = BrowserWindow.getAllWindows()[0]
      window?.setSize(size.width, size.height)
      window?.center()
    },
    { width, height }
  )
  await page.waitForTimeout(250)
}

async function setDialogPath(selectedPath) {
  await application.evaluate(({ dialog }, filePath) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [filePath] })
    })
  }, selectedPath)
}

async function screenshot(name) {
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(4, 4)
  await page.waitForTimeout(160)
  await page.screenshot({
    path: path.join(output, name),
    animations: 'disabled',
    caret: 'hide',
    scale: 'css'
  })
  process.stdout.write(`captured ${name}\n`)
}

try {
  await page.waitForLoadState('domcontentloaded')
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
  })
  await setWindow(1440, 900)

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Theme').selectOption('light')
  await screenshot('settings-light.png')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await screenshot('welcome-light.png')

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Theme').selectOption('dark')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
  await screenshot('welcome-dark.png')
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Theme').selectOption('light')
  await page.getByRole('button', { name: 'Close settings' }).click()

  await setWindow(1024, 700)
  await screenshot('welcome-narrow.png')
  await setWindow(1440, 900)

  await setDialogPath(testRoot)
  await page.getByLabel('New workspace name').fill('Design Review')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByRole('heading', { name: 'Recent boards', exact: true }).waitFor()
  await screenshot('dashboard-empty.png')

  await page.getByRole('button', { name: /^Templates/ }).click()
  await page.getByRole('heading', { name: 'Templates', exact: true }).waitFor()
  await screenshot('templates.png')
  await page.getByRole('button', { name: /^Trash/ }).click()
  await page.getByRole('heading', { name: 'Trash', exact: true }).waitFor()
  await screenshot('trash-empty.png')
  await page.getByRole('button', { name: /^All boards/ }).click()

  await page.getByRole('button', { name: 'New board' }).first().click()
  await page.getByPlaceholder('Board title').fill('Interview synthesis')
  await page.locator('form').getByRole('button', { name: 'Create board', exact: true }).click()
  await page.getByTestId('canvas-editor').waitFor()
  await screenshot('board-empty.png')

  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note title').fill('Opening insight')
  await page
    .getByLabel('Note content')
    .fill('Start with the customer problem and connect it to the evidence.')
  await screenshot('selected-note.png')

  await page.getByRole('button', { name: 'New checklist' }).click()
  await page.getByLabel('Checklist title').fill('Review steps')
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.getByLabel('Checklist item').fill('Validate the key quote')

  await setDialogPath(imageFixture)
  await page.getByRole('button', { name: 'Import image' }).click()
  await page.getByLabel('Alternative text').fill('Research reference')
  await page.getByLabel('Caption').fill('Customer journey reference')
  await screenshot('selected-image.png')

  await setDialogPath(videoFixture)
  await page.getByRole('button', { name: 'Import local video' }).click()
  const properties = page.getByRole('complementary', { name: 'Properties panel' })
  await properties
    .locator('label')
    .filter({ hasText: /^Caption/ })
    .locator('input')
    .fill('Interview clip')
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await screenshot('selected-video.png')

  await page
    .locator('video')
    .first()
    .evaluate((element) => {
      element.pause()
      try {
        element.currentTime = Number.isFinite(element.duration)
          ? Math.min(0.25, element.duration / 2)
          : 0
      } catch {
        // Metadata timing varies slightly between Electron versions.
      }
    })
  await properties.getByRole('button', { name: 'Add note at current time' }).click()
  await properties
    .locator('label')
    .filter({ hasText: /^Note/ })
    .locator('textarea')
    .fill('Key interview moment')
  await screenshot('timestamp-note.png')

  await page.getByRole('button', { name: 'Add link card' }).click()
  await page.getByLabel('URL').fill('example.com/research')
  await page.getByLabel('Title (optional)').fill('Research guide')
  await page.getByLabel('Description (optional)').fill('Supporting material for the synthesis.')
  await page.getByRole('button', { name: 'Add link', exact: true }).click()
  await page.getByRole('button', { name: 'New frame' }).click()
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await page.keyboard.press('Escape')
  await screenshot('board-populated.png')

  await page.keyboard.press('Control+K')
  const search = page.getByRole('searchbox', {
    name: 'Search notes, tags, files, and captions'
  })
  await search.fill('opening insight')
  await page.getByRole('option', { name: /Opening insight/i }).waitFor()
  await screenshot('search.png')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Export board' }).click()
  await page.getByRole('dialog', { name: 'Export board' }).waitFor()
  await screenshot('export-dialog.png')
  await page.getByRole('button', { name: 'Close export dialog' }).click()

  await page.getByRole('button', { name: 'Save board' }).click()
  await page.getByRole('button', { name: 'Back to boards' }).click()
  await page.getByRole('button', { name: 'Open Interview synthesis' }).waitFor()
  await screenshot('dashboard-boards.png')
  await page.getByRole('button', { name: 'Open Interview synthesis' }).click()
  await page.getByRole('button', { name: 'Zoom to fit' }).click()

  await setWindow(1024, 700)
  await screenshot('board-narrow.png')
  await setWindow(1920, 1080)
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await screenshot('board-large.png')
  await setWindow(1440, 900)

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Theme').selectOption('dark')
  await screenshot('settings-dark.png')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Theme').selectOption('light')
  await page.getByRole('button', { name: 'Close settings' }).click()

  await page.getByRole('button', { name: 'Save board' }).click()
  await page.getByRole('button', { name: 'Back to boards' }).click()
  const copiedVideos = await readdir(path.join(testRoot, 'Design Review', 'media', 'videos'))
  for (const filename of copiedVideos) {
    await rm(path.join(testRoot, 'Design Review', 'media', 'videos', filename))
  }
  await page.getByRole('button', { name: 'Open Interview synthesis' }).click()
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await page.getByText('Video is unavailable').waitFor()
  await screenshot('missing-media.png')

  await application.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('board:save')
    ipcMain.handle('board:save', async () => {
      throw new Error('The workspace is temporarily unavailable.')
    })
  })
  await page.getByLabel('Board title').fill('Interview synthesis — unsaved')
  await page.getByRole('button', { name: 'Save board' }).click()
  await page.getByText('Save failed', { exact: true }).waitFor()
  await screenshot('save-failure.png')

  if (errors.length) throw new Error(`Renderer errors:\n${errors.join('\n')}`)
  process.stdout.write(
    `captured ${await readdir(output).then((files) => files.length)} ${captureSet} images\n`
  )
} finally {
  await application.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
  await new Promise((resolve) => setTimeout(resolve, 500))
  await rm(testRoot, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 250
  }).catch(() => undefined)
}
