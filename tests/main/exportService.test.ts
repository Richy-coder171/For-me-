import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { BrowserWindow, NativeImage } from 'electron'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ExportService } from '../../src/main/services/exportService'
import { createEmptyBoard } from '../../src/shared/schemas/board'

describe('ExportService', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'canvasnote-export-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes validated JSON, captured PNG, and generated PDF exports', async () => {
    const destinations = {
      canvasnote: path.join(root, 'board.canvasnote'),
      png: path.join(root, 'board.png'),
      pdf: path.join(root, 'board.pdf')
    }
    const image = {
      isEmpty: () => false,
      toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47])
    } as unknown as NativeImage
    const parent = {
      getContentBounds: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
      webContents: { capturePage: async () => image }
    } as unknown as BrowserWindow
    const service = new ExportService({
      showSaveDialog: async (_parent, options) => {
        const extension = options.filters?.[0]?.extensions[0] as keyof typeof destinations
        return { canceled: false, filePath: destinations[extension] }
      },
      imageToPdf: async () => Buffer.from('%PDF-CanvasNote', 'utf8')
    })

    const board = createEmptyBoard(
      'board-export',
      'Portable board',
      new Date('2026-07-25T08:00:00.000Z')
    )
    expect(await service.saveJson(parent, board)).toBe(true)
    expect(
      await service.saveCanvas(parent, {
        format: 'png',
        title: board.title,
        rect: { x: 0, y: 72, width: 900, height: 700 }
      })
    ).toBe(true)
    expect(
      await service.saveCanvas(parent, {
        format: 'pdf',
        title: board.title,
        rect: { x: 0, y: 72, width: 900, height: 700 }
      })
    ).toBe(true)

    expect(JSON.parse(await readFile(destinations.canvasnote, 'utf8'))).toEqual(board)
    expect((await readFile(destinations.png)).toString('hex')).toBe('89504e47')
    expect((await readFile(destinations.pdf)).toString('utf8')).toBe('%PDF-CanvasNote')
  })

  it('rejects capture rectangles outside the application content bounds', async () => {
    const parent = {
      getContentBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      webContents: { capturePage: async () => ({ isEmpty: () => false }) }
    } as unknown as BrowserWindow
    const service = new ExportService({
      showSaveDialog: async () => ({ canceled: false, filePath: path.join(root, 'bad.png') })
    })

    await expect(
      service.saveCanvas(parent, {
        format: 'png',
        title: 'Board',
        rect: { x: 700, y: 500, width: 200, height: 200 }
      })
    ).rejects.toThrow('outside the application window')
  })
})
