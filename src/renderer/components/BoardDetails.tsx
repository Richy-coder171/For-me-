import { useState } from 'react'
import { ArrowLeft, Check, LoaderCircle } from 'lucide-react'

import type { OpenBoard } from '../../shared/schemas/board'
import { BrandMark } from './BrandMark'

interface BoardDetailsProps {
  stored: OpenBoard
  saving: boolean
  onBack: () => void
  onSaveTitle: (title: string) => Promise<void>
}

export function BoardDetails({
  stored,
  saving,
  onBack,
  onSaveTitle
}: BoardDetailsProps): React.JSX.Element {
  const [title, setTitle] = useState(stored.board.title)
  const [saved, setSaved] = useState(false)

  async function save(): Promise<void> {
    if (!title.trim() || title.trim() === stored.board.title || saving) return
    try {
      await onSaveTitle(title)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1400)
    } catch {
      setSaved(false)
    }
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-board text-ink">
      <header className="flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
        <button type="button" onClick={onBack} className="icon-button" aria-label="Back to boards">
          <ArrowLeft size={17} />
        </button>
        <BrandMark compact />
        <span className="mx-1 hidden h-7 w-px bg-line sm:block" aria-hidden="true" />
        <label className="min-w-0 flex-1">
          <span className="sr-only">Board title</span>
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setSaved(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void save()
            }}
            maxLength={240}
            className="w-full rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <span className="hidden text-[11px] text-faint md:inline">
          Revision {stored.revision.slice(0, 7)}
        </span>
        <button
          type="button"
          className="primary-button min-w-20"
          disabled={!title.trim() || title.trim() === stored.board.title || saving}
          onClick={() => void save()}
        >
          {saving ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </header>

      <section className="board-grid relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-board/55" />
        <div className="absolute inset-8 rounded-xl border border-dashed border-line" />
        <div className="absolute left-1/2 top-1/2 w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface px-6 py-5 text-center shadow-panel">
          <p className="text-sm font-semibold">This board is empty</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Board metadata is stored locally and ready for visual objects.
          </p>
        </div>
      </section>
    </main>
  )
}
