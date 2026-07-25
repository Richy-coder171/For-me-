import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS, type AppInfo, type CanvasNoteApi } from '../shared/ipc'
import type {
  BoardFile,
  BoardListRequest,
  BoardSummary,
  OpenBoard,
  WorkspaceStats
} from '../shared/schemas/board'
import type { WorkspaceSummary } from '../shared/schemas/workspace'

function workspaceName(value: string): string {
  const name = value.trim()
  if (!name || name.length > 120)
    throw new Error('Enter a workspace name between 1 and 120 characters.')
  return name
}

function stableId(value: string): string {
  if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(value)) throw new Error('Invalid workspace ID.')
  return value
}

function boardTitle(value: string): string {
  const title = value.trim()
  if (!title || title.length > 240)
    throw new Error('Enter a board title between 1 and 240 characters.')
  return title
}

function revision(value: string | undefined): string | undefined {
  if (value !== undefined && !/^[a-f0-9]{64}$/.test(value))
    throw new Error('Invalid board revision.')
  return value
}

const api: CanvasNoteApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo) as Promise<AppInfo>
  },
  workspace: {
    create: (name) => {
      const request = { name: workspaceName(name) }
      return ipcRenderer.invoke(
        IPC_CHANNELS.workspaceCreate,
        request
      ) as Promise<WorkspaceSummary | null>
    },
    open: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceOpen) as Promise<WorkspaceSummary | null>,
    openRecent: (workspaceId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.workspaceOpenRecent,
        stableId(workspaceId)
      ) as Promise<WorkspaceSummary>,
    recent: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceRecent) as Promise<WorkspaceSummary[]>,
    stats: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceStats) as Promise<WorkspaceStats>,
    close: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceClose) as Promise<void>
  },
  boards: {
    list: (request: BoardListRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardList, request) as Promise<BoardSummary[]>,
    create: (title) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardCreate, {
        title: boardTitle(title)
      }) as Promise<OpenBoard>,
    open: (boardId) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardOpen, {
        boardId: stableId(boardId)
      }) as Promise<OpenBoard>,
    save: (board: BoardFile, expectedRevision?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardSave, {
        board,
        expectedRevision: revision(expectedRevision)
      }) as Promise<OpenBoard>,
    favorite: (boardId, favorite) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardFavorite, {
        boardId: stableId(boardId),
        favorite
      }) as Promise<void>,
    trash: (boardId) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardTrash, {
        boardId: stableId(boardId)
      }) as Promise<void>,
    restore: (boardId) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardRestore, {
        boardId: stableId(boardId)
      }) as Promise<void>,
    deletePermanently: (boardId) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardDelete, {
        boardId: stableId(boardId)
      }) as Promise<void>
  }
}

contextBridge.exposeInMainWorld('canvasNote', Object.freeze(api))
