import path from 'node:path'
import { stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { app, BrowserWindow, ipcMain, net, protocol, session } from 'electron'

import { MEDIA_SCHEME, mediaPathFromUrl } from '../shared/schemas/media'
import { IPC_CHANNELS } from '../shared/ipc'
import { registerHandlers } from './ipc/registerHandlers'
import { parseByteRange } from './security/byteRange'
import {
  contentSecurityPolicy,
  isCanvasNoteDocumentResponse
} from './security/contentSecurityPolicy'
import { DatabaseService } from './services/databaseService'
import { MediaService, mediaMimeType } from './services/mediaService'
import { ExportService } from './services/exportService'
import { WorkspaceService } from './services/workspaceService'
import { SettingsService } from './services/settingsService'

let mainWindow: BrowserWindow | null = null
const workspaces = new WorkspaceService()
const database = new DatabaseService()
const media = new MediaService(() => workspaces.activeRoot)
const testExportDirectory = !app.isPackaged
  ? process.env.CANVASNOTE_TEST_EXPORT_DIRECTORY
  : undefined
const exports = new ExportService(
  testExportDirectory
    ? {
        showSaveDialog: async (_parent, options) => {
          const extension = options.filters?.[0]?.extensions[0]
          if (!extension || !['canvasnote', 'png', 'pdf'].includes(extension)) {
            throw new Error('Unsupported test export format.')
          }
          return {
            canceled: false,
            filePath: path.join(testExportDirectory, `canvasnote-e2e.${extension}`)
          }
        }
      }
    : {}
)
const settings = new SettingsService(() => workspaces.activeRoot)
let disposeHandlers: (() => void) | null = null
let closeApproved = false
let closeFallback: ReturnType<typeof setTimeout> | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function rendererDocumentUrl(): string {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL
  }
  return pathToFileURL(path.join(__dirname, '../renderer/index.html')).toString()
}

function isTrustedRendererPermission(
  webContents: Electron.WebContents | null,
  requestingUrl: string | undefined,
  isMainFrame: boolean
): boolean {
  if (!mainWindow || !isMainFrame || !requestingUrl) return false
  if (webContents && webContents !== mainWindow.webContents) return false

  try {
    const requested = new URL(requestingUrl)
    const renderer = new URL(rendererDocumentUrl())
    if (renderer.protocol !== 'file:') return requested.origin === renderer.origin
    requested.search = ''
    requested.hash = ''
    return requested.href === renderer.href
  } catch {
    return false
  }
}

function createWindow(): void {
  closeApproved = false
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#f6f7f9',
    title: 'CanvasNote',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    if (closeApproved || !mainWindow) return
    event.preventDefault()
    mainWindow.webContents.send(IPC_CHANNELS.appCloseRequested)
    closeFallback ??= setTimeout(() => {
      closeApproved = true
      mainWindow?.close()
    }, 10_000)
  })
  mainWindow.on('closed', () => {
    if (closeFallback) clearTimeout(closeFallback)
    closeFallback = null
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.on(IPC_CHANNELS.appCloseReady, (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return
    if (closeFallback) clearTimeout(closeFallback)
    closeFallback = null
    closeApproved = true
    mainWindow.close()
  })
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isCanvasNoteDocumentResponse(details, rendererDocumentUrl(), mainWindow?.webContents.id)) {
      callback({})
      return
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy(app.isPackaged)]
      }
    })
  })
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, _requestingOrigin, details) =>
      (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') &&
      isTrustedRendererPermission(webContents, details.requestingUrl, details.isMainFrame)
  )
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      callback(
        (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write') &&
          isTrustedRendererPermission(webContents, details.requestingUrl, details.isMainFrame)
      )
    }
  )

  protocol.handle(MEDIA_SCHEME, async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
    }

    try {
      const relativePath = mediaPathFromUrl(request.url)
      const filePath = await media.resolve(relativePath)
      const fileSize = (await stat(filePath)).size
      const headers = new Headers()
      for (const name of ['range', 'if-range']) {
        const value = request.headers.get(name)
        if (value) headers.set(name, value)
      }
      const rangeHeader = request.headers.get('range')
      let byteRange: ReturnType<typeof parseByteRange> | null = null
      if (rangeHeader) {
        try {
          byteRange = parseByteRange(rangeHeader, fileSize)
        } catch {
          return new Response(null, {
            status: 416,
            headers: {
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes */${fileSize}`
            }
          })
        }
      }
      const fileResponse = await net.fetch(pathToFileURL(filePath).toString(), {
        method: request.method,
        headers,
        bypassCustomProtocolHandlers: true
      })
      const responseHeaders = new Headers(fileResponse.headers)
      responseHeaders.set('Content-Type', mediaMimeType(relativePath))
      responseHeaders.set('Content-Security-Policy', "default-src 'none'; sandbox")
      responseHeaders.set('X-Content-Type-Options', 'nosniff')
      responseHeaders.set('Accept-Ranges', 'bytes')
      const rangeLength = byteRange ? byteRange.end - byteRange.start + 1 : null
      const returnedLength = Number(responseHeaders.get('content-length'))
      const rangeApplied =
        byteRange !== null &&
        (!request.headers.has('if-range') ||
          !Number.isFinite(returnedLength) ||
          returnedLength === rangeLength)
      if (rangeApplied && byteRange && rangeLength !== null) {
        responseHeaders.set(
          'Content-Range',
          `bytes ${byteRange.start}-${byteRange.end}/${fileSize}`
        )
        responseHeaders.set('Content-Length', String(rangeLength))
      }
      return new Response(request.method === 'HEAD' ? null : fileResponse.body, {
        status: rangeApplied ? 206 : fileResponse.status,
        statusText: fileResponse.statusText,
        headers: responseHeaders
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  disposeHandlers = registerHandlers(workspaces, database, media, exports, settings)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  disposeHandlers?.()
  disposeHandlers = null
})
