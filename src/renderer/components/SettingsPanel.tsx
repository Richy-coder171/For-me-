import { useState } from 'react'
import {
  CircleCheck,
  FolderOpen,
  HardDrive,
  Info,
  Keyboard,
  Monitor,
  Palette,
  RotateCcw,
  ShieldCheck,
  Video
} from 'lucide-react'

import type { AppSettings, SettingsSnapshot } from '../../shared/schemas/settings'
import type { WorkspaceSummary } from '../../shared/schemas/workspace'
import { Button, Dialog, Feedback } from './ui'

interface SettingsPanelProps {
  snapshot: SettingsSnapshot
  recentWorkspaces: WorkspaceSummary[]
  version?: string
  platform?: string
  onChange: (settings: AppSettings) => Promise<void>
  onOpenDataLocation: () => Promise<void>
  onOpenBackups: () => Promise<void>
  onClose: () => void
}

type SettingsSection =
  'appearance' | 'canvas' | 'media' | 'shortcuts' | 'privacy' | 'diagnostics' | 'about'

const sections: ReadonlyArray<{
  id: SettingsSection
  label: string
  icon: typeof Palette
}> = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'canvas', label: 'Canvas & autosave', icon: Monitor },
  { id: 'media', label: 'Media & backups', icon: Video },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard },
  { id: 'privacy', label: 'Privacy & security', icon: ShieldCheck },
  { id: 'diagnostics', label: 'Diagnostics', icon: HardDrive },
  { id: 'about', label: 'About', icon: Info }
]

const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-ink outline-none focus:border-accent'

function SettingGroup({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="border-b border-line pb-5 last:border-b-0 last:pb-0">
      <h3 className="cn-section-title">{title}</h3>
      {description && <p className="cn-body-sm mt-1 max-w-xl leading-5">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function SettingsPanel({
  snapshot,
  recentWorkspaces,
  version = '0.1.0',
  platform = 'desktop',
  onChange,
  onOpenDataLocation,
  onOpenBackups,
  onClose
}: SettingsPanelProps): React.JSX.Element {
  const [section, setSection] = useState<SettingsSection>('appearance')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apply = async (patch: Partial<AppSettings>): Promise<void> => {
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      await onChange({ ...snapshot.values, ...patch })
      setSaved(true)
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
    <Dialog
      open
      wide
      title="Settings"
      eyebrow="CanvasNote"
      description="Changes are saved immediately."
      closeLabel="Close settings"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <span className="cn-body-sm" role="status" aria-live="polite">
            {busy ? (
              'Saving…'
            ) : saved ? (
              <span className="inline-flex items-center gap-1.5 text-success">
                <CircleCheck size={14} aria-hidden="true" /> Saved
              </span>
            ) : (
              'Saved locally'
            )}
          </span>
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="grid min-h-[25rem] gap-6 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto sm:flex-col" aria-label="Settings sections">
          {sections.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                aria-current={section === item.id ? 'page' : undefined}
                onClick={() => setSection(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors sm:w-full ${
                  section === item.id
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 space-y-5">
          {section === 'appearance' && (
            <>
              <SettingGroup
                title="Appearance"
                description="Choose how CanvasNote looks. System follows your operating-system setting."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="cn-label">
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
                  <label className="cn-label">
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
              </SettingGroup>
              <SettingGroup title="Reset appearance">
                <Button
                  leadingIcon={<RotateCcw size={15} />}
                  disabled={busy}
                  onClick={() => void apply({ theme: 'system', accent: 'indigo' })}
                >
                  Reset appearance settings
                </Button>
              </SettingGroup>
            </>
          )}

          {section === 'canvas' && (
            <SettingGroup
              title="Canvas & autosave"
              description="CanvasNote saves after edits settle. Shorter intervals write more often."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="cn-label">
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
                <label className="cn-label">
                  Autosave interval
                  <select
                    className={fieldClass}
                    value={snapshot.values.autosaveDelayMs}
                    disabled={busy}
                    onChange={(event) =>
                      void apply({ autosaveDelayMs: Number(event.target.value) })
                    }
                  >
                    <option value={500}>0.5 seconds</option>
                    <option value={750}>0.75 seconds</option>
                    <option value={1500}>1.5 seconds</option>
                    <option value={3000}>3 seconds</option>
                  </select>
                </label>
              </div>
            </SettingGroup>
          )}

          {section === 'media' && (
            <>
              <SettingGroup
                title="Media"
                description="Imported media is copied into the workspace so boards remain portable."
              >
                <label className="cn-label block max-w-xs">
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
                <p className="cn-body-sm mt-3">Import mode: Copy into workspace</p>
              </SettingGroup>
              <SettingGroup
                title="Backups"
                description="A rotating copy is stored before an existing board file is replaced."
              >
                <div className="flex flex-wrap items-end gap-3">
                  <label className="cn-label w-48">
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
                  <Button
                    leadingIcon={<FolderOpen size={15} />}
                    disabled={!snapshot.workspacePath}
                    onClick={() => void openLocation('backups')}
                  >
                    Open workspace backups
                  </Button>
                </div>
              </SettingGroup>
            </>
          )}

          {section === 'shortcuts' && (
            <SettingGroup
              title="Keyboard shortcuts"
              description="Shortcuts are disabled while you type in a field."
            >
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 text-xs">
                {[
                  ['Search this board', 'Ctrl/Cmd + K'],
                  ['Save board', 'Ctrl/Cmd + S'],
                  ['Undo / redo', 'Ctrl/Cmd + Z / Shift + Z'],
                  ['Add note / checklist', 'N / C'],
                  ['Import image / video', 'I / Shift + V'],
                  ['Frame / connection', 'F / L'],
                  ['Fit board / reset zoom', '0 / 1']
                ].map(([label, keys]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted">{label}</dt>
                    <dd className="cn-shortcut text-right">{keys}</dd>
                  </div>
                ))}
              </dl>
            </SettingGroup>
          )}

          {section === 'privacy' && (
            <SettingGroup title="Privacy & security">
              <Feedback
                tone="info"
                title="Local by default"
                message="Boards, indexes, media, and backups stay on this computer. CanvasNote has no account, telemetry, cloud sync, or collaboration service."
              />
              <p className="cn-body-sm mt-4 leading-5">
                The renderer is sandboxed and can access files only through validated,
                workspace-scoped application actions.
              </p>
            </SettingGroup>
          )}

          {section === 'diagnostics' && (
            <SettingGroup
              title="Data locations"
              description="Paths are shown for troubleshooting. Do not share private board files in public issues."
            >
              <dl className="space-y-3">
                <div>
                  <dt className="cn-label">Application data</dt>
                  <dd
                    className="cn-metadata mt-1 truncate rounded-md bg-background px-2.5 py-2"
                    title={snapshot.appDataPath}
                  >
                    App data: {snapshot.appDataPath}
                  </dd>
                </div>
                <div>
                  <dt className="cn-label">Current workspace</dt>
                  <dd
                    className="cn-metadata mt-1 truncate rounded-md bg-background px-2.5 py-2"
                    title={snapshot.workspacePath ?? 'No workspace open'}
                  >
                    Workspace: {snapshot.workspacePath ?? 'No workspace open'}
                  </dd>
                </div>
                {snapshot.workspacePath && (
                  <div>
                    <dt className="cn-label">Backup location</dt>
                    <dd className="cn-metadata mt-1 truncate rounded-md bg-background px-2.5 py-2">
                      {snapshot.workspacePath.replace(/[\\/]$/, '')}/backups
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  leadingIcon={<FolderOpen size={15} />}
                  onClick={() => void openLocation('data')}
                >
                  Open app data
                </Button>
                <Button
                  leadingIcon={<FolderOpen size={15} />}
                  disabled={!snapshot.workspacePath}
                  onClick={() => void openLocation('backups')}
                >
                  Open workspace backups
                </Button>
              </div>
            </SettingGroup>
          )}

          {section === 'about' && (
            <SettingGroup title="About CanvasNote">
              <div className="rounded-lg border border-border bg-background p-4">
                <p className="cn-app-title">CanvasNote {version}</p>
                <p className="cn-body-sm mt-1">Local-first visual notebook for {platform}.</p>
                <p className="cn-body-sm mt-4 leading-5">
                  CanvasNote is under active development. Keep backups of important workspaces.
                </p>
              </div>
            </SettingGroup>
          )}

          {error && (
            <Feedback
              tone="danger"
              title="Settings could not be updated"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
        </div>
      </div>
    </Dialog>
  )
}
