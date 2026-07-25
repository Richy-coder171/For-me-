import { randomUUID } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { BrowserWindow, NativeImage, SaveDialogOptions } from 'electron'

import { boardFileSchema, type BoardFile } from '../../shared/schemas/board'
import type { ExportCanvasRequest } from '../../shared/schemas/export'

function safeFilename(title: string): string {
  const cleaned = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
  return (cleaned || 'CanvasNote board').slice(0, 120)
}

async function writeExport(filePath: string, data: Uint8Array): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`
  )
  try {
    await writeFile(temporaryPath, data, { mode: 0o600 })
    await rename(temporaryPath, filePath)
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function imagePdf(image: NativeImage): Promise<Buffer> {
  const { BrowserWindow } = await import('electron')
  const size = image.getSize()
  const window = new BrowserWindow({
    show: false,
    width: Math.max(320, size.width),
    height: Math.max(240, size.height),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  const html = `<!doctype html><meta charset="utf-8"><style>@page{size:${size.width}px ${size.height}px;margin:0}html,body{margin:0;background:white}img{display:block;width:${size.width}px;height:${size.height}px;object-fit:contain}</style><img alt="CanvasNote board" src="${image.toDataURL()}">`
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await window.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
  } finally {
    if (!window.isDestroyed()) window.destroy()
  }
}

type ShowSaveDialog = (
  parent: BrowserWindow,
  options: SaveDialogOptions
) => Promise<{ canceled: boolean; filePath?: string }>

export class ExportService {
  readonly #showSaveDialog?: ShowSaveDialog
  readonly #imageToPdf: (image: NativeImage) => Promise<Buffer>

  constructor(
    dependencies: {
      showSaveDialog?: ShowSaveDialog
      imageToPdf?: (image: NativeImage) => Promise<Buffer>
    } = {}
  ) {
    this.#showSaveDialog = dependencies.showSaveDialog
    this.#imageToPdf = dependencies.imageToPdf ?? imagePdf
  }

  async #chooseDestination(
    parent: BrowserWindow,
    options: SaveDialogOptions
  ): Promise<{ canceled: boolean; filePath?: string }> {
    if (this.#showSaveDialog) return this.#showSaveDialog(parent, options)
    const { dialog } = await import('electron')
    return dialog.showSaveDialog(parent, options)
  }

  async saveJson(parent: BrowserWindow, board: BoardFile): Promise<boolean> {
    const validBoard = boardFileSchema.parse(board)
    const result = await this.#chooseDestination(parent, {
      title: 'Export CanvasNote board',
      defaultPath: `${safeFilename(validBoard.title)}.canvasnote`,
      filters: [{ name: 'CanvasNote board', extensions: ['canvasnote'] }]
    })
    if (result.canceled || !result.filePath) return false
    const data = Buffer.from(`${JSON.stringify(validBoard, null, 2)}\n`, 'utf8')
    await writeExport(result.filePath, data)
    return true
  }

  async saveCanvas(parent: BrowserWindow, request: ExportCanvasRequest): Promise<boolean> {
    const extension = request.format
    const result = await this.#chooseDestination(parent, {
      title: `Export CanvasNote ${request.format.toUpperCase()}`,
      defaultPath: `${safeFilename(request.title)}.${extension}`,
      filters: [
        {
          name: request.format === 'png' ? 'PNG image' : 'PDF document',
          extensions: [extension]
        }
      ]
    })
    if (result.canceled || !result.filePath) return false

    const bounds = parent.getContentBounds()
    if (
      request.rect.x + request.rect.width > bounds.width + 1 ||
      request.rect.y + request.rect.height > bounds.height + 1
    ) {
      throw new Error('The requested export area is outside the application window.')
    }
    const image = await parent.webContents.capturePage(request.rect)
    if (image.isEmpty()) throw new Error('CanvasNote could not capture the board.')
    const data = request.format === 'png' ? image.toPNG() : await this.#imageToPdf(image)
    await writeExport(result.filePath, data)
    return true
  }
}
