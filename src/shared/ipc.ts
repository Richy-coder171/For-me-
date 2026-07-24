import type { WorkspaceSummary } from './schemas/workspace'

export const IPC_CHANNELS = {
  appInfo: 'app:info',
  workspaceCreate: 'workspace:create',
  workspaceOpen: 'workspace:open',
  workspaceOpenRecent: 'workspace:open-recent',
  workspaceRecent: 'workspace:recent'
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
  }
}
