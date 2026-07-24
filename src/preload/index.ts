import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS, type AppInfo, type CanvasNoteApi } from '../shared/ipc'
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
    recent: () => ipcRenderer.invoke(IPC_CHANNELS.workspaceRecent) as Promise<WorkspaceSummary[]>
  }
}

contextBridge.exposeInMainWorld('canvasNote', Object.freeze(api))
