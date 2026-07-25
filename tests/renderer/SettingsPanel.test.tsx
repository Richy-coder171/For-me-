import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsPanel } from '../../src/renderer/components/SettingsPanel'
import { DEFAULT_APP_SETTINGS } from '../../src/shared/schemas/settings'

afterEach(cleanup)

describe('SettingsPanel', () => {
  it('updates settings and exposes local data locations', async () => {
    const onChange = vi.fn(async () => undefined)
    const onOpenDataLocation = vi.fn(async () => undefined)
    const onOpenBackups = vi.fn(async () => undefined)

    render(
      <SettingsPanel
        snapshot={{
          values: DEFAULT_APP_SETTINGS,
          appDataPath: 'C:\\CanvasNote\\data',
          workspacePath: 'D:\\Boards'
        }}
        recentWorkspaces={[
          {
            id: 'workspace-local',
            name: 'Local boards',
            displayPath: 'D:\\Boards',
            lastOpenedAt: '2026-07-25T08:30:00.000Z'
          }
        ]}
        onChange={onChange}
        onOpenDataLocation={onOpenDataLocation}
        onOpenBackups={onOpenBackups}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_APP_SETTINGS, theme: 'dark' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open app data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open workspace backups' }))
    await waitFor(() => expect(onOpenDataLocation).toHaveBeenCalledOnce())
    await waitFor(() => expect(onOpenBackups).toHaveBeenCalledOnce())
    expect(screen.getByText('App data: C:\\CanvasNote\\data')).toBeVisible()
  })

  it('disables the backup location without an open workspace', () => {
    render(
      <SettingsPanel
        snapshot={{
          values: DEFAULT_APP_SETTINGS,
          appDataPath: 'C:\\CanvasNote\\data',
          workspacePath: null
        }}
        recentWorkspaces={[]}
        onChange={vi.fn(async () => undefined)}
        onOpenDataLocation={vi.fn(async () => undefined)}
        onOpenBackups={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Open workspace backups' })).toBeDisabled()
  })
})
