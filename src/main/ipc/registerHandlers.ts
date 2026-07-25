import { app, BrowserWindow, ipcMain } from 'electron'

import { IPC_CHANNELS } from '../../shared/ipc'
import {
  boardCreateRequestSchema,
  boardFavoriteRequestSchema,
  boardIdRequestSchema,
  boardListRequestSchema,
  boardSaveRequestSchema,
  boardFileSchema,
  type BoardFile,
  type BoardSummary
} from '../../shared/schemas/board'
import { stableIdSchema } from '../../shared/schemas/common'
import { mediaImportRequestSchema, mediaPathRequestSchema } from '../../shared/schemas/media'
import { createWorkspaceRequestSchema } from '../../shared/schemas/workspace'
import { exportCanvasRequestSchema } from '../../shared/schemas/export'
import { appSettingsSchema } from '../../shared/schemas/settings'
import { templateIdSchema } from '../../shared/templates'
import { BoardService, type StoredBoard } from '../services/boardService'
import { DatabaseService, type BoardMetadata } from '../services/databaseService'
import type { ExportService } from '../services/exportService'
import type { MediaService } from '../services/mediaService'
import type { SettingsService } from '../services/settingsService'
import type { WorkspaceService } from '../services/workspaceService'

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('This operation is only available to the main application window.')
  }
  return window
}

function toSummary(board: BoardMetadata, searchText?: string): BoardSummary {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    openedAt: board.openedAt,
    isFavorite: board.favorite,
    deletedAt: board.deletedAt,
    itemCount: board.itemCount,
    ...(searchText ? { searchText } : {})
  }
}

function metadataFor(
  stored: StoredBoard,
  openedAt?: string
): Parameters<DatabaseService['upsertBoard']>[0] {
  return {
    id: stored.board.id,
    path: `boards/${stored.board.id}.canvasnote`,
    title: stored.board.title,
    createdAt: stored.board.createdAt,
    updatedAt: stored.board.updatedAt,
    openedAt,
    itemCount: stored.board.nodes.length + stored.board.connections.length
  }
}

export function registerHandlers(
  workspaces: WorkspaceService,
  database: DatabaseService,
  media: MediaService,
  exports: ExportService,
  settings: SettingsService
): () => void {
  let boards: BoardService | null = null

  const requireBoards = (): BoardService => {
    if (!boards || !workspaces.activeRoot) throw new Error('Open a workspace first.')
    return boards
  }

  const activateWorkspace = async <T extends { id: string } | null>(
    result: Promise<T>
  ): Promise<T> => {
    const workspace = await result
    if (!workspace) return workspace
    const root = workspaces.activeRoot
    if (!root) throw new Error('CanvasNote could not activate the selected workspace.')

    try {
      database.initialize(root)
      boards = new BoardService(root, settings.get().backupLimit)
      const storedBoards = await boards.list()
      for (const stored of storedBoards) {
        database.upsertBoard(metadataFor(stored))
        database.indexBoardContent(stored.board)
      }
      return workspace
    } catch (error) {
      database.close()
      boards = null
      workspaces.close()
      throw error
    }
  }

  const indexBoard = (stored: StoredBoard, openedAt?: string): void => {
    database.upsertBoard(metadataFor(stored, openedAt))
    database.indexBoardContent(stored.board)
  }

  ipcMain.handle(IPC_CHANNELS.appInfo, (event) => {
    senderWindow(event)
    return {
      version: app.getVersion(),
      platform: process.platform
    }
  })

  ipcMain.handle(IPC_CHANNELS.workspaceRecent, (event) => {
    senderWindow(event)
    return workspaces.recent()
  })
  ipcMain.handle(IPC_CHANNELS.workspaceCreate, (event, input: unknown) => {
    const request = createWorkspaceRequestSchema.parse(input)
    return activateWorkspace(workspaces.create(senderWindow(event), request.name))
  })
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, (event) =>
    activateWorkspace(workspaces.open(senderWindow(event)))
  )
  ipcMain.handle(IPC_CHANNELS.workspaceOpenRecent, (event, workspaceId: unknown) => {
    senderWindow(event)
    return activateWorkspace(workspaces.openRecent(stableIdSchema.parse(workspaceId)))
  })
  ipcMain.handle(IPC_CHANNELS.workspaceStats, async (event) => {
    senderWindow(event)
    requireBoards()
    return {
      storageBytes: await workspaces.storageBytes(),
      boardCount: database.listBoards().length,
      trashCount: database.listBoards({ trashed: true }).length
    }
  })
  ipcMain.handle(IPC_CHANNELS.workspaceClose, (event) => {
    senderWindow(event)
    boards = null
    database.close()
    workspaces.close()
  })

  ipcMain.handle(IPC_CHANNELS.boardList, (event, input: unknown) => {
    senderWindow(event)
    requireBoards()
    const request = boardListRequestSchema.parse(input)
    const rows = database.listBoards({
      trashed: request.view === 'trash',
      favorite: request.view === 'favorites' ? true : undefined
    })
    const matchingIds = request.query ? new Set(database.searchBoardIds(request.query)) : null
    const filtered = matchingIds ? rows.filter((board) => matchingIds.has(board.id)) : rows
    const searchText = database.searchTextByBoard()
    return (request.view === 'recent' ? filtered.slice(0, 12) : filtered).map((board) =>
      toSummary(board, searchText.get(board.id))
    )
  })

  ipcMain.handle(IPC_CHANNELS.boardCreate, async (event, input: unknown) => {
    senderWindow(event)
    const request = boardCreateRequestSchema.parse(input)
    const stored = await requireBoards().create(request.title)
    indexBoard(stored, new Date().toISOString())
    return stored
  })
  ipcMain.handle(IPC_CHANNELS.boardCreateFromTemplate, async (event, input: unknown) => {
    senderWindow(event)
    const stored = await requireBoards().createFromTemplate(templateIdSchema.parse(input))
    indexBoard(stored, new Date().toISOString())
    return stored
  })
  ipcMain.handle(IPC_CHANNELS.boardImport, async (event) => {
    const window = senderWindow(event)
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog(window, {
      title: 'Import CanvasNote board',
      properties: ['openFile'],
      filters: [{ name: 'CanvasNote board', extensions: ['canvasnote'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    const stored = await requireBoards().importFile(result.filePaths[0])
    indexBoard(stored, new Date().toISOString())
    return stored
  })
  ipcMain.handle(IPC_CHANNELS.boardOpen, async (event, input: unknown) => {
    senderWindow(event)
    const { boardId } = boardIdRequestSchema.parse(input)
    const stored = await requireBoards().read(boardId)
    indexBoard(stored, new Date().toISOString())
    return stored
  })
  ipcMain.handle(IPC_CHANNELS.boardSave, async (event, input: unknown) => {
    senderWindow(event)
    const request = boardSaveRequestSchema.parse(input)
    const board: BoardFile = { ...request.board, updatedAt: new Date().toISOString() }
    const stored = await requireBoards().save(board, request.expectedRevision)
    indexBoard(stored)
    return stored
  })
  ipcMain.handle(IPC_CHANNELS.boardFavorite, (event, input: unknown) => {
    senderWindow(event)
    const request = boardFavoriteRequestSchema.parse(input)
    if (!database.setFavorite(request.boardId, request.favorite)) {
      throw new Error('Board not found.')
    }
  })
  ipcMain.handle(IPC_CHANNELS.boardTrash, async (event, input: unknown) => {
    senderWindow(event)
    const { boardId } = boardIdRequestSchema.parse(input)
    await requireBoards().moveToTrash(boardId)
    if (!database.trashBoard(boardId)) {
      await requireBoards().restore(boardId)
      throw new Error('Board not found.')
    }
  })
  ipcMain.handle(IPC_CHANNELS.boardRestore, async (event, input: unknown) => {
    senderWindow(event)
    const { boardId } = boardIdRequestSchema.parse(input)
    const stored = await requireBoards().restore(boardId)
    if (!database.restoreBoard(boardId)) indexBoard(stored)
  })
  ipcMain.handle(IPC_CHANNELS.boardDelete, async (event, input: unknown) => {
    senderWindow(event)
    const { boardId } = boardIdRequestSchema.parse(input)
    await requireBoards().deletePermanently(boardId)
    database.deleteBoard(boardId)
  })

  ipcMain.handle(IPC_CHANNELS.mediaImport, (event, input: unknown) => {
    const window = senderWindow(event)
    const { kind } = mediaImportRequestSchema.parse(input)
    return media.importFile(window, kind)
  })
  ipcMain.handle(IPC_CHANNELS.mediaExists, (event, input: unknown) => {
    senderWindow(event)
    const { relativePath } = mediaPathRequestSchema.parse(input)
    return media.exists(relativePath)
  })
  ipcMain.handle(IPC_CHANNELS.mediaOpen, (event, input: unknown) => {
    senderWindow(event)
    const { relativePath } = mediaPathRequestSchema.parse(input)
    return media.open(relativePath)
  })
  ipcMain.handle(IPC_CHANNELS.mediaReveal, (event, input: unknown) => {
    senderWindow(event)
    const { relativePath } = mediaPathRequestSchema.parse(input)
    return media.reveal(relativePath)
  })

  ipcMain.handle(IPC_CHANNELS.exportJson, (event, input: unknown) => {
    const window = senderWindow(event)
    return exports.saveJson(window, boardFileSchema.parse(input))
  })
  ipcMain.handle(IPC_CHANNELS.exportCanvas, (event, input: unknown) => {
    const window = senderWindow(event)
    return exports.saveCanvas(window, exportCanvasRequestSchema.parse(input))
  })

  ipcMain.handle(IPC_CHANNELS.settingsGet, (event) => {
    senderWindow(event)
    return settings.snapshot()
  })
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, (event, input: unknown) => {
    senderWindow(event)
    const values = settings.update(appSettingsSchema.parse(input))
    boards?.setBackupLimit(values.backupLimit)
    return settings.snapshot()
  })
  ipcMain.handle(IPC_CHANNELS.settingsOpenData, (event) => {
    senderWindow(event)
    return settings.openDataLocation()
  })
  ipcMain.handle(IPC_CHANNELS.settingsOpenBackups, (event) => {
    senderWindow(event)
    requireBoards()
    return settings.openBackups()
  })

  return () => {
    Object.values(IPC_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel))
    boards = null
    database.close()
    workspaces.close()
  }
}
