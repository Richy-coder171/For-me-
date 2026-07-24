export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3" aria-label="CanvasNote">
      <span className="grid size-9 place-items-center rounded-xl bg-ink text-sm font-semibold text-white shadow-sm">
        C
      </span>
      {!compact && (
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-ink">CanvasNote</div>
          <div className="text-[11px] font-medium tracking-wide text-muted">VISUAL NOTEBOOK</div>
        </div>
      )}
    </div>
  )
}
