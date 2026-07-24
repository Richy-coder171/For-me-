import { create } from 'zustand'

import type { AppInfo } from '../../shared/ipc'
import type { WorkspaceSummary } from '../../shared/schemas/workspace'

type Operation = 'idle' | 'loading' | 'creating' | 'opening'

interface AppState {
  appInfo: AppInfo | null
  currentWorkspace: WorkspaceSummary | null
  recentWorkspaces: WorkspaceSummary[]
  operation: Operation
  error: string | null
  initialize: () => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  openWorkspace: () => Promise<void>
  openRecentWorkspace: (workspaceId: string) => Promise<void>
  closeWorkspace: () => void
  clearError: () => void
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.'
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export const useAppStore = create<AppState>((set, get) => ({
  appInfo: null,
  currentWorkspace: null,
  recentWorkspaces: [],
  operation: 'idle',
  error: null,

  initialize: async () => {
    set({ operation: 'loading', error: null })
    try {
      const [appInfo, recentWorkspaces] = await Promise.all([
        window.canvasNote.app.getInfo(),
        window.canvasNote.workspace.recent()
      ])
      set({ appInfo, recentWorkspaces, operation: 'idle' })
    } catch (error) {
      set({ error: readableError(error), operation: 'idle' })
    }
  },

  createWorkspace: async (name) => {
    set({ operation: 'creating', error: null })
    try {
      const currentWorkspace = await window.canvasNote.workspace.create(name)
      set({ currentWorkspace, operation: 'idle' })
      if (currentWorkspace) await get().initialize()
      if (currentWorkspace) set({ currentWorkspace })
    } catch (error) {
      set({ error: readableError(error), operation: 'idle' })
    }
  },

  openWorkspace: async () => {
    set({ operation: 'opening', error: null })
    try {
      const currentWorkspace = await window.canvasNote.workspace.open()
      set({ currentWorkspace, operation: 'idle' })
      if (currentWorkspace) await get().initialize()
      if (currentWorkspace) set({ currentWorkspace })
    } catch (error) {
      set({ error: readableError(error), operation: 'idle' })
    }
  },

  openRecentWorkspace: async (workspaceId) => {
    set({ operation: 'opening', error: null })
    try {
      const currentWorkspace = await window.canvasNote.workspace.openRecent(workspaceId)
      set({ currentWorkspace, operation: 'idle' })
      await get().initialize()
      set({ currentWorkspace })
    } catch (error) {
      set({ error: readableError(error), operation: 'idle' })
    }
  },

  closeWorkspace: () => set({ currentWorkspace: null, error: null }),
  clearError: () => set({ error: null })
}))
