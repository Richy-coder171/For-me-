import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '../../src/renderer/stores/appStore'
import type { CanvasNoteApi } from '../../src/shared/ipc'
import { DEFAULT_APP_SETTINGS, type SettingsSnapshot } from '../../src/shared/schemas/settings'
import type { WorkspaceSummary } from '../../src/shared/schemas/workspace'

const workspace: WorkspaceSummary = {
  id: 'workspace-local',
  name: 'Local boards',
  displayPath: 'D:\\Boards',
  lastOpenedAt: '2026-07-25T08:30:00.000Z'
}

const settingsSnapshot: SettingsSnapshot = {
  values: DEFAULT_APP_SETTINGS,
  appDataPath: 'C:\\CanvasNote\\data',
  workspacePath: null
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function installApi(
  overrides: {
    getInfo?: CanvasNoteApi['app']['getInfo']
    recent?: CanvasNoteApi['workspace']['recent']
    openRecent?: CanvasNoteApi['workspace']['openRecent']
    stats?: CanvasNoteApi['workspace']['stats']
    list?: CanvasNoteApi['boards']['list']
    getSettings?: CanvasNoteApi['settings']['get']
  } = {}
): CanvasNoteApi {
  const unused = async (): Promise<never> => {
    throw new Error('Unexpected CanvasNote API call in test.')
  }
  const api: CanvasNoteApi = {
    app: {
      getInfo:
        overrides.getInfo ??
        vi.fn(async () => ({ version: '0.1.0', platform: 'win32' as NodeJS.Platform })),
      openExternal: vi.fn(async () => undefined),
      onCloseRequested: vi.fn(() => vi.fn()),
      readyToClose: vi.fn()
    },
    workspace: {
      create: unused,
      open: unused,
      openRecent: overrides.openRecent ?? vi.fn(async () => workspace),
      recent: overrides.recent ?? vi.fn(async () => []),
      stats:
        overrides.stats ?? vi.fn(async () => ({ storageBytes: 0, boardCount: 0, trashCount: 0 })),
      close: vi.fn(async () => undefined)
    },
    boards: {
      list: overrides.list ?? vi.fn(async () => []),
      create: unused,
      createFromTemplate: unused,
      importFile: unused,
      open: unused,
      save: unused,
      favorite: vi.fn(async () => undefined),
      trash: vi.fn(async () => undefined),
      restore: vi.fn(async () => undefined),
      deletePermanently: vi.fn(async () => undefined)
    },
    media: {
      importFile: unused,
      importImageData: unused,
      toUrl: vi.fn((path) => `canvasnote-media://${path}`),
      exists: vi.fn(async () => true),
      open: vi.fn(async () => undefined),
      reveal: vi.fn(async () => undefined)
    },
    export: {
      json: unused,
      canvas: unused
    },
    settings: {
      get: overrides.getSettings ?? vi.fn(async () => settingsSnapshot),
      update: vi.fn(async (values) => ({ ...settingsSnapshot, values })),
      openDataLocation: vi.fn(async () => undefined),
      openBackups: vi.fn(async () => undefined)
    }
  }
  Object.defineProperty(window, 'canvasNote', { configurable: true, value: api })
  return api
}

function resetStore(): void {
  useAppStore.setState({
    initialized: false,
    appInfo: null,
    currentWorkspace: null,
    currentBoard: null,
    recentWorkspaces: [],
    boards: [],
    workspaceStats: null,
    settingsSnapshot: null,
    boardSection: 'recent',
    boardView: 'grid',
    boardQuery: '',
    operation: 'idle',
    error: null
  })
}

beforeEach(resetStore)

afterEach(() => {
  resetStore()
  vi.restoreAllMocks()
})

describe('appStore initialization', () => {
  it('deduplicates initialization and becomes ready after startup data resolves', async () => {
    const info = deferred<{ version: string; platform: NodeJS.Platform }>()
    const api = installApi({ getInfo: vi.fn(() => info.promise) })

    const first = useAppStore.getState().initialize()
    const duplicate = useAppStore.getState().initialize()

    expect(useAppStore.getState()).toMatchObject({ initialized: false, operation: 'loading' })
    expect(api.app.getInfo).toHaveBeenCalledOnce()
    expect(api.workspace.recent).toHaveBeenCalledOnce()
    expect(api.settings.get).toHaveBeenCalledOnce()

    info.resolve({ version: '0.2.0', platform: 'win32' })
    await Promise.all([first, duplicate])

    expect(useAppStore.getState()).toMatchObject({
      initialized: true,
      operation: 'idle',
      appInfo: { version: '0.2.0', platform: 'win32' },
      recentWorkspaces: [],
      settingsSnapshot
    })
  })

  it('does not report readiness until the default workspace dashboard is loaded', async () => {
    const stats = deferred<{ storageBytes: number; boardCount: number; trashCount: number }>()
    const defaultSettings: SettingsSnapshot = {
      ...settingsSnapshot,
      values: { ...DEFAULT_APP_SETTINGS, defaultWorkspaceId: workspace.id }
    }
    const api = installApi({
      recent: vi.fn(async () => [workspace]),
      getSettings: vi.fn(async () => defaultSettings),
      stats: vi.fn(() => stats.promise)
    })

    const initialization = useAppStore.getState().initialize()
    await waitFor(() => expect(api.workspace.openRecent).toHaveBeenCalledWith(workspace.id))
    expect(useAppStore.getState()).toMatchObject({
      initialized: false,
      operation: 'loading-boards',
      currentWorkspace: workspace
    })

    stats.resolve({ storageBytes: 12, boardCount: 0, trashCount: 0 })
    await initialization

    expect(useAppStore.getState()).toMatchObject({
      initialized: true,
      operation: 'idle',
      currentWorkspace: workspace,
      workspaceStats: { storageBytes: 12, boardCount: 0, trashCount: 0 }
    })
    expect(api.boards.list).toHaveBeenCalledTimes(2)
  })

  it('becomes ready with a readable error when startup fails and can be retried', async () => {
    const getInfo = vi
      .fn<CanvasNoteApi['app']['getInfo']>()
      .mockRejectedValueOnce(
        new Error("Error invoking remote method 'app:info': Error: Startup unavailable.")
      )
      .mockResolvedValue({ version: '0.1.0', platform: 'win32' })
    installApi({ getInfo })

    await useAppStore.getState().initialize()
    expect(useAppStore.getState()).toMatchObject({
      initialized: true,
      operation: 'idle',
      error: 'Startup unavailable.'
    })

    await useAppStore.getState().initialize()
    expect(getInfo).toHaveBeenCalledTimes(2)
    expect(useAppStore.getState()).toMatchObject({
      initialized: true,
      operation: 'idle',
      error: null,
      appInfo: { version: '0.1.0', platform: 'win32' }
    })
  })
})
