import { expect, test, _electron as electron, type ElectronApplication } from '@playwright/test'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

test('keeps a failed save visible and can export before reloading a conflict', async () => {
  const testRoot = await mkdtemp(path.join(tmpdir(), 'canvasnote-save-recovery-'))
  const exportDirectory = path.join(testRoot, 'exports')
  await mkdir(exportDirectory)
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') environment[key] = value
  }
  environment.CANVASNOTE_TEST_EXPORT_DIRECTORY = exportDirectory

  let application: ElectronApplication | undefined
  try {
    application = await electron.launch({
      args: ['.', `--user-data-dir=${path.join(testRoot, 'user-data')}`],
      cwd: process.cwd(),
      env: environment
    })
    const page = await application.firstWindow()
    await application.evaluate(({ dialog }, workspaceParent) => {
      Object.defineProperty(dialog, 'showOpenDialog', {
        configurable: true,
        value: async () => ({ canceled: false, filePaths: [workspaceParent] })
      })
    }, testRoot)

    await page.getByLabel('New workspace name').fill('Recovery Workspace')
    await page.getByRole('button', { name: 'Create workspace' }).click()
    await page.getByRole('button', { name: 'New board' }).click()
    await page.getByPlaceholder('Board title').fill('Disk version')
    await page.locator('form').getByRole('button', { name: 'Create board', exact: true }).click()
    await expect(page.getByLabel('Board title')).toHaveValue('Disk version')

    await application.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('board:save')
      ipcMain.handle('board:save', async () => {
        throw new Error('Board private-board-id changed outside this session.')
      })
    })
    await page.getByLabel('Board title').fill('Unsaved local version')
    await page.getByRole('button', { name: 'Save board' }).click()

    await expect(page.getByRole('alert')).toContainText('Externally modified')
    await expect(page.getByText('private-board-id')).toHaveCount(0)
    await page.getByRole('button', { name: 'Export recovery copy' }).click()
    await expect(page.getByText('Recovery copy exported.')).toBeVisible()
    const recovery = JSON.parse(
      await readFile(path.join(exportDirectory, 'canvasnote-e2e.canvasnote'), 'utf8')
    ) as { title: string }
    expect(recovery.title).toBe('Unsaved local version')

    await page.getByRole('button', { name: 'Reload disk version' }).click()
    await expect(page.getByRole('dialog', { name: 'Reload disk version?' })).toContainText(
      'discards the edits currently open'
    )
    await page.getByRole('button', { name: 'Reload and discard local edits' }).click()
    await expect(page.getByLabel('Board title')).toHaveValue('Disk version')
    await expect(page.getByText('Externally modified')).toHaveCount(0)
  } finally {
    await application?.close()
    await rm(testRoot, { recursive: true, force: true })
  }
})
