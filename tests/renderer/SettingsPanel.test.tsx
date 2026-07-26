import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsPanel } from '../../src/renderer/components/SettingsPanel'
import { DEFAULT_APP_SETTINGS } from '../../src/shared/schemas/settings'

afterEach(cleanup)

const recentWorkspaces = [
  {
    id: 'workspace-local',
    name: 'Local boards',
    displayPath: 'D:\\Boards',
    lastOpenedAt: '2026-07-25T08:30:00.000Z'
  }
]

function renderSettings(workspacePath: string | null = 'D:\\Boards') {
  const callbacks = {
    onChange: vi.fn(async () => undefined),
    onOpenDataLocation: vi.fn(async () => undefined),
    onOpenBackups: vi.fn(async () => undefined),
    onClose: vi.fn()
  }

  render(
    <SettingsPanel
      snapshot={{
        values: DEFAULT_APP_SETTINGS,
        appDataPath: 'C:\\CanvasNote\\data',
        workspacePath
      }}
      recentWorkspaces={recentWorkspaces}
      version="0.2.0"
      platform="Windows"
      {...callbacks}
    />
  )

  return callbacks
}

describe('SettingsPanel', () => {
  it('navigates sections, updates settings, and resets appearance', async () => {
    const { onChange } = renderSettings()

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Appearance' })).toHaveAttribute(
      'aria-current',
      'page'
    )

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_APP_SETTINGS, theme: 'dark' })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset appearance settings' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(DEFAULT_APP_SETTINGS))

    fireEvent.click(screen.getByRole('button', { name: 'Canvas & autosave' }))
    expect(screen.getByRole('option', { name: 'Local boards' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Autosave interval'), { target: { value: '3000' } })
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        ...DEFAULT_APP_SETTINGS,
        autosaveDelayMs: 3000
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'About' }))
    expect(screen.getByText('CanvasNote 0.2.0')).toBeVisible()
    expect(screen.getByText('Local-first visual notebook for Windows.')).toBeVisible()
  })

  it('opens available data folders from diagnostics', async () => {
    const { onOpenDataLocation, onOpenBackups } = renderSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }))
    expect(screen.getByText('App data: C:\\CanvasNote\\data')).toBeVisible()
    expect(screen.getByText('Workspace: D:\\Boards')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Open app data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open workspace backups' }))
    await waitFor(() => expect(onOpenDataLocation).toHaveBeenCalledOnce())
    await waitFor(() => expect(onOpenBackups).toHaveBeenCalledOnce())
  })

  it('disables workspace folder actions without an open workspace', () => {
    renderSettings(null)

    fireEvent.click(screen.getByRole('button', { name: 'Media & backups' }))
    expect(screen.getByRole('button', { name: 'Open workspace backups' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }))
    expect(screen.getByText('Workspace: No workspace open')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open app data' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Open workspace backups' })).toBeDisabled()
  })
})
