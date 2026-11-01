import type { Answer } from '../lib/types'
import { dayKey } from '../lib/dates'

const DAY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so']

/** Answers per day for the last N days, stacked by grade. */
export default function DayChart({ answers, days = 14 }: { answers: Pick<Answer, 'grade' | 'answered_at'>[]; days?: number }) {
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
    return { key: dayKey(d), label: DAY[d.getDay()], date: d.getDate(), knew: 0, partial: 0, unknown: 0 }
  })
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  for (const a of answers) {
    const i = idx.get(dayKey(a.answered_at))
    if (i !== undefined) buckets[i][a.grade]++
  }
  const max = Math.max(1, ...buckets.map(b => b.knew + b.partial + b.unknown))
  return (
    <div>
      <div className="flex h-36 items-end gap-1">
        {buckets.map(b => {
          const total = b.knew + b.partial + b.unknown
          return (
            <div key={b.key} className="flex h-full flex-1 flex-col justify-end" title={`${b.date}. – ${total} odpovědí (věděl ${b.knew}, napůl ${b.partial}, nevěděl ${b.unknown})`}>
              {total > 0 && <div className="mb-0.5 text-center text-[10px] font-black text-slate-500">{total}</div>}
              <div className="flex flex-col overflow-hidden rounded-md" style={{ height: `${(total / max) * 100}%` }}>
                <div className="bg-emerald-500" style={{ flex: b.knew }} />
                <div className="bg-amber-400" style={{ flex: b.partial }} />
                <div className="bg-rose-500" style={{ flex: b.unknown }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {buckets.map(b => <div key={b.key} className="flex-1 text-center text-[10px] font-bold text-slate-500">{b.label}<br />{b.date}.</div>)}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-3 text-sm font-bold">
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-emerald-500" />věděl</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-400" />napůl</span>
        <span><span className="mr-1 inline-block h-3 w-3 rounded bg-rose-500" />nevěděl</span>
      </div>
    </div>
  )
}
