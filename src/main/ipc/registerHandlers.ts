import { app, BrowserWindow, ipcMain } from 'electron'

import { IPC_CHANNELS } from '../../shared/ipc'
import {
  boardCreateRequestSchema,
  boardFavoriteRequestSchema,
  boardIdRequestSchema,
  boardListRequestSchema,
  boardSaveRequestSchema,
  type BoardFile,
  type BoardSummary
} from '../../shared/schemas/board'
import { stableIdSchema } from '../../shared/schemas/common'
import { createWorkspaceRequestSchema } from '../../shared/schemas/workspace'
import { BoardService, type StoredBoard } from '../services/boardService'
import { DatabaseService, type BoardMetadata } from '../services/databaseService'
import type { WorkspaceService } from '../services/workspaceService'

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('This operation is only available to the main application window.')
  }
  return window
}

function toSummary(board: BoardMetadata): BoardSummary {
  return {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    openedAt: board.openedAt,
    isFavorite: board.favorite,
    deletedAt: board.deletedAt,
    itemCount: board.itemCount
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
  database: DatabaseService
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
      boards = new BoardService(root)
      const storedBoards = await boards.list()
      for (const stored of storedBoards) database.upsertBoard(metadataFor(stored))
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
    const query = request.query.toLocaleLowerCase()
    const filtered = query
      ? rows.filter((board) => board.title.toLocaleLowerCase().includes(query))
      : rows
    return (request.view === 'recent' ? filtered.slice(0, 12) : filtered).map(toSummary)
  })

  ipcMain.handle(IPC_CHANNELS.boardCreate, async (event, input: unknown) => {
    senderWindow(event)
    const request = boardCreateRequestSchema.parse(input)
    const stored = await requireBoards().create(request.title)
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

  return () => {
    Object.values(IPC_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel))
    boards = null
    database.close()
    workspaces.close()
  }
}
