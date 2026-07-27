import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  Clock3,
  Grid2X2,
  HardDrive,
  FileInput,
  LayoutGrid,
  LayoutTemplate,
  List,
  LoaderCircle,
  MoreHorizontal,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Star,
  Sun,
  Trash2,
  X
} from 'lucide-react'

import type { BoardSummary } from '../../shared/schemas/board'
import type { WorkspaceSummary } from '../../shared/schemas/workspace'
import { BOARD_TEMPLATES, type TemplateId } from '../../shared/templates'
import { BrandMark } from './BrandMark'
import { Button, Dialog, EmptyState, IconButton } from './ui'

export type DashboardSection = 'recent' | 'all' | 'favorites' | 'templates' | 'trash'
export type DashboardView = 'grid' | 'list'

export interface DashboardBoardRow extends BoardSummary {
  thumbnailUrl?: string | null
  searchText?: string
}

export interface DashboardStorageSummary {
  usedBytes: number
  totalBytes?: number
}

export interface DashboardProps {
  workspace: WorkspaceSummary
  boards: DashboardBoardRow[]
  section: DashboardSection
  view: DashboardView
  query: string
  dark: boolean
  storage?: DashboardStorageSummary
  creating?: boolean
  loading?: boolean
  onSectionChange: (section: DashboardSection) => void
  onViewChange: (view: DashboardView) => void
  onQueryChange: (query: string) => void
  onCreateBoard: (title: string) => void | Promise<void>
  onCreateTemplate: (templateId: TemplateId) => void | Promise<void>
  onImportBoard: () => void | Promise<void>
  onOpenBoard: (boardId: string) => void
  onToggleFavorite: (boardId: string, favorite: boolean) => void
  onTrashBoard: (boardId: string) => void
  onRestoreBoard: (boardId: string) => void
  onDeleteBoard: (boardId: string) => void
  onCloseWorkspace: () => void
  onToggleTheme: () => void
  onOpenSettings: () => void
}

const navItems: ReadonlyArray<{
  section: DashboardSection
  label: string
  icon: typeof Clock3
}> = [
  { section: 'recent', label: 'Recents', icon: Clock3 },
  { section: 'all', label: 'All boards', icon: LayoutGrid },
  { section: 'favorites', label: 'Favourites', icon: Star },
  { section: 'templates', label: 'Templates', icon: LayoutTemplate },
  { section: 'trash', label: 'Trash', icon: Trash2 }
]

const sectionCopy: Record<DashboardSection, { title: string; description: string }> = {
  recent: { title: 'Recent boards', description: 'Pick up where you left off.' },
  all: { title: 'All boards', description: 'Everything in this workspace.' },
  favorites: { title: 'Favourites', description: 'Boards you want close at hand.' },
  templates: { title: 'Templates', description: 'Start with useful editable objects.' },
  trash: { title: 'Trash', description: 'Restore boards you still need.' }
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : dateFormatter.format(date)
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unit
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

function includesSection(board: DashboardBoardRow, section: DashboardSection): boolean {
  if (section === 'templates') return false
  if (section === 'trash') return board.deletedAt !== null
  if (board.deletedAt !== null) return false
  if (section === 'favorites') return board.isFavorite
  return true
}

function BoardPreview({ board }: { board: DashboardBoardRow }): React.JSX.Element {
  if (board.thumbnailUrl) {
    return (
      <img
        src={board.thumbnailUrl}
        alt=""
        className="size-full object-cover transition duration-300 group-hover:scale-[1.015] motion-reduce:transform-none"
      />
    )
  }

  const alternate = board.id.length % 2 === 0
  return (
    <div className="relative size-full overflow-hidden bg-board" aria-hidden="true">
      <div className="board-grid absolute inset-0 opacity-55" />
      <div
        className={`absolute rounded-md border border-note-line bg-note p-2 shadow-sm ${
          alternate
            ? 'left-[10%] top-[17%] h-[42%] w-[43%] rotate-[-2deg]'
            : 'left-[13%] top-[13%] h-[38%] w-[48%] rotate-[1deg]'
        }`}
      >
        <div className="h-1.5 w-10 rounded-full bg-note-strong" />
        <div className="mt-2 h-1 w-full rounded-full bg-note-soft" />
        <div className="mt-1.5 h-1 w-3/4 rounded-full bg-note-soft" />
      </div>
      <div
        className={`absolute rounded-md border border-line bg-surface p-2 shadow-sm ${
          alternate
            ? 'bottom-[13%] right-[11%] h-[35%] w-[38%] rotate-[1deg]'
            : 'bottom-[12%] right-[9%] h-[42%] w-[34%] rotate-[-1deg]'
        }`}
      >
        <div className="h-1.5 w-8 rounded-full bg-accent/35" />
        <div className="mt-2 h-1 w-full rounded-full bg-line" />
        <div className="mt-1.5 h-1 w-2/3 rounded-full bg-line" />
      </div>
      <svg className="absolute inset-0 size-full" viewBox="0 0 240 150">
        <path
          d="M 108 62 C 130 64, 134 93, 154 96"
          fill="none"
          stroke="var(--color-accent)"
          strokeDasharray="4 4"
          strokeWidth="1.5"
          opacity="0.5"
        />
      </svg>
    </div>
  )
}

interface BoardItemProps {
  board: DashboardBoardRow
  view: DashboardView
  onOpen: () => void
  onToggleFavourite: () => void
  onTrash: () => void
  onRestore: () => void
  onRequestDelete: () => void
}

function BoardActionsMenu({
  board,
  onToggleFavourite,
  onTrash,
  onRestore,
  onRequestDelete
}: Omit<BoardItemProps, 'view' | 'onOpen'>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const closeOutside = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  const runAction = (action: () => void): void => {
    setOpen(false)
    triggerRef.current?.focus()
    action()
  }

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
    )
    if (!items.length) return

    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = current < items.length - 1 ? current + 1 : 0
    if (event.key === 'ArrowUp') next = current > 0 ? current - 1 : items.length - 1
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }
    if (next === null) return

    event.preventDefault()
    items[next]?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        ref={triggerRef}
        aria-label={`Actions for ${board.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        icon={<MoreHorizontal size={16} />}
        tooltip={`Actions for ${board.title}`}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${board.title}`}
          className="absolute right-0 top-full z-40 mt-1 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-panel"
          onKeyDown={handleMenuKeyDown}
        >
          {board.deletedAt ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-semibold text-muted hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => runAction(onRestore)}
              >
                <RotateCcw size={14} /> Restore
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-danger"
                onClick={() => runAction(onRequestDelete)}
              >
                <Trash2 size={14} /> Delete permanently
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-semibold text-muted hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                onClick={() => runAction(onToggleFavourite)}
              >
                <Star size={14} fill={board.isFavorite ? 'currentColor' : 'none'} />
                {board.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-semibold text-danger hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-danger"
                onClick={() => runAction(onTrash)}
              >
                <Trash2 size={14} /> Move to Trash
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function BoardSkeleton({ view }: { view: DashboardView }): React.JSX.Element {
  if (view === 'list') {
    return (
      <div className="flex animate-pulse items-center gap-4 rounded-xl border border-line bg-surface p-2 motion-reduce:animate-none">
        <span className="h-14 w-24 shrink-0 rounded-lg bg-board" />
        <span className="h-3 w-40 rounded-full bg-line" />
        <span className="ml-auto h-3 w-24 rounded-full bg-line" />
      </div>
    )
  }

  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-line bg-surface motion-reduce:animate-none">
      <div className="aspect-[16/10] bg-board" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-2/3 rounded-full bg-line" />
        <div className="h-2.5 w-1/2 rounded-full bg-line" />
      </div>
    </div>
  )
}

function BoardItem({
  board,
  view,
  onOpen,
  onToggleFavourite,
  onTrash,
  onRestore,
  onRequestDelete
}: BoardItemProps): React.JSX.Element {
  const date = board.deletedAt ?? board.updatedAt
  const datePrefix = board.deletedAt ? 'Deleted' : 'Updated'
  const itemLabel = `${board.itemCount} ${board.itemCount === 1 ? 'item' : 'items'}`
  const actions = (
    <BoardActionsMenu
      board={board}
      onToggleFavourite={onToggleFavourite}
      onTrash={onTrash}
      onRestore={onRestore}
      onRequestDelete={onRequestDelete}
    />
  )

  if (view === 'list') {
    return (
      <article className="group flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-2 shadow-sm transition hover:border-accent/30 hover:shadow-card sm:gap-4">
        <button
          type="button"
          onClick={onOpen}
          disabled={board.deletedAt !== null}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left sm:gap-4 ${focusRing}`}
          aria-label={`Open ${board.title}`}
        >
          <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-line sm:w-24">
            <BoardPreview board={board} />
          </span>
          <span className="min-w-0 flex-1 py-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold tracking-[-0.01em]">
                {board.title}
              </span>
              {board.isFavorite && !board.deletedAt && (
                <Star size={13} className="shrink-0 text-accent" fill="currentColor" />
              )}
            </span>
            <span className="mt-1 block text-xs text-muted sm:hidden">{itemLabel}</span>
          </span>
          <span className="hidden w-24 shrink-0 text-xs text-muted sm:block">{itemLabel}</span>
          <span className="hidden w-36 shrink-0 text-xs text-muted md:block">
            {datePrefix} {formatDate(date)}
          </span>
        </button>
        <div className="flex shrink-0 items-center">{actions}</div>
      </article>
    )
  }

  return (
    <article className="group relative min-w-0 rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-card motion-reduce:transform-none">
      <button
        type="button"
        onClick={onOpen}
        disabled={board.deletedAt !== null}
        className={`block w-full text-left ${focusRing}`}
        aria-label={`Open ${board.title}`}
      >
        <span className="block aspect-[16/10] overflow-hidden rounded-t-xl border-b border-line">
          <BoardPreview board={board} />
        </span>
        <span className="block px-4 pb-3 pt-3.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-[-0.01em]">{board.title}</span>
            {board.isFavorite && !board.deletedAt && (
              <Star size={13} className="shrink-0 text-accent" fill="currentColor" />
            )}
          </span>
          <span className="mt-1.5 block text-xs text-muted">
            {datePrefix} {formatDate(date)} · {itemLabel}
          </span>
        </span>
      </button>
      <div className="flex min-h-11 items-center justify-end border-t border-line/80 px-2.5">
        {actions}
      </div>
    </article>
  )
}

export function Dashboard({
  workspace,
  boards,
  section,
  view,
  query,
  dark,
  storage,
  creating = false,
  loading = false,
  onSectionChange,
  onViewChange,
  onQueryChange,
  onCreateBoard,
  onCreateTemplate,
  onImportBoard,
  onOpenBoard,
  onToggleFavorite,
  onTrashBoard,
  onRestoreBoard,
  onDeleteBoard,
  onCloseWorkspace,
  onToggleTheme,
  onOpenSettings
}: DashboardProps): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false)
  const [boardTitle, setBoardTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<DashboardBoardRow | null>(null)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)

  const sectionCounts = useMemo(
    () =>
      navItems.reduce<Record<DashboardSection, number>>(
        (counts, item) => {
          counts[item.section] =
            item.section === 'templates'
              ? BOARD_TEMPLATES.length
              : boards.filter((board) => includesSection(board, item.section)).length
          return counts
        },
        { recent: 0, all: 0, favorites: 0, templates: BOARD_TEMPLATES.length, trash: 0 }
      ),
    [boards]
  )

  const visibleBoards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const filtered = boards
      .filter((board) => includesSection(board, section))
      .filter(
        (board) =>
          !normalizedQuery ||
          `${board.title} ${board.searchText ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
      )
      .sort((a, b) => Date.parse(b.openedAt ?? b.updatedAt) - Date.parse(a.openedAt ?? a.updatedAt))

    return section === 'recent' ? filtered.slice(0, 8) : filtered
  }, [boards, query, section])

  const storagePercent = storage?.totalBytes
    ? Math.min(100, Math.max(0, (storage.usedBytes / storage.totalBytes) * 100))
    : null
  const busy = creating || submitting || loading

  async function createBoard(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const title = boardTitle.trim()
    if (!title || busy) return

    setSubmitting(true)
    setCreateError(null)
    try {
      await onCreateBoard(title)
      setBoardTitle('')
      setShowCreate(false)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create the board.')
    } finally {
      setSubmitting(false)
    }
  }

  async function createTemplate(templateId: TemplateId): Promise<void> {
    if (busy) return
    setSubmitting(true)
    setCreateError(null)
    try {
      await onCreateTemplate(templateId)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create the template.')
    } finally {
      setSubmitting(false)
    }
  }

  function openCreateForm(): void {
    setCreateError(null)
    setShowCreate(true)
  }

  function closeCreateForm(): void {
    if (busy) return
    setBoardTitle('')
    setCreateError(null)
    setShowCreate(false)
  }

  const emptyTitle = query
    ? 'No matching boards'
    : section === 'trash'
      ? 'Trash is empty'
      : section === 'favorites'
        ? 'No favourites yet'
        : 'Create your first board'
  const emptyDescription = query
    ? 'Try a different title or search term.'
    : section === 'trash'
      ? 'Boards moved here will stay available to restore.'
      : section === 'favorites'
        ? 'Use the star on a board to keep it here.'
        : 'Give your ideas room to connect on an infinite canvas.'

  return (
    <main className="min-h-screen bg-canvas text-ink lg:h-screen lg:overflow-hidden">
      <header className="flex h-[4.5rem] items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <BrandMark compact />
          <span className="hidden h-7 w-px bg-line sm:block" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.01em]">{workspace.name}</p>
            <p className="hidden max-w-80 truncate text-[11px] text-muted sm:block">
              {workspace.displayPath}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="icon-button"
            aria-label="Open settings"
            title="Settings"
          >
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="icon-button"
            aria-label={dark ? 'Use light appearance' : 'Use dark appearance'}
            title={dark ? 'Light appearance' : 'Dark appearance'}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            onClick={onCloseWorkspace}
            className={`inline-flex h-[2.35rem] items-center gap-2 rounded-[0.65rem] border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition hover:border-accent/45 hover:text-accent sm:px-3 ${focusRing}`}
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Close workspace</span>
          </button>
        </div>
      </header>

      <div className="lg:grid lg:h-[calc(100vh-4.5rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="flex border-b border-line bg-surface px-3 py-3 lg:flex-col lg:border-b-0 lg:border-r lg:px-4 lg:py-5">
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto lg:block" aria-label="Boards">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = section === item.section
              return (
                <button
                  type="button"
                  key={item.section}
                  onClick={() => onSectionChange(item.section)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition lg:mb-1 lg:w-full ${focusRing} ${
                    active
                      ? 'bg-accent-soft font-semibold text-accent'
                      : 'font-medium text-muted hover:bg-canvas hover:text-ink'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    size={16}
                    fill={item.section === 'favorites' && active ? 'currentColor' : 'none'}
                  />
                  <span>{item.label}</span>
                  <span
                    className={`ml-auto hidden min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums lg:inline ${
                      active ? 'bg-surface/75 text-accent' : 'bg-canvas text-faint'
                    }`}
                  >
                    {sectionCounts[item.section]}
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto hidden border-t border-line pt-5 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <HardDrive size={14} />
              Workspace storage
            </div>
            <p className="mt-2 text-[11px] text-faint">
              {storage
                ? `${formatBytes(storage.usedBytes)}${
                    storage.totalBytes ? ` of ${formatBytes(storage.totalBytes)}` : ' used'
                  }`
                : 'Size unavailable'}
            </p>
            {storagePercent !== null && (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-board"
                role="progressbar"
                aria-label="Workspace storage used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(storagePercent)}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            )}
            <p className="mt-3 truncate text-[10px] text-faint" title={workspace.displayPath}>
              Stored locally · {workspace.displayPath}
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-7 lg:overflow-y-auto lg:px-9 lg:py-8 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Workspace
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em]">
                  {sectionCopy[section].title}
                </h1>
                <p className="mt-1 text-sm text-muted">{sectionCopy[section].description}</p>
              </div>

              {section === 'templates' ? (
                <button type="button" className="primary-button" onClick={openCreateForm}>
                  <Plus size={16} />
                  Blank board
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative min-w-0 sm:w-72">
                    <span className="sr-only">Search boards</span>
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                      size={16}
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                      placeholder="Search boards"
                      className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-sm outline-none transition placeholder:text-faint focus:border-accent/45 focus:ring-2 focus:ring-accent/15"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => onQueryChange('')}
                        className={`absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-canvas hover:text-ink ${focusRing}`}
                        aria-label="Clear board search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>

                  <div className="flex items-center gap-2">
                    <div
                      className="flex rounded-xl border border-line bg-surface p-1"
                      role="group"
                      aria-label="Board view"
                    >
                      <button
                        type="button"
                        onClick={() => onViewChange('grid')}
                        className={`grid size-8 place-items-center rounded-lg transition ${focusRing} ${
                          view === 'grid'
                            ? 'bg-accent-soft text-accent'
                            : 'text-muted hover:text-ink'
                        }`}
                        aria-label="Grid view"
                        aria-pressed={view === 'grid'}
                      >
                        <Grid2X2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onViewChange('list')}
                        className={`grid size-8 place-items-center rounded-lg transition ${focusRing} ${
                          view === 'list'
                            ? 'bg-accent-soft text-accent'
                            : 'text-muted hover:text-ink'
                        }`}
                        aria-label="List view"
                        aria-pressed={view === 'list'}
                      >
                        <List size={16} />
                      </button>
                    </div>
                    <button type="button" className="primary-button" onClick={openCreateForm}>
                      <Plus size={16} />
                      New board
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Import board"
                      title="Import .canvasnote board"
                      disabled={busy}
                      onClick={() => void onImportBoard()}
                    >
                      <FileInput size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showCreate && (
              <form
                onSubmit={(event) => void createBoard(event)}
                className="mt-6 rounded-xl border border-accent/25 bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label htmlFor="new-board-title" className="text-sm font-semibold">
                      Create a board
                    </label>
                    <p className="mt-1 text-xs text-muted">Start with a blank infinite canvas.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeCreateForm}
                    disabled={busy}
                    className={`grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink disabled:opacity-40 ${focusRing}`}
                    aria-label="Close create board form"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="new-board-title"
                    autoFocus
                    value={boardTitle}
                    onChange={(event) => {
                      setBoardTitle(event.target.value)
                      setCreateError(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') closeCreateForm()
                    }}
                    maxLength={240}
                    placeholder="Board title"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3.5 text-sm outline-none transition placeholder:text-faint focus:border-accent/45 focus:ring-2 focus:ring-accent/15"
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!boardTitle.trim() || busy}
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    Create board
                  </button>
                </div>
                {createError && (
                  <p className="mt-2 text-xs text-danger" role="alert">
                    {createError}
                  </p>
                )}
              </form>
            )}

            {section === 'templates' ? (
              <div className="mt-7">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {BOARD_TEMPLATES.map((template, index) => (
                    <button
                      type="button"
                      key={template.id}
                      disabled={busy}
                      onClick={() => void createTemplate(template.id)}
                      className={`group min-h-44 rounded-xl border border-line bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-card disabled:opacity-50 motion-reduce:transform-none ${focusRing}`}
                    >
                      <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
                        {index + 1}
                      </span>
                      <span className="mt-5 block text-sm font-semibold">{template.name}</span>
                      <span className="mt-1.5 block text-xs leading-5 text-muted">
                        {template.description}
                      </span>
                    </button>
                  ))}
                </div>
                {createError && (
                  <p className="mt-4 text-sm text-danger" role="alert">
                    {createError}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="mt-7 flex items-center justify-between border-b border-line pb-3">
                  <p
                    className="text-xs font-medium text-muted"
                    role={loading ? 'status' : undefined}
                  >
                    {loading ? (
                      'Loading boards…'
                    ) : (
                      <>
                        {visibleBoards.length} {visibleBoards.length === 1 ? 'board' : 'boards'}
                        {query ? ` matching “${query.trim()}”` : ''}
                      </>
                    )}
                  </p>
                  {!loading &&
                    section === 'recent' &&
                    sectionCounts.recent > visibleBoards.length && (
                      <button
                        type="button"
                        onClick={() => onSectionChange('all')}
                        className={`text-xs font-semibold text-accent hover:underline ${focusRing}`}
                      >
                        View all boards
                      </button>
                    )}
                </div>

                <div role="region" aria-label="Board list" aria-busy={loading}>
                  {loading ? (
                    <div
                      className={
                        view === 'grid'
                          ? 'mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                          : 'mt-4 space-y-2'
                      }
                      aria-hidden="true"
                    >
                      {Array.from({ length: view === 'grid' ? 6 : 4 }, (_, index) => (
                        <BoardSkeleton key={index} view={view} />
                      ))}
                    </div>
                  ) : visibleBoards.length > 0 ? (
                    <div
                      className={
                        view === 'grid'
                          ? 'mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                          : 'mt-4 space-y-2'
                      }
                    >
                      {visibleBoards.map((board) => (
                        <BoardItem
                          key={board.id}
                          board={board}
                          view={view}
                          onOpen={() => onOpenBoard(board.id)}
                          onToggleFavourite={() => onToggleFavorite(board.id, !board.isFavorite)}
                          onTrash={() => onTrashBoard(board.id)}
                          onRestore={() => onRestoreBoard(board.id)}
                          onRequestDelete={() => setDeleteCandidate(board)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      className="mt-5 bg-surface/45"
                      icon={
                        query ? (
                          <Search size={19} />
                        ) : section === 'trash' ? (
                          <Trash2 size={19} />
                        ) : section === 'favorites' ? (
                          <Star size={19} />
                        ) : (
                          <LayoutGrid size={19} />
                        )
                      }
                      title={emptyTitle}
                      description={emptyDescription}
                      primaryAction={
                        query ? (
                          <Button variant="quiet" onClick={() => onQueryChange('')}>
                            Clear search
                          </Button>
                        ) : section === 'recent' || section === 'all' ? (
                          <Button
                            variant="primary"
                            leadingIcon={<Plus size={16} />}
                            onClick={openCreateForm}
                          >
                            Create board
                          </Button>
                        ) : undefined
                      }
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
      {deleteCandidate && (
        <Dialog
          open
          title="Delete board permanently?"
          description="This action cannot be undone."
          initialFocusRef={deleteCancelRef}
          onClose={() => setDeleteCandidate(null)}
          footer={
            <>
              <Button
                ref={deleteCancelRef}
                variant="quiet"
                onClick={() => setDeleteCandidate(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                leadingIcon={<Trash2 size={15} />}
                onClick={() => {
                  const boardId = deleteCandidate.id
                  setDeleteCandidate(null)
                  onDeleteBoard(boardId)
                }}
              >
                Delete permanently
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">
            “{deleteCandidate.title}” will be removed from this workspace and cannot be restored.
          </p>
        </Dialog>
      )}
    </main>
  )
}
