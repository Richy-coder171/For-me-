import { z } from 'zod'

import { stableIdSchema } from './common'

export const appSettingsSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']),
    accent: z.enum(['indigo', 'violet', 'teal', 'amber']),
    defaultWorkspaceId: stableIdSchema.nullable(),
    autosaveDelayMs: z.number().int().min(250).max(10_000),
    mediaImportMode: z.literal('copy'),
    backupLimit: z.number().int().min(1).max(10),
    defaultPlaybackRate: z.number().min(0.5).max(2)
  })
  .strict()

export type AppSettings = z.infer<typeof appSettingsSchema>

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  accent: 'indigo',
  defaultWorkspaceId: null,
  autosaveDelayMs: 750,
  mediaImportMode: 'copy',
  backupLimit: 5,
  defaultPlaybackRate: 1
}

export interface SettingsSnapshot {
  values: AppSettings
  appDataPath: string
  workspacePath: string | null
}
