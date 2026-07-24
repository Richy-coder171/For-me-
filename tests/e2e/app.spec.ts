import {
  expect,
  test,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'

let application: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const environment: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') environment[key] = value
  }
  application = await electron.launch({ args: ['.'], cwd: process.cwd(), env: environment })
  page = await application.firstWindow()
})

test.afterAll(async () => {
  await application?.close()
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
    bridgeDomains: ['app', 'workspace']
  })
})
