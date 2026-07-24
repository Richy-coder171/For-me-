import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { BrowserWindow, dialog } from 'electron'
import Store from 'electron-store'

import {
  WORKSPACE_FORMAT,
  WORKSPACE_VERSION,
  type WorkspaceManifest,
  type WorkspaceSummary,
  workspaceManifestSchema
} from '../../shared/schemas/workspace'

const WORKSPACE_DIRECTORIES = [
  'boards',
  'media/images',
  'media/videos',
  'media/audio',
  'media/files',
  'thumbnails',
  'exports',
  'backups'
] as const

interface StoredWorkspace extends WorkspaceSummary {
  path: string
}

interface PreferenceSchema {
  recentWorkspaces: StoredWorkspace[]
}

const preferences = new Store<PreferenceSchema>({
  name: 'preferences',
  defaults: { recentWorkspaces: [] }
})

function workspaceFolderName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  if (!cleaned || reserved.test(cleaned)) return 'CanvasNote Workspace'
  return cleaned.slice(0, 120)
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  try {
    const handle = await open(temporaryPath, 'wx')
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporaryPath, filePath)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

async function readManifest(root: string): Promise<WorkspaceManifest> {
  try {
    const manifestPath = path.join(root, 'workspace.json')
    const details = await stat(manifestPath)
    if (!details.isFile() || details.size > 1_000_000) throw new Error('Invalid manifest')
    return workspaceManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')))
  } catch (error) {
    throw new Error('This folder does not contain a valid CanvasNote workspace.', { cause: error })
  }
}

export class WorkspaceService {
  #activeRoot: string | null = null

  get activeRoot(): string | null {
    return this.#activeRoot
  }

  recent(): WorkspaceSummary[] {
    return preferences.get('recentWorkspaces').map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      displayPath: workspace.displayPath,
      lastOpenedAt: workspace.lastOpenedAt
    }))
  }

  async create(window: BrowserWindow, name: string): Promise<WorkspaceSummary | null> {
    const selection = await dialog.showOpenDialog(window, {
      title: 'Choose where to create your CanvasNote workspace',
      buttonLabel: 'Create here',
      properties: ['openDirectory', 'createDirectory']
    })
    if (selection.canceled || !selection.filePaths[0]) return null

    const root = path.join(selection.filePaths[0], workspaceFolderName(name))
    let createdRoot = false
    try {
      try {
        await mkdir(root)
        createdRoot = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        const entries = await readdir(root)
        if (entries.length > 0) {
          throw new Error('A non-empty folder with this workspace name already exists.', {
            cause: error
          })
        }
      }

      await Promise.all(
        WORKSPACE_DIRECTORIES.map((directory) =>
          mkdir(path.join(root, directory), { recursive: true })
        )
      )
      const timestamp = new Date().toISOString()
      const manifest = workspaceManifestSchema.parse({
        format: WORKSPACE_FORMAT,
        version: WORKSPACE_VERSION,
        id: `workspace-${randomUUID()}`,
        name,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      await writeJsonAtomically(path.join(root, 'workspace.json'), manifest)
      return this.#activate(root, manifest)
    } catch (error) {
      if (createdRoot) await rm(root, { recursive: true, force: true })
      throw error
    }
  }

  async open(window: BrowserWindow): Promise<WorkspaceSummary | null> {
    const selection = await dialog.showOpenDialog(window, {
      title: 'Open a CanvasNote workspace',
      buttonLabel: 'Open workspace',
      properties: ['openDirectory']
    })
    if (selection.canceled || !selection.filePaths[0]) return null
    const root = selection.filePaths[0]
    return this.#activate(root, await readManifest(root))
  }

  async openRecent(workspaceId: string): Promise<WorkspaceSummary> {
    const stored = preferences
      .get('recentWorkspaces')
      .find((workspace) => workspace.id === workspaceId)
    if (!stored) throw new Error('This workspace is no longer in your recent list.')
    return this.#activate(stored.path, await readManifest(stored.path))
  }

  #activate(root: string, manifest: WorkspaceManifest): WorkspaceSummary {
    this.#activeRoot = path.resolve(root)
    const summary: WorkspaceSummary = {
      id: manifest.id,
      name: manifest.name,
      displayPath: this.#activeRoot,
      lastOpenedAt: new Date().toISOString()
    }
    const recent = preferences
      .get('recentWorkspaces')
      .filter((workspace) => workspace.id !== summary.id)
    preferences.set(
      'recentWorkspaces',
      [{ ...summary, path: this.#activeRoot }, ...recent].slice(0, 8)
    )
    return summary
  }
}
