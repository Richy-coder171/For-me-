import type {
  BoardFile,
  BoardListRequest,
  BoardSummary,
  OpenBoard,
  WorkspaceStats
} from './schemas/board'
import type { WorkspaceSummary } from './schemas/workspace'

export const IPC_CHANNELS = {
  appInfo: 'app:info',
  workspaceCreate: 'workspace:create',
  workspaceOpen: 'workspace:open',
  workspaceOpenRecent: 'workspace:open-recent',
  workspaceRecent: 'workspace:recent',
  workspaceClose: 'workspace:close',
  workspaceStats: 'workspace:stats',
  boardList: 'board:list',
  boardCreate: 'board:create',
  boardOpen: 'board:open',
  boardSave: 'board:save',
  boardFavorite: 'board:favorite',
  boardTrash: 'board:trash',
  boardRestore: 'board:restore',
  boardDelete: 'board:delete'
} as const

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
}

export interface CanvasNoteApi {
  app: {
    getInfo: () => Promise<AppInfo>
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
    open: (boardId: string) => Promise<OpenBoard>
    save: (board: BoardFile, expectedRevision?: string) => Promise<OpenBoard>
    favorite: (boardId: string, favorite: boolean) => Promise<void>
    trash: (boardId: string) => Promise<void>
    restore: (boardId: string) => Promise<void>
    deletePermanently: (boardId: string) => Promise<void>
  }
}
