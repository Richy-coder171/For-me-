import { ArrowLeft, LayoutDashboard } from 'lucide-react'

import type { WorkspaceSummary } from '../../shared/schemas/workspace'
import { BrandMark } from './BrandMark'

interface WorkspaceShellProps {
  workspace: WorkspaceSummary
  onClose: () => void
}

export function WorkspaceShell({ workspace, onClose }: WorkspaceShellProps): React.JSX.Element {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas p-8 text-ink">
      <section className="w-full max-w-xl rounded-2xl border border-line bg-surface p-7 shadow-panel">
        <div className="flex items-center justify-between">
          <BrandMark />
          <button
            type="button"
            onClick={onClose}
            className="icon-button"
            aria-label="Back to welcome"
          >
            <ArrowLeft size={17} />
          </button>
        </div>
        <div className="mt-12 grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
          <LayoutDashboard size={21} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{workspace.name}</h1>
        <p className="mt-2 break-all text-sm leading-6 text-muted">{workspace.displayPath}</p>
        <div className="mt-8 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-muted">
          Workspace created and validated. Board management arrives in the next completed milestone.
        </div>
      </section>
    </main>
  )
}
