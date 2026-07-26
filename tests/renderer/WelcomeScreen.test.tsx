import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { WelcomeScreen } from '../../src/renderer/components/WelcomeScreen'
import { useAppStore } from '../../src/renderer/stores/appStore'
import type { WorkspaceSummary } from '../../src/shared/schemas/workspace'

const workspace: WorkspaceSummary = {
  id: 'workspace-research',
  name: 'Research notes',
  displayPath: 'D:\\CanvasNote\\Research',
  lastOpenedAt: '2026-07-25T08:30:00.000Z'
}

function resetStore(): void {
  useAppStore.setState({
    initialized: true,
    appInfo: { version: '0.2.0', platform: 'win32' },
    currentWorkspace: null,
    currentBoard: null,
    recentWorkspaces: [],
    boards: [],
    workspaceStats: null,
    settingsSnapshot: null,
    operation: 'idle',
    error: null
  })
}

beforeEach(resetStore)

afterEach(() => {
  cleanup()
  resetStore()
  vi.restoreAllMocks()
})

describe('WelcomeScreen', () => {
  it('offers every launcher decision and opens recent workspace metadata', () => {
    const createWorkspace = vi.fn(async () => undefined)
    const openWorkspace = vi.fn(async () => undefined)
    const openRecentWorkspace = vi.fn(async () => undefined)
    const onImportBoard = vi.fn()
    const onOpenSettings = vi.fn()
    const onToggleTheme = vi.fn()
    useAppStore.setState({
      recentWorkspaces: [workspace],
      createWorkspace,
      openWorkspace,
      openRecentWorkspace
    })

    render(
      <WelcomeScreen
        dark={false}
        onToggleTheme={onToggleTheme}
        onImportBoard={onImportBoard}
        onOpenSettings={onOpenSettings}
      />
    )

    expect(screen.getByRole('heading', { name: 'Start in CanvasNote' })).toBeVisible()
    expect(screen.getByText('CanvasNote 0.2.0')).toBeVisible()
    expect(screen.getByTitle(workspace.displayPath)).toHaveTextContent(workspace.displayPath)
    expect(screen.getByText(/^Last opened /)).toBeVisible()

    fireEvent.change(screen.getByLabelText('New workspace name'), {
      target: { value: 'Interview synthesis' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Import a .canvasnote board' }))
    fireEvent.click(screen.getByRole('button', { name: `Open ${workspace.name}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use dark appearance' }))

    expect(createWorkspace).toHaveBeenCalledWith('Interview synthesis')
    expect(openWorkspace).toHaveBeenCalledOnce()
    expect(onImportBoard).toHaveBeenCalledOnce()
    expect(openRecentWorkspace).toHaveBeenCalledWith(workspace.id)
    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(onToggleTheme).toHaveBeenCalledOnce()
  })

  it('shows the recent-workspace empty state', () => {
    render(
      <WelcomeScreen
        dark={false}
        onToggleTheme={vi.fn()}
        onImportBoard={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'No recent workspaces' })).toBeVisible()
  })

  it('disables workspace decisions while an operation is in progress', () => {
    useAppStore.setState({ operation: 'opening-workspace', recentWorkspaces: [workspace] })
    render(
      <WelcomeScreen
        dark
        onToggleTheme={vi.fn()}
        onImportBoard={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    )

    expect(screen.getByLabelText('New workspace name')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open workspace' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Import a .canvasnote board' })).toBeDisabled()
    expect(screen.getByRole('button', { name: `Open ${workspace.name}` })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Use light appearance' })).toBeEnabled()
  })
})
