import type { Match } from '../lib/grammar'

/** Lists grammar findings for one text with one-tap fixes. */
export default function GrammarHints({ text, matches, onFix }: { text: string; matches: Match[]; onFix: (m: Match, r: string) => void }) {
  if (!matches.length) return null
  return (
    <ul className="space-y-2">
      {matches.map((m, i) => (
        <li key={i} className="rounded-2xl bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
          <p className="font-bold">
            <span className="rounded bg-amber-200 px-1 font-black text-amber-900 dark:bg-amber-800 dark:text-amber-100">{text.slice(m.offset, m.offset + m.length) || '␣'}</span>{' '}
            {m.message}
          </p>
          {m.replacements.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {m.replacements.map(r => (
                <button key={r} type="button" onClick={() => onFix(m, r)} className="rounded-xl bg-white px-3 py-1 font-extrabold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50 dark:bg-slate-900 dark:text-violet-300 dark:ring-slate-700">
                  → {r}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
