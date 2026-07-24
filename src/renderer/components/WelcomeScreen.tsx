import { useState } from 'react'
import { ArrowRight, FolderOpen, LoaderCircle, Moon, Plus, Sun } from 'lucide-react'

import { useAppStore } from '../stores/appStore'
import { BrandMark } from './BrandMark'

interface WelcomeScreenProps {
  dark: boolean
  onToggleTheme: () => void
}

export function WelcomeScreen({ dark, onToggleTheme }: WelcomeScreenProps): React.JSX.Element {
  const [name, setName] = useState('My CanvasNote Workspace')
  const {
    appInfo,
    recentWorkspaces,
    operation,
    error,
    createWorkspace,
    openWorkspace,
    openRecentWorkspace,
    clearError
  } = useAppStore()
  const busy = operation !== 'idle'

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="flex h-20 items-center justify-between border-b border-line px-8 lg:px-12">
        <BrandMark />
        <button
          type="button"
          onClick={onToggleTheme}
          className="icon-button"
          aria-label={dark ? 'Use light appearance' : 'Use dark appearance'}
          title={dark ? 'Light appearance' : 'Dark appearance'}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-8 py-12 lg:grid-cols-[1fr_0.86fr] lg:px-12 lg:py-16">
        <section className="flex flex-col justify-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Local-first visual thinking
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-ink lg:text-5xl">
            Ideas make more sense when you can see the connections.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted">
            Build visual boards with notes, media, and timestamped video observations. Your
            workspace stays on this computer.
          </p>

          <div className="mt-9 max-w-lg rounded-2xl border border-line bg-surface p-2 shadow-panel">
            <label htmlFor="workspace-name" className="sr-only">
              New workspace name
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && name.trim() && !busy) void createWorkspace(name)
                }}
                maxLength={120}
                className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-sm font-medium outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/30"
                placeholder="Workspace name"
              />
              <button
                type="button"
                className="primary-button"
                disabled={!name.trim() || busy}
                onClick={() => void createWorkspace(name)}
              >
                {operation === 'creating' ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Create workspace
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void openWorkspace()}
            className="mt-3 flex w-fit items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <FolderOpen size={16} />
            Open an existing workspace
          </button>

          {error && (
            <div
              role="alert"
              className="mt-5 flex max-w-lg items-start justify-between gap-4 rounded-xl border border-danger/25 bg-danger/7 px-4 py-3 text-sm text-danger"
            >
              <span>{error}</span>
              <button type="button" className="font-semibold" onClick={clearError}>
                Dismiss
              </button>
            </div>
          )}
        </section>

        <aside className="relative min-h-[430px] overflow-hidden rounded-[24px] border border-line bg-board shadow-panel">
          <div className="absolute inset-0 board-grid opacity-60" />
          <div className="absolute left-[9%] top-[12%] w-[48%] rotate-[-2deg] rounded-lg border border-note-line bg-note p-5 shadow-card">
            <div className="mb-3 h-2 w-20 rounded bg-note-strong" />
            <div className="space-y-2">
              <div className="h-1.5 w-full rounded bg-note-soft" />
              <div className="h-1.5 w-[86%] rounded bg-note-soft" />
              <div className="h-1.5 w-[62%] rounded bg-note-soft" />
            </div>
          </div>
          <div className="absolute bottom-[15%] right-[8%] w-[52%] rotate-[1.5deg] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <div className="aspect-video bg-video p-4">
              <div className="flex h-full items-center justify-center">
                <span className="grid size-11 place-items-center rounded-full bg-white/95 pl-0.5 text-ink shadow-sm">
                  ▶
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-[11px] font-medium text-muted">
              <span>Research interview</span>
              <span>02:35</span>
            </div>
          </div>
          <svg className="absolute inset-0 size-full" aria-hidden="true">
            <path
              d="M 210 185 C 250 235, 275 250, 315 285"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeDasharray="5 5"
              opacity="0.65"
            />
          </svg>
          <div className="absolute right-[13%] top-[17%] rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent shadow-sm">
            02:35 — Key insight
          </div>
        </aside>
      </div>

      <section className="mx-auto max-w-6xl px-8 pb-10 lg:px-12">
        <div className="flex items-end justify-between border-t border-line pt-7">
          <div>
            <h2 className="text-sm font-semibold">Recent workspaces</h2>
            <p className="mt-1 text-xs text-muted">
              {recentWorkspaces.length
                ? 'Continue where you left off.'
                : 'Your recent workspaces will appear here.'}
            </p>
          </div>
          <span className="text-[11px] text-faint">CanvasNote {appInfo?.version ?? '0.1.0'}</span>
        </div>

        {recentWorkspaces.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentWorkspaces.map((workspace) => (
              <button
                type="button"
                key={workspace.id}
                disabled={busy}
                onClick={() => void openRecentWorkspace(workspace.id)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 motion-reduce:transform-none"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <FolderOpen size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{workspace.name}</span>
                  <span className="mt-1 block truncate text-[11px] text-muted">
                    {workspace.displayPath}
                  </span>
                </span>
                <ArrowRight
                  className="text-faint transition group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transform-none"
                  size={16}
                />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
