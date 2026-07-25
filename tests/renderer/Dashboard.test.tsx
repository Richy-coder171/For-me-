import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  Dashboard,
  type DashboardBoardRow,
  type DashboardProps
} from '../../src/renderer/components/Dashboard'
import type { WorkspaceSummary } from '../../src/shared/schemas/workspace'

const workspace: WorkspaceSummary = {
  id: 'workspace-product',
  name: 'Product research',
  displayPath: 'D:\\Workspaces\\Product research',
  lastOpenedAt: '2026-07-25T08:30:00.000Z'
}

const boards: DashboardBoardRow[] = [
  {
    id: 'board-research',
    title: 'Research map',
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-24T15:00:00.000Z',
    openedAt: '2026-07-25T08:00:00.000Z',
    isFavorite: false,
    deletedAt: null,
    itemCount: 4,
    searchText: 'interview synthesis'
  },
  {
    id: 'board-roadmap',
    title: 'Product roadmap',
    createdAt: '2026-07-18T09:00:00.000Z',
    updatedAt: '2026-07-23T12:00:00.000Z',
    openedAt: '2026-07-23T12:00:00.000Z',
    isFavorite: true,
    deletedAt: null,
    itemCount: 1
  },
  {
    id: 'board-archive',
    title: 'Archived notes',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-21T10:00:00.000Z',
    openedAt: null,
    isFavorite: false,
    deletedAt: '2026-07-22T10:00:00.000Z',
    itemCount: 2
  }
]

afterEach(cleanup)

function dashboardProps(overrides: Partial<DashboardProps> = {}): DashboardProps {
  return {
    workspace,
    boards,
    section: 'all',
    view: 'grid',
    query: '',
    dark: false,
    storage: { usedBytes: 256 * 1024 ** 2, totalBytes: 1024 ** 3 },
    onSectionChange: vi.fn(),
    onViewChange: vi.fn(),
    onQueryChange: vi.fn(),
    onCreateBoard: vi.fn(),
    onCreateTemplate: vi.fn(),
    onImportBoard: vi.fn(),
    onOpenBoard: vi.fn(),
    onToggleFavorite: vi.fn(),
    onTrashBoard: vi.fn(),
    onRestoreBoard: vi.fn(),
    onDeleteBoard: vi.fn(),
    onCloseWorkspace: vi.fn(),
    onToggleTheme: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides
  }
}

describe('Dashboard', () => {
  it('renders accessible controls and reports search, view, and section changes', () => {
    const props = dashboardProps()
    const { rerender } = render(<Dashboard {...props} />)

    expect(screen.getByRole('heading', { name: 'All boards' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Research map' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Open Product roadmap' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Open Archived notes' })).not.toBeInTheDocument()

    const navigation = screen.getByRole('navigation', { name: 'Boards' })
    expect(within(navigation).getByRole('button', { name: /^All boards/ })).toHaveAttribute(
      'aria-current',
      'page'
    )
    fireEvent.click(within(navigation).getByRole('button', { name: /^Favourites/ }))
    fireEvent.click(within(navigation).getByRole('button', { name: /^Trash/ }))
    expect(props.onSectionChange).toHaveBeenNthCalledWith(1, 'favorites')
    expect(props.onSectionChange).toHaveBeenNthCalledWith(2, 'trash')

    const search = screen.getByRole('searchbox', { name: 'Search boards' })
    fireEvent.change(search, { target: { value: 'interview' } })
    fireEvent.click(screen.getByRole('button', { name: 'List view' }))
    expect(props.onQueryChange).toHaveBeenCalledWith('interview')
    expect(props.onViewChange).toHaveBeenCalledWith('list')
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('progressbar', { name: 'Workspace storage used' })).toHaveAttribute(
      'aria-valuenow',
      '25'
    )
    expect(screen.getByRole('button', { name: 'Use dark appearance' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Close workspace' })).toBeEnabled()

    rerender(<Dashboard {...props} query="interview" view="list" />)
    expect(screen.getByRole('button', { name: 'Open Research map' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Product roadmap' })).not.toBeInTheDocument()
    expect(screen.getByText(/1 board matching/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear board search' }))
    expect(props.onQueryChange).toHaveBeenLastCalledWith('')

    rerender(<Dashboard {...props} section="favorites" />)
    expect(screen.getByRole('heading', { name: 'Favourites' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Product roadmap' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Research map' })).not.toBeInTheDocument()

    rerender(<Dashboard {...props} section="trash" />)
    expect(screen.getByRole('heading', { name: 'Trash' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Archived notes' })).toBeDisabled()
  })

  it('creates a trimmed board title from the empty state', async () => {
    const onCreateBoard = vi.fn(async () => undefined)
    const props = dashboardProps({ boards: [], section: 'recent', onCreateBoard })
    render(<Dashboard {...props} />)

    expect(screen.getByRole('heading', { name: 'Create your first board' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create board' }))

    const title = screen.getByRole('textbox', { name: 'Create a board' })
    const submit = within(title.closest('form') as HTMLFormElement).getByRole('button', {
      name: 'Create board'
    })
    expect(submit).toBeDisabled()

    fireEvent.change(title, { target: { value: '  Customer journey  ' } })
    fireEvent.click(submit)

    await waitFor(() => expect(onCreateBoard).toHaveBeenCalledWith('Customer journey'))
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Create a board' })).not.toBeInTheDocument()
    )
  })

  it('reports favourite and trash actions for active boards', () => {
    const onToggleFavorite = vi.fn()
    const onTrashBoard = vi.fn()
    render(<Dashboard {...dashboardProps({ onToggleFavorite, onTrashBoard })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Research map to favourites' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Product roadmap from favourites' }))
    fireEvent.click(screen.getByRole('button', { name: 'Move Research map to trash' }))

    expect(onToggleFavorite).toHaveBeenNthCalledWith(1, 'board-research', true)
    expect(onToggleFavorite).toHaveBeenNthCalledWith(2, 'board-roadmap', false)
    expect(onTrashBoard).toHaveBeenCalledWith('board-research')
  })

  it('reports restore actions from trash', () => {
    const onRestoreBoard = vi.fn()
    render(<Dashboard {...dashboardProps({ section: 'trash', onRestoreBoard })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Restore Archived notes' }))

    expect(onRestoreBoard).toHaveBeenCalledWith('board-archive')
    expect(screen.getByRole('button', { name: 'Delete Archived notes permanently' })).toBeEnabled()
  })

  it('creates boards from each editable template', () => {
    const onCreateTemplate = vi.fn()
    render(
      <Dashboard
        {...dashboardProps({ section: 'templates', onCreateTemplate })}
      />
    )

    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument()
    for (const name of [
      'Video research',
      'Study board',
      'Moodboard',
      'Project planning',
      'Content planning',
      'Learning roadmap'
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeEnabled()
    }
    fireEvent.click(screen.getByRole('button', { name: /Video research/ }))
    expect(onCreateTemplate).toHaveBeenCalledWith('video-research')
  })
})
