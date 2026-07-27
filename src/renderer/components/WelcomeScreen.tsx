import { useState } from 'react'
import { ArrowRight, FileInput, FolderOpen, Moon, Plus, Settings2, Sun } from 'lucide-react'

import { useAppStore } from '../stores/appStore'
import { BrandMark } from './BrandMark'
import { Button, EmptyState, IconButton } from './ui'

interface WelcomeScreenProps {
  dark: boolean
  settingsAvailable?: boolean
  onToggleTheme: () => void
  onImportBoard: () => void
  onOpenSettings: () => void
}

const lastOpenedFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
})

function formatLastOpened(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Last opened date unavailable'
    : lastOpenedFormatter.format(date)
}

export function WelcomeScreen({
  dark,
  settingsAvailable = true,
  onToggleTheme,
  onImportBoard,
  onOpenSettings
}: WelcomeScreenProps): React.JSX.Element {
  const [name, setName] = useState('My CanvasNote Workspace')
  const {
    appInfo,
    recentWorkspaces,
    operation,
    createWorkspace,
    openWorkspace,
    openRecentWorkspace
  } = useAppStore()
  const busy = operation !== 'idle'

  return (
    <main className="flex min-h-screen flex-col bg-background text-ink">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-6">
        <BrandMark />
        <div className="flex items-center gap-1">
          <IconButton
            aria-label="Open settings"
            tooltip="Settings"
            icon={<Settings2 size={17} />}
            disabled={!settingsAvailable}
            onClick={onOpenSettings}
          />
          <IconButton
            aria-label={dark ? 'Use light appearance' : 'Use dark appearance'}
            tooltip={dark ? 'Light appearance' : 'Dark appearance'}
            icon={dark ? <Sun size={17} /> : <Moon size={17} />}
            disabled={!settingsAvailable}
            onClick={onToggleTheme}
          />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-6 py-8 md:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12 lg:px-8">
        <section aria-labelledby="welcome-title">
          <p className="cn-caption font-semibold uppercase tracking-[0.12em]">Local workspace</p>
          <h1 id="welcome-title" className="cn-screen-title mt-2">
            Start in CanvasNote
          </h1>
          <p className="cn-body mt-2">
            Create a workspace on this computer, or open one you already use.
          </p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (name.trim() && !busy) void createWorkspace(name)
            }}
          >
            <label htmlFor="workspace-name" className="cn-label block">
              New workspace name
            </label>
            <input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              disabled={busy}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
              placeholder="Workspace name"
            />
            <Button
              type="submit"
              variant="primary"
              size="large"
              className="w-full"
              loading={operation === 'creating-workspace'}
              disabled={!name.trim() || busy}
              leadingIcon={<Plus size={16} />}
            >
              Create workspace
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="cn-caption">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="grid gap-2">
            <Button
              size="large"
              className="w-full"
              loading={operation === 'opening-workspace'}
              disabled={busy}
              leadingIcon={<FolderOpen size={16} />}
              onClick={() => void openWorkspace()}
            >
              Open workspace
            </Button>
            <Button
              variant="quiet"
              className="w-full"
              disabled={busy}
              leadingIcon={<FileInput size={16} />}
              onClick={onImportBoard}
            >
              Import a .canvasnote board
            </Button>
          </div>
        </section>

        <section className="min-w-0" aria-labelledby="recent-workspaces-title">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
            <div>
              <h2 id="recent-workspaces-title" className="cn-section-title">
                Recent workspaces
              </h2>
              <p className="cn-body-sm mt-1">Open a local workspace where you left off.</p>
            </div>
            <span className="cn-metadata shrink-0">v{appInfo?.version ?? '0.1.0'}</span>
          </div>

          {recentWorkspaces.length ? (
            <ul className="m-0 max-h-[calc(100vh-10rem)] list-none overflow-y-auto p-0">
              {recentWorkspaces.map((workspace) => (
                <li key={workspace.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openRecentWorkspace(workspace.id)}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                    aria-label={`Open ${workspace.name}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted shadow-sm">
                      <FolderOpen size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {workspace.name}
                      </span>
                      <span
                        className="mt-0.5 block truncate text-xs text-muted"
                        title={workspace.displayPath}
                      >
                        {workspace.displayPath}
                      </span>
                      <span className="mt-1 block text-xs text-faint">
                        Last opened {formatLastOpened(workspace.lastOpenedAt)}
                      </span>
                    </span>
                    <ArrowRight
                      className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transform-none"
                      size={16}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-5"
              icon={<FolderOpen size={18} />}
              title="No recent workspaces"
              description="Create a workspace or open an existing folder. It will appear here next time."
            />
          )}
        </section>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-line px-6 py-3 text-xs text-muted">
        <span>CanvasNote {appInfo?.version ?? '0.1.0'}</span>
        <span>Boards and media stay on this computer.</span>
      </footer>
    </main>
  )
}
