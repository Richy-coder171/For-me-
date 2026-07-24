import { app, BrowserWindow, ipcMain } from 'electron'

import { IPC_CHANNELS } from '../../shared/ipc'
import { createWorkspaceRequestSchema } from '../../shared/schemas/workspace'
import { stableIdSchema } from '../../shared/schemas/common'
import type { WorkspaceService } from '../services/workspaceService'

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('The application window is unavailable.')
  return window
}

export function registerHandlers(workspaces: WorkspaceService): () => void {
  ipcMain.handle(IPC_CHANNELS.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform
  }))

  ipcMain.handle(IPC_CHANNELS.workspaceRecent, () => workspaces.recent())
  ipcMain.handle(IPC_CHANNELS.workspaceCreate, (event, input: unknown) => {
    const request = createWorkspaceRequestSchema.parse(input)
    return workspaces.create(senderWindow(event), request.name)
  })
  ipcMain.handle(IPC_CHANNELS.workspaceOpen, (event) => workspaces.open(senderWindow(event)))
  ipcMain.handle(IPC_CHANNELS.workspaceOpenRecent, (_event, workspaceId: unknown) =>
    workspaces.openRecent(stableIdSchema.parse(workspaceId))
  )

  return () => {
    Object.values(IPC_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel))
  }
}
