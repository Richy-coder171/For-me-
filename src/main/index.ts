import path from 'node:path'
import { stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { app, BrowserWindow, net, protocol, session } from 'electron'

import { MEDIA_SCHEME, mediaPathFromUrl } from '../shared/schemas/media'
import { registerHandlers } from './ipc/registerHandlers'
import { parseByteRange } from './security/byteRange'
import { isCanvasNoteDocumentResponse } from './security/contentSecurityPolicy'
import { DatabaseService } from './services/databaseService'
import { MediaService, mediaMimeType } from './services/mediaService'
import { WorkspaceService } from './services/workspaceService'

let mainWindow: BrowserWindow | null = null
const workspaces = new WorkspaceService()
const database = new DatabaseService()
const media = new MediaService(() => workspaces.activeRoot)
let disposeHandlers: (() => void) | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function contentSecurityPolicy(): string {
  const connectSource = app.isPackaged ? "'self'" : "'self' ws: http://localhost:*"
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: canvasnote-media:",
    "font-src 'self' data:",
    "media-src 'self' blob: canvasnote-media:",
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    `connect-src ${connectSource}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'"
  ].join('; ')
}

function rendererDocumentUrl(): string {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return process.env.ELECTRON_RENDERER_URL
  }
  return pathToFileURL(path.join(__dirname, '../renderer/index.html')).toString()
}

function createWindow(): void {
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
  mainWindow.on('closed', () => {
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
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!isCanvasNoteDocumentResponse(details, rendererDocumentUrl(), mainWindow?.webContents.id)) {
      callback({})
      return
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()]
      }
    })
  })

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

  disposeHandlers = registerHandlers(workspaces, database, media)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  disposeHandlers?.()
  disposeHandlers = null
})
