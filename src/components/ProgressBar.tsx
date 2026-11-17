export default function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const pct = value === null ? null : Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="appear flex flex-col gap-2" aria-live="polite">
      <div className="flex justify-between gap-3 text-[13.5px] text-muted">
        <span data-testid="progress-label">{label}</span>
        {pct !== null && <span className="font-mono text-[12.5px] text-faint">{pct} %</span>}
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
        <div
          className={['progress__bar', pct === null ? 'progress__bar--indeterminate' : ''].join(' ')}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
