import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { app, shell } from 'electron'
import Store from 'electron-store'

import {
  appSettingsSchema,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type SettingsSnapshot
} from '../../shared/schemas/settings'

export class SettingsService {
  readonly #store = new Store<AppSettings>({
    name: 'settings',
    defaults: DEFAULT_APP_SETTINGS
  })

  constructor(private readonly workspaceRoot: () => string | null) {}

  get(): AppSettings {
    const parsed = appSettingsSchema.safeParse(this.#store.store)
    if (parsed.success) return parsed.data
    this.#store.store = DEFAULT_APP_SETTINGS
    return { ...DEFAULT_APP_SETTINGS }
  }

  update(input: unknown): AppSettings {
    const settings = appSettingsSchema.parse(input)
    this.#store.store = settings
    return settings
  }

  snapshot(): SettingsSnapshot {
    return {
      values: this.get(),
      appDataPath: app.getPath('userData'),
      workspacePath: this.workspaceRoot()
    }
  }

  async openDataLocation(): Promise<void> {
    const result = await shell.openPath(app.getPath('userData'))
    if (result) throw new Error('CanvasNote could not open the application data folder.')
  }

  async openBackups(): Promise<void> {
    const root = this.workspaceRoot()
    if (!root) throw new Error('Open a workspace first.')
    const backups = path.join(root, 'backups')
    await mkdir(backups, { recursive: true })
    const result = await shell.openPath(backups)
    if (result) throw new Error('CanvasNote could not open the backup folder.')
  }
}
