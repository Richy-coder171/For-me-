import { expect, test } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const snapshots = [
  ['welcome-light.png', 'welcome.png'],
  ['dashboard-empty.png', 'dashboard-empty.png'],
  ['dashboard-boards.png', 'dashboard.png'],
  ['board-empty.png', 'empty-board.png'],
  ['board-populated.png', 'board-editor.png'],
  ['toolbar.png', 'toolbar.png'],
  ['properties-panel.png', 'properties-panel.png'],
  ['search.png', 'command-palette.png'],
  ['settings-light.png', 'settings.png'],
  ['export-dialog.png', 'dialog.png'],
  ['missing-media.png', 'missing-media.png'],
  ['welcome-dark.png', 'dark-theme.png'],
  ['board-narrow.png', 'narrow-window.png']
] as const

test.skip(process.platform !== 'win32', 'Reviewed visual baselines are captured on Windows.')

test('critical CanvasNote surfaces match reviewed snapshots', async ({ browserName }, testInfo) => {
  void browserName
  test.setTimeout(240_000)
  const output = await mkdtemp(path.join(tmpdir(), 'canvasnote-visual-'))
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') environment[key] = value
  }
  environment.CANVASNOTE_DESIGN_OUTPUT = output
  environment.CANVASNOTE_TRACE_PATH = testInfo.outputPath('capture-trace.zip')

  try {
    await run(process.execPath, ['scripts/captureDesignScreenshots.mjs', 'after'], {
      cwd: process.cwd(),
      env: environment,
      timeout: 220_000
    })
    for (const [actual, expected] of snapshots) {
      expect(await readFile(path.join(output, actual))).toMatchSnapshot(expected)
    }
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})
