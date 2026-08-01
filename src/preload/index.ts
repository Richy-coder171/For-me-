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
import type { TemplateId } from '../shared/templates'
import type { ExportCanvasRequest } from '../shared/schemas/export'
import type { AppSettings, SettingsSnapshot } from '../shared/schemas/settings'

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

const MAX_IMAGE_TRANSFER_BYTES = 25 * 1024 * 1024

function boardTemplateId(value: string): TemplateId {
  if (
    value !== 'video-research' &&
    value !== 'study-board' &&
    value !== 'moodboard' &&
    value !== 'project-planning' &&
    value !== 'content-planning' &&
    value !== 'learning-roadmap'
  ) {
    throw new Error('Invalid board template.')
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

function externalUrl(value: string): string {
  try {
    const url = new URL(value)
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      url.username ||
      url.password ||
      value.length > 2048
    ) {
      throw new Error('Invalid external URL.')
    }
    return url.href
  } catch {
    throw new Error('Only HTTP(S) links can be opened.')
  }
}

const api: CanvasNoteApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo) as Promise<AppInfo>,
    openExternal: (url) =>
      ipcRenderer.invoke(IPC_CHANNELS.appOpenExternal, externalUrl(url)) as Promise<void>,
    onCloseRequested: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on(IPC_CHANNELS.appCloseRequested, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.appCloseRequested, listener)
    },
    readyToClose: () => ipcRenderer.send(IPC_CHANNELS.appCloseReady)
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
        boardTemplateId(templateId)
      ) as Promise<OpenBoard>,
    importFile: () => ipcRenderer.invoke(IPC_CHANNELS.boardImport) as Promise<OpenBoard | null>,
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
    importFiles: (kind) =>
      ipcRenderer.invoke(IPC_CHANNELS.mediaImportMany, {
        kind: mediaKind(kind)
      }) as Promise<ImportedMedia[]>,
    importImageData: (filename, data) => {
      if (!filename || filename.length > 255) throw new Error('Invalid image filename.')
      if (!(data instanceof Uint8Array) || data.byteLength > MAX_IMAGE_TRANSFER_BYTES) {
        throw new Error('Pasted or dropped images must be no larger than 25 MB.')
      }
      return ipcRenderer.invoke(IPC_CHANNELS.mediaImportImageData, {
        filename,
        data
      }) as Promise<ImportedMedia>
    },
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
  },
  export: {
    json: (board) => ipcRenderer.invoke(IPC_CHANNELS.exportJson, board) as Promise<boolean>,
    canvas: (request: ExportCanvasRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.exportCanvas, request) as Promise<boolean>
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet) as Promise<SettingsSnapshot>,
    update: (settings: AppSettings) =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, settings) as Promise<SettingsSnapshot>,
    openDataLocation: () => ipcRenderer.invoke(IPC_CHANNELS.settingsOpenData) as Promise<void>,
    openBackups: () => ipcRenderer.invoke(IPC_CHANNELS.settingsOpenBackups) as Promise<void>
  }
}

contextBridge.exposeInMainWorld('canvasNote', Object.freeze(api))
