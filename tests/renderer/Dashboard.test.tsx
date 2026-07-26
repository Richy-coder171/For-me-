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
    expect(screen.getByRole('group', { name: 'Board view' })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Research map' }))
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Actions for Research map' })).getByRole('menuitem', {
        name: 'Add to favourites'
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Product roadmap' }))
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Actions for Product roadmap' })).getByRole(
        'menuitem',
        { name: 'Remove from favourites' }
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Research map' }))
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Actions for Research map' })).getByRole('menuitem', {
        name: 'Move to Trash'
      })
    )

    expect(onToggleFavorite).toHaveBeenNthCalledWith(1, 'board-research', true)
    expect(onToggleFavorite).toHaveBeenNthCalledWith(2, 'board-roadmap', false)
    expect(onTrashBoard).toHaveBeenCalledWith('board-research')
  })

  it('reports restore and confirmed permanent-delete actions from trash', () => {
    const onRestoreBoard = vi.fn()
    const onDeleteBoard = vi.fn()
    render(<Dashboard {...dashboardProps({ section: 'trash', onRestoreBoard, onDeleteBoard })} />)

    const trigger = screen.getByRole('button', { name: 'Actions for Archived notes' })
    fireEvent.click(trigger)
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Actions for Archived notes' })).getByRole(
        'menuitem',
        { name: 'Restore' }
      )
    )

    expect(onRestoreBoard).toHaveBeenCalledWith('board-archive')

    fireEvent.click(trigger)
    fireEvent.click(
      within(screen.getByRole('menu', { name: 'Actions for Archived notes' })).getByRole(
        'menuitem',
        { name: 'Delete permanently' }
      )
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete board permanently?' })
    expect(within(dialog).getByText(/Archived notes/)).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }))
    expect(onDeleteBoard).toHaveBeenCalledWith('board-archive')
  })

  it('supports keyboard navigation and dismissal in board action menus', () => {
    render(<Dashboard {...dashboardProps()} />)

    const trigger = screen.getByRole('button', { name: 'Actions for Research map' })
    fireEvent.click(trigger)
    const menu = screen.getByRole('menu', { name: 'Actions for Research map' })
    const addFavourite = within(menu).getByRole('menuitem', { name: 'Add to favourites' })
    const moveToTrash = within(menu).getByRole('menuitem', { name: 'Move to Trash' })

    expect(addFavourite).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'End' })
    expect(moveToTrash).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(addFavourite).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(moveToTrash).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(addFavourite).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Actions for Research map' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu', { name: 'Actions for Research map' })).not.toBeInTheDocument()
  })

  it('shows an accessible loading skeleton instead of stale board actions', () => {
    render(<Dashboard {...dashboardProps({ loading: true })} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading boards…')
    const region = screen.getByRole('region', { name: 'Board list' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('.animate-pulse')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'Open Research map' })).not.toBeInTheDocument()
  })

  it('creates boards from each editable template', () => {
    const onCreateTemplate = vi.fn()
    render(<Dashboard {...dashboardProps({ section: 'templates', onCreateTemplate })} />)

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
