import { useState } from 'react'
import { FolderOpen, HardDrive, Keyboard, Settings2, ShieldCheck, X } from 'lucide-react'

import type { AppSettings, SettingsSnapshot } from '../../shared/schemas/settings'
import type { WorkspaceSummary } from '../../shared/schemas/workspace'

interface SettingsPanelProps {
  snapshot: SettingsSnapshot
  recentWorkspaces: WorkspaceSummary[]
  onChange: (settings: AppSettings) => Promise<void>
  onOpenDataLocation: () => Promise<void>
  onOpenBackups: () => Promise<void>
  onClose: () => void
}

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-accent'

export function SettingsPanel({
  snapshot,
  recentWorkspaces,
  onChange,
  onOpenDataLocation,
  onOpenBackups,
  onClose
}: SettingsPanelProps): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async (patch: Partial<AppSettings>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await onChange({ ...snapshot.values, ...patch })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update settings.')
    } finally {
      setBusy(false)
    }
  }

  const openLocation = async (kind: 'data' | 'backups'): Promise<void> => {
    setError(null)
    try {
      await (kind === 'data' ? onOpenDataLocation() : onOpenBackups())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open that folder.')
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-panel"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
              <Settings2 size={18} />
            </span>
            <div>
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                CanvasNote
              </p>
              <h2 id="settings-title" className="m-0 mt-0.5 text-base font-semibold">
                Settings
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>

        <div className="max-h-[calc(90vh-4.6rem)] space-y-6 overflow-y-auto p-5 sm:p-6">
          <section>
            <h3 className="text-sm font-semibold">Appearance</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted">
                Theme
                <select
                  className={fieldClass}
                  value={snapshot.values.theme}
                  disabled={busy}
                  onChange={(event) =>
                    void apply({ theme: event.target.value as AppSettings['theme'] })
                  }
                >
                  <option value="system">Use system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Accent colour
                <select
                  className={fieldClass}
                  value={snapshot.values.accent}
                  disabled={busy}
                  onChange={(event) =>
                    void apply({ accent: event.target.value as AppSettings['accent'] })
                  }
                >
                  <option value="indigo">Indigo</option>
                  <option value="violet">Violet</option>
                  <option value="teal">Teal</option>
                  <option value="amber">Amber</option>
                </select>
              </label>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold">Workspace & saving</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-muted">
                Default workspace
                <select
                  className={fieldClass}
                  value={snapshot.values.defaultWorkspaceId ?? ''}
                  disabled={busy}
                  onChange={(event) =>
                    void apply({ defaultWorkspaceId: event.target.value || null })
                  }
                >
                  <option value="">Show welcome screen</option>
                  {recentWorkspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Autosave interval
                <select
                  className={fieldClass}
                  value={snapshot.values.autosaveDelayMs}
                  disabled={busy}
                  onChange={(event) => void apply({ autosaveDelayMs: Number(event.target.value) })}
                >
                  <option value={500}>0.5 seconds</option>
                  <option value={750}>0.75 seconds</option>
                  <option value={1500}>1.5 seconds</option>
                  <option value={3000}>3 seconds</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Rotating backups per board
                <select
                  className={fieldClass}
                  value={snapshot.values.backupLimit}
                  disabled={busy}
                  onChange={(event) => void apply({ backupLimit: Number(event.target.value) })}
                >
                  {[1, 3, 5, 7, 10].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-muted">
                Default video speed
                <select
                  className={fieldClass}
                  value={snapshot.values.defaultPlaybackRate}
                  disabled={busy}
                  onChange={(event) =>
                    void apply({ defaultPlaybackRate: Number(event.target.value) })
                  }
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}×
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Media import mode: <strong>Copy into workspace</strong>. This keeps board paths
              portable and prevents external files from granting the renderer filesystem access.
            </p>
          </section>

          <section className="border-t border-line pt-5">
            <div className="flex items-start gap-3">
              <Keyboard className="mt-0.5 text-accent" size={17} />
              <div>
                <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  N note · C checklist · I image · Shift+V video · F frame · L connection ·
                  Ctrl/Cmd+K search · Ctrl/Cmd+S save · Ctrl/Cmd+Z undo · 0 fit board · 1 reset zoom
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-accent" size={17} />
              <div>
                <h3 className="text-sm font-semibold">Privacy</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Boards, indexes, media, and backups stay on this computer. CanvasNote has no
                  account, telemetry, cloud sync, or collaboration service.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <HardDrive size={16} /> Data locations
            </div>
            <p className="mt-2 break-all text-xs text-muted">App data: {snapshot.appDataPath}</p>
            {snapshot.workspacePath && (
              <p className="mt-1 break-all text-xs text-muted">
                Workspace: {snapshot.workspacePath}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="canvas-secondary-action"
                onClick={() => void openLocation('data')}
              >
                <FolderOpen size={15} /> Open app data
              </button>
              <button
                type="button"
                className="canvas-secondary-action"
                disabled={!snapshot.workspacePath}
                onClick={() => void openLocation('backups')}
              >
                <FolderOpen size={15} /> Open workspace backups
              </button>
            </div>
          </section>

          {error && (
            <p
              className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
