import type {
  BoardFile,
  BoardListRequest,
  BoardSummary,
  OpenBoard,
  WorkspaceStats
} from './schemas/board'
import type { ImportedMedia, MediaKind } from './schemas/media'
import type { ExportCanvasRequest } from './schemas/export'
import type { WorkspaceSummary } from './schemas/workspace'
import type { AppSettings, SettingsSnapshot } from './schemas/settings'
import type { TemplateId } from './templates'

export const IPC_CHANNELS = {
  appInfo: 'app:info',
  appOpenExternal: 'app:open-external',
  appCloseRequested: 'app:close-requested',
  appCloseReady: 'app:close-ready',
  workspaceCreate: 'workspace:create',
  workspaceOpen: 'workspace:open',
  workspaceOpenRecent: 'workspace:open-recent',
  workspaceRecent: 'workspace:recent',
  workspaceClose: 'workspace:close',
  workspaceStats: 'workspace:stats',
  boardList: 'board:list',
  boardCreate: 'board:create',
  boardCreateFromTemplate: 'board:create-from-template',
  boardImport: 'board:import',
  boardOpen: 'board:open',
  boardSave: 'board:save',
  boardFavorite: 'board:favorite',
  boardTrash: 'board:trash',
  boardRestore: 'board:restore',
  boardDelete: 'board:delete',
  mediaImport: 'media:import',
  mediaImportImageData: 'media:import-image-data',
  mediaExists: 'media:exists',
  mediaOpen: 'media:open',
  mediaReveal: 'media:reveal',
  exportJson: 'export:json',
  exportCanvas: 'export:canvas',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsOpenData: 'settings:open-data',
  settingsOpenBackups: 'settings:open-backups'
} as const

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
}

export interface CanvasNoteApi {
  app: {
    getInfo: () => Promise<AppInfo>
    openExternal: (url: string) => Promise<void>
    onCloseRequested: (callback: () => void) => () => void
    readyToClose: () => void
  }
  workspace: {
    create: (name: string) => Promise<WorkspaceSummary | null>
    open: () => Promise<WorkspaceSummary | null>
    openRecent: (workspaceId: string) => Promise<WorkspaceSummary>
    recent: () => Promise<WorkspaceSummary[]>
    stats: () => Promise<WorkspaceStats>
    close: () => Promise<void>
  }
  boards: {
    list: (request: BoardListRequest) => Promise<BoardSummary[]>
    create: (title: string) => Promise<OpenBoard>
    createFromTemplate: (templateId: TemplateId) => Promise<OpenBoard>
    importFile: () => Promise<OpenBoard | null>
    open: (boardId: string) => Promise<OpenBoard>
    save: (board: BoardFile, expectedRevision: string) => Promise<OpenBoard>
    favorite: (boardId: string, favorite: boolean) => Promise<void>
    trash: (boardId: string) => Promise<void>
    restore: (boardId: string) => Promise<void>
    deletePermanently: (boardId: string) => Promise<void>
  }
  media: {
    importFile: (kind: MediaKind) => Promise<ImportedMedia | null>
    importImageData: (filename: string, data: Uint8Array) => Promise<ImportedMedia>
    toUrl: (relativePath: string) => string
    exists: (relativePath: string) => Promise<boolean>
    open: (relativePath: string) => Promise<void>
    reveal: (relativePath: string) => Promise<void>
  }
  export: {
    json: (board: BoardFile) => Promise<boolean>
    canvas: (request: ExportCanvasRequest) => Promise<boolean>
  }
  settings: {
    get: () => Promise<SettingsSnapshot>
    update: (settings: AppSettings) => Promise<SettingsSnapshot>
    openDataLocation: () => Promise<void>
    openBackups: () => Promise<void>
  }
}
