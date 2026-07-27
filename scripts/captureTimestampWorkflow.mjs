/* global document, HTMLVideoElement */

import { _electron as electron } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const repository = process.cwd()
const output = path.join(repository, 'docs', 'screenshots', 'timestamp-workflow.mp4')
const testRoot = await mkdtemp(path.join(tmpdir(), 'canvasnote-workflow-'))
const rawVideo = path.join(testRoot, 'timestamp-workflow.webm')
const videoFixture = path.join(testRoot, 'interview.webm')
let application
let recording = false

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repository,
      stdio: options.stdio ?? 'inherit',
      shell: options.shell ?? false
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`))
    })
  })
}

async function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    await run('ffmpeg', ['-version'], { stdio: 'ignore' })
    return 'ffmpeg'
  } catch {
    const toolRoot = path.join(testRoot, 'ffmpeg')
    await mkdir(toolRoot)
    const installArgs = [
      'install',
      '--prefix',
      toolRoot,
      '--no-save',
      '--no-package-lock',
      '--loglevel=error',
      'ffmpeg-static@5.3.0'
    ]
    const npmCli = path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js'
    )
    await run(
      process.platform === 'win32' ? process.execPath : 'npm',
      process.platform === 'win32' ? [npmCli, ...installArgs] : installArgs
    )
    return path.join(
      toolRoot,
      'node_modules',
      'ffmpeg-static',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    )
  }
}

async function setDialogPath(selectedPath) {
  await application.evaluate(({ dialog }, filePath) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true,
      value: async () => ({ canceled: false, filePaths: [filePath] })
    })
  }, selectedPath)
}

try {
  await stat(path.join(repository, 'out', 'main', 'index.js')).catch(() => {
    throw new Error('Build CanvasNote first with `npm run build`.')
  })
  await mkdir(path.dirname(output), { recursive: true })

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
  environment.CANVASNOTE_TEST_EXPORT_DIRECTORY = path.join(testRoot, 'exports')
  environment.TZ = 'UTC'

  application = await electron.launch({
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
  await page.waitForLoadState('domcontentloaded')
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720)
  })

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Theme').selectOption('light')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await setDialogPath(testRoot)
  await page.getByLabel('New workspace name').fill('Timestamp Demo')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByRole('button', { name: 'New board' }).click()
  await page.getByPlaceholder('Board title').fill('Interview highlights')
  await page.locator('form').getByRole('button', { name: 'Create board', exact: true }).click()
  await page.getByTestId('canvas-editor').waitFor()
  await setDialogPath(videoFixture)

  await page.screencast.start({
    path: rawVideo,
    size: { width: 1280, height: 720 },
    quality: 82,
    annotate: { duration: 700, fontSize: 18, position: 'top-right' }
  })
  recording = true
  await page.screencast.showChapter('Timestamp workflow', {
    description: 'Import a clip, capture a moment, then jump back to it.',
    duration: 1_100
  })

  await page.getByRole('button', { name: 'Import local video' }).click()
  const localVideo = page.locator('video').first()
  await localVideo.waitFor()
  await page.waitForFunction(() => {
    const video = document.querySelector('video')
    return video instanceof HTMLVideoElement && video.readyState >= 1
  })
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await page.waitForTimeout(500)

  await page.screencast.showChapter('Pause at the useful moment', { duration: 800 })
  await localVideo.evaluate(async (video) => {
    video.muted = true
    video.loop = true
    video.playbackRate = 0.5
    video.currentTime = 0
    await video.play()
  })
  await page.waitForTimeout(350)
  const capturedTime = await localVideo.evaluate((video) => video.currentTime)
  await page
    .locator('[data-shape-type="cn-local-video"]')
    .getByRole('button', { name: 'Add note at current time' })
    .click()
  if (!(await localVideo.evaluate((video) => video.paused))) {
    throw new Error('Adding the timestamp note did not pause the video.')
  }
  await page.getByLabel('Timestamp note content').fill('Key interview moment')
  await page.getByRole('button', { name: 'Zoom to fit' }).click()
  await page.waitForTimeout(600)

  const awayTime = await localVideo.evaluate((video, timestamp) => {
    const next = Math.min(video.duration, Math.max(timestamp + 0.2, video.duration * 0.8))
    video.currentTime = next
    return next
  }, capturedTime)
  await page.screencast.showChapter('Click the note to seek back', { duration: 800 })
  await page.getByRole('button', { name: /^Seek video to / }).click()
  await page.waitForFunction(
    ({ timestamp, away }) => {
      const video = document.querySelector('video')
      return (
        video instanceof HTMLVideoElement &&
        video.paused &&
        Math.abs(video.currentTime - timestamp) < Math.max(0.08, Math.abs(away - timestamp) / 2)
      )
    },
    { timestamp: capturedTime, away: awayTime }
  )
  await page.waitForTimeout(900)

  if (errors.length) throw new Error(`Renderer errors:\n${errors.join('\n')}`)
  await page.screencast.stop()
  recording = false
  await application.close()
  application = undefined

  const ffmpeg = await ffmpegPath()
  await run(ffmpeg, [
    '-y',
    '-loglevel',
    'error',
    '-i',
    rawVideo,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output
  ])
  await run(ffmpeg, ['-v', 'error', '-i', output, '-f', 'null', '-'], { stdio: 'ignore' })
  const { size } = await stat(output)
  if (size < 10_000) throw new Error('The captured MP4 is unexpectedly small.')
  process.stdout.write(`captured ${path.relative(repository, output)} (${size} bytes)\n`)
} finally {
  if (recording)
    await application
      ?.firstWindow()
      .then((page) => page.screencast.stop())
      .catch(() => {})
  await application?.close().catch(() => {})
  await rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }).catch(
    () => {}
  )
}
