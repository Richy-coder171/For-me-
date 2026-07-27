export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid size-9 place-items-center rounded-lg bg-ink text-sm font-semibold text-background shadow-sm"
        aria-hidden="true"
      >
        C
      </span>
      {compact ? (
        <span className="sr-only">CanvasNote</span>
      ) : (
        <div>
          <div className="cn-app-title">CanvasNote</div>
          <div className="cn-caption mt-0.5 uppercase tracking-[0.1em]">Visual notebook</div>
        </div>
      )}
    </div>
  )
}
