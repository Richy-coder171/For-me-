import { describe, expect, it } from 'vitest'

import { appSettingsSchema, DEFAULT_APP_SETTINGS } from '../../src/shared/schemas/settings'

describe('appSettingsSchema', () => {
  it('accepts the local-first defaults', () => {
    expect(appSettingsSchema.parse(DEFAULT_APP_SETTINGS)).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('rejects unsupported or unsafe settings', () => {
    expect(() =>
      appSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, autosaveDelayMs: 100 })
    ).toThrow()
    expect(() =>
      appSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, mediaImportMode: 'link' })
    ).toThrow()
    expect(() => appSettingsSchema.parse({ ...DEFAULT_APP_SETTINGS, unexpected: true })).toThrow()
  })
})
