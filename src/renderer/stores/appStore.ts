import { create } from 'zustand'

import type { AppInfo } from '../../shared/ipc'
import type { BoardFile, BoardSummary, OpenBoard, WorkspaceStats } from '../../shared/schemas/board'
import type { WorkspaceSummary } from '../../shared/schemas/workspace'

type Operation =
  | 'idle'
  | 'loading'
  | 'creating-workspace'
  | 'opening-workspace'
  | 'loading-boards'
  | 'creating-board'
  | 'opening-board'
  | 'saving-board'

export type BoardSection = 'recent' | 'all' | 'favorites' | 'trash'
export type BoardView = 'grid' | 'list'

interface AppState {
  appInfo: AppInfo | null
  currentWorkspace: WorkspaceSummary | null
  currentBoard: OpenBoard | null
  recentWorkspaces: WorkspaceSummary[]
  boards: BoardSummary[]
  workspaceStats: WorkspaceStats | null
  boardSection: BoardSection
  boardView: BoardView
  boardQuery: string
  operation: Operation
  error: string | null
  initialize: () => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  openWorkspace: () => Promise<void>
  openRecentWorkspace: (workspaceId: string) => Promise<void>
  closeWorkspace: () => Promise<void>
  refreshDashboard: () => Promise<void>
  setBoardSection: (section: BoardSection) => void
  setBoardView: (view: BoardView) => void
  setBoardQuery: (query: string) => void
  createBoard: (title: string) => Promise<void>
  openBoard: (boardId: string) => Promise<void>
  closeBoard: () => Promise<void>
  saveBoardTitle: (title: string) => Promise<void>
  toggleFavorite: (boardId: string, favorite: boolean) => Promise<void>
  trashBoard: (boardId: string) => Promise<void>
  restoreBoard: (boardId: string) => Promise<void>
  deleteBoard: (boardId: string) => Promise<void>
  clearError: () => void
}

function readableError(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.'
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

export const useAppStore = create<AppState>((set, get) => {
  const activateWorkspace = async (workspace: WorkspaceSummary | null): Promise<void> => {
    if (!workspace) {
      set({ operation: 'idle' })
      return
    }
    set({ currentWorkspace: workspace, currentBoard: null })
    await get().refreshDashboard()
  }

  const fail = (error: unknown): Error => {
    const normalized = error instanceof Error ? error : new Error(readableError(error))
    set({ error: readableError(error), operation: 'idle' })
    return normalized
  }

  return {
    appInfo: null,
    currentWorkspace: null,
    currentBoard: null,
    recentWorkspaces: [],
    boards: [],
    workspaceStats: null,
    boardSection: 'recent',
    boardView: 'grid',
    boardQuery: '',
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
        fail(error)
      }
    },

    createWorkspace: async (name) => {
      set({ operation: 'creating-workspace', error: null })
      try {
        await activateWorkspace(await window.canvasNote.workspace.create(name))
      } catch (error) {
        fail(error)
      }
    },

    openWorkspace: async () => {
      set({ operation: 'opening-workspace', error: null })
      try {
        await activateWorkspace(await window.canvasNote.workspace.open())
      } catch (error) {
        fail(error)
      }
    },

    openRecentWorkspace: async (workspaceId) => {
      set({ operation: 'opening-workspace', error: null })
      try {
        await activateWorkspace(await window.canvasNote.workspace.openRecent(workspaceId))
      } catch (error) {
        fail(error)
      }
    },

    closeWorkspace: async () => {
      try {
        await window.canvasNote.workspace.close()
      } finally {
        set({
          currentWorkspace: null,
          currentBoard: null,
          boards: [],
          workspaceStats: null,
          boardQuery: '',
          boardSection: 'recent',
          error: null,
          operation: 'idle'
        })
        void get().initialize()
      }
    },

    refreshDashboard: async () => {
      if (!get().currentWorkspace) return
      set({ operation: 'loading-boards', error: null })
      try {
        const [activeBoards, trashedBoards, workspaceStats] = await Promise.all([
          window.canvasNote.boards.list({ view: 'all', query: '' }),
          window.canvasNote.boards.list({ view: 'trash', query: '' }),
          window.canvasNote.workspace.stats()
        ])
        set({ boards: [...activeBoards, ...trashedBoards], workspaceStats, operation: 'idle' })
      } catch (error) {
        throw fail(error)
      }
    },

    setBoardSection: (boardSection) => set({ boardSection }),
    setBoardView: (boardView) => set({ boardView }),
    setBoardQuery: (boardQuery) => set({ boardQuery }),

    createBoard: async (title) => {
      set({ operation: 'creating-board', error: null })
      try {
        const currentBoard = await window.canvasNote.boards.create(title)
        set({ currentBoard, operation: 'idle' })
      } catch (error) {
        throw fail(error)
      }
    },

    openBoard: async (boardId) => {
      set({ operation: 'opening-board', error: null })
      try {
        const currentBoard = await window.canvasNote.boards.open(boardId)
        set({ currentBoard, operation: 'idle' })
      } catch (error) {
        throw fail(error)
      }
    },

    closeBoard: async () => {
      set({ currentBoard: null })
      await get().refreshDashboard()
    },

    saveBoardTitle: async (title) => {
      const current = get().currentBoard
      if (!current) return
      set({ operation: 'saving-board', error: null })
      try {
        const board: BoardFile = { ...current.board, title: title.trim() }
        const currentBoard = await window.canvasNote.boards.save(board, current.revision)
        set({ currentBoard, operation: 'idle' })
      } catch (error) {
        throw fail(error)
      }
    },

    toggleFavorite: async (boardId, favorite) => {
      try {
        await window.canvasNote.boards.favorite(boardId, favorite)
        await get().refreshDashboard()
      } catch (error) {
        throw fail(error)
      }
    },

    trashBoard: async (boardId) => {
      try {
        await window.canvasNote.boards.trash(boardId)
        await get().refreshDashboard()
      } catch (error) {
        throw fail(error)
      }
    },

    restoreBoard: async (boardId) => {
      try {
        await window.canvasNote.boards.restore(boardId)
        await get().refreshDashboard()
      } catch (error) {
        throw fail(error)
      }
    },

    deleteBoard: async (boardId) => {
      try {
        await window.canvasNote.boards.deletePermanently(boardId)
        await get().refreshDashboard()
      } catch (error) {
        throw fail(error)
      }
    },

    clearError: () => set({ error: null })
  }
})
