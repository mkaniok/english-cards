export default function ProgressBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className={`h-3 overflow-hidden rounded-full bg-violet-100 dark:bg-slate-800 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}
