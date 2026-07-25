import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS, type AppInfo, type CanvasNoteApi } from '../shared/ipc'
import type {
  BoardFile,
  BoardListRequest,
  BoardSummary,
  OpenBoard,
  WorkspaceStats
} from '../shared/schemas/board'
import type { ImportedMedia, MediaKind } from '../shared/schemas/media'
import type { WorkspaceSummary } from '../shared/schemas/workspace'
import { templateIdSchema } from '../shared/templates'

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

function revision(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid board revision.')
  return value
}

function mediaKind(value: string): MediaKind {
  if (value !== 'image' && value !== 'video' && value !== 'file') {
    throw new Error('Invalid media kind.')
  }
  return value
}

function mediaPath(value: string): string {
  if (
    !value ||
    value.length > 1024 ||
    value.includes('\0') ||
    value.includes('\\') ||
    !/^media\/(images|videos|files)\/[^/]+$/.test(value)
  ) {
    throw new Error('Invalid media path.')
  }
  let decoded = value
  try {
    for (let pass = 0; pass < 2; pass += 1) decoded = decodeURIComponent(decoded)
  } catch {
    throw new Error('Invalid media path.')
  }
  if (decoded.includes('\\') || decoded.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid media path.')
  }
  return value
}

function mediaUrl(relativePath: string): string {
  return `canvasnote-media://workspace/${mediaPath(relativePath)
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
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
    createFromTemplate: (templateId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.boardCreateFromTemplate,
        templateIdSchema.parse(templateId)
      ) as Promise<OpenBoard>,
    open: (boardId) =>
      ipcRenderer.invoke(IPC_CHANNELS.boardOpen, {
        boardId: stableId(boardId)
      }) as Promise<OpenBoard>,
    save: (board: BoardFile, expectedRevision: string) =>
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
  },
  media: {
    importFile: (kind) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaImport, {
        kind: mediaKind(kind)
      }) as Promise<ImportedMedia | null>,
    toUrl: mediaUrl,
    exists: (relativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaExists, {
        relativePath: mediaPath(relativePath)
      }) as Promise<boolean>,
    open: (relativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaOpen, {
        relativePath: mediaPath(relativePath)
      }) as Promise<void>,
    reveal: (relativePath) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaReveal, {
        relativePath: mediaPath(relativePath)
      }) as Promise<void>
  }
}

contextBridge.exposeInMainWorld('canvasNote', Object.freeze(api))
