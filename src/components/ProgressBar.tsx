export default function ProgressBar({ value, label }: { value: number | null; label: string }) {
  const pct = value === null ? null : Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex justify-between text-sm text-slate-600">
        <span data-testid="progress-label">{label}</span>
        {pct !== null && <span>{pct} %</span>}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div
          className={['h-full rounded-full bg-indigo-600 transition-all', pct === null ? 'w-1/3 animate-pulse' : ''].join(' ')}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
