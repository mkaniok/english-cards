import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { dirsOf, useSelection, type DirMode } from '../lib/selection'
import { isLearned } from '../lib/practice'
import { pkey, type Lesson } from '../lib/types'
import ProgressBar from '../components/ProgressBar'
import { cardsWord, plural } from '../lib/plural'

const DIRS: { id: DirMode; label: string; hint: string }[] = [
  { id: 'en', label: '🇬🇧 → 🇨🇿', hint: 'Anglicky → česky' },
  { id: 'cz', label: '🇨🇿 → 🇬🇧', hint: 'Česky → anglicky' },
  { id: 'mix', label: '🔀 Mix', hint: 'Oba směry' },
]

export default function Home() {
  const { profile } = useAuth()
  const { loading, error, textbooks, lessons, cards, levels } = useData()
  const [sel, setSel] = useSelection()
  const navigate = useNavigate()
  const dirs = dirsOf(sel.dir)

  const approved = useMemo(() => cards.filter(c => c.status === 'approved'), [cards])
  const byLesson = useMemo(() => {
    const m = new Map<string, typeof approved>()
    for (const c of approved) m.set(c.lesson_id, [...(m.get(c.lesson_id) ?? []), c])
    return m
  }, [approved])

  const stat = (ids: string[]) => {
    let total = 0, learned = 0
    for (const id of ids) for (const c of byLesson.get(id) ?? []) for (const d of dirs) {
      total++
      if (isLearned(levels.get(pkey(c.id, d)))) learned++
    }
    return { total, learned }
  }
  const selected = sel.lessons.filter(id => (byLesson.get(id)?.length ?? 0) > 0)
  const s = stat(selected)

  const toggle = (id: string) =>
    setSel(v => ({ ...v, lessons: v.lessons.includes(id) ? v.lessons.filter(x => x !== id) : [...v.lessons, id] }))
  const toggleBook = (ids: string[]) => {
    const all = ids.every(id => sel.lessons.includes(id))
    setSel(v => ({ ...v, lessons: all ? v.lessons.filter(x => !ids.includes(x)) : [...new Set([...v.lessons, ...ids])] }))
  }

  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggleOpen = (key: string) => setOpen(o => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const LessonTile = ({ lesson: l, nested }: { lesson: Lesson; nested?: boolean }) => {
    const n = byLesson.get(l.id)?.length ?? 0
    const st = stat([l.id])
    const on = sel.lessons.includes(l.id)
    const { code, name } = splitTitle(l.title)
    return (
      <button disabled={!n} onClick={() => toggle(l.id)}
        className={`w-full rounded-2xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/40' : 'border-violet-100 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900'} ${nested ? '!py-2' : ''}`}>
        <div className="flex items-center gap-2 font-extrabold">
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-sm ${on ? 'bg-violet-600 text-white' : 'bg-violet-100 dark:bg-slate-800'}`}>{on ? '✓' : ''}</span>
          {code && <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-sm font-black text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">{code}</span>}
          <span className="flex-1">{name}</span>
          <span className="shrink-0 text-sm text-slate-500">{n ? cardsWord(n) : 'prázdná'}</span>
        </div>
        {n > 0 && <ProgressBar className="mt-2 !h-2" value={st.learned} max={st.total} />}
      </button>
    )
  }

  const UnitGroup = ({ unit, ids, children }: { unit: string; ids: string[]; children: ReactNode }) => {
    const usable = ids.filter(id => (byLesson.get(id)?.length ?? 0) > 0)
    const chosen = usable.filter(id => sel.lessons.includes(id)).length
    const all = usable.length > 0 && chosen === usable.length
    const expanded = open.has(unit)
    const st = stat(usable)
    const cards = usable.reduce((a, id) => a + (byLesson.get(id)?.length ?? 0), 0)
    return (
      <div className={`rounded-2xl border-2 ${chosen ? 'border-violet-300 dark:border-violet-700' : 'border-violet-100 dark:border-slate-700'}`}>
        <div className="flex items-center gap-2 p-3">
          <button onClick={() => toggleBook(usable)} disabled={!usable.length} aria-label={all ? 'Zrušit výběr lekce' : 'Vybrat celou lekci'}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-black ${all ? 'bg-violet-600 text-white' : chosen ? 'bg-violet-300 text-white dark:bg-violet-700' : 'bg-violet-100 dark:bg-slate-800'}`}>
            {all ? '✓' : chosen ? '–' : ''}
          </button>
          <button onClick={() => toggleOpen(unit)} className="flex flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
            <span className="text-lg font-black">Lekce {unit}</span>
            <span className="text-sm font-bold text-slate-500">{chosen ? `vybráno ${chosen} z ${usable.length}` : `${plural(usable.length, 'část', 'části', 'částí')} · ${cardsWord(cards)}`}</span>
            <span className={`ml-auto text-slate-400 transition ${expanded ? 'rotate-90' : ''}`}>▶</span>
          </button>
        </div>
        <ProgressBar className="mx-3 mb-3 !h-2" value={st.learned} max={st.total} />
        {expanded && <div className="space-y-2 border-t-2 border-violet-100 p-3 pl-6 dark:border-slate-800 sm:pl-10">{children}</div>}
      </div>
    )
  }

  if (loading) return <p className="panel text-center font-bold">Načítám kartičky…</p>
  if (error) return <p className="panel text-center font-bold text-rose-600">{error}</p>

  return (
    <div className="space-y-4">
      <section className="panel">
        <h1 className="text-2xl font-black">Ahoj, {profile?.nickname}! 👋</h1>
        <p className="font-bold text-slate-500 dark:text-slate-400">Vyber lekce a směr, a jdeme procvičovat.</p>
      </section>

      <section className="panel">
        <h2 className="label">Směr</h2>
        <div className="grid grid-cols-3 gap-2">
          {DIRS.map(d => (
            <button key={d.id} onClick={() => setSel(v => ({ ...v, dir: d.id }))} title={d.hint}
              className={`chip justify-center text-lg ${sel.dir === d.id ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-100 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </section>

      {textbooks.map(tb => {
        const ls = lessons.filter(l => l.textbook_id === tb.id)
        const withCards = ls.filter(l => (byLesson.get(l.id)?.length ?? 0) > 0).map(l => l.id)
        return (
          <section key={tb.id} className="panel">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-black">📘 {tb.title}</h2>
              {withCards.length > 1 && (
                <button className="ml-auto text-sm font-extrabold text-violet-600 hover:underline dark:text-violet-300" onClick={() => toggleBook(withCards)}>
                  {withCards.every(id => sel.lessons.includes(id)) ? 'Zrušit vše' : 'Vybrat vše'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {groupLessons(ls).map(g => g.unit === null ? (
                <LessonTile key={g.lessons[0].id} lesson={g.lessons[0]} />
              ) : (
                <UnitGroup key={g.unit} unit={g.unit} ids={g.lessons.map(l => l.id)}>
                  {g.lessons.map(l => <LessonTile key={l.id} lesson={l} nested />)}
                </UnitGroup>
              ))}
            </div>
          </section>
        )
      })}

      <div className="sticky bottom-24 z-10 md:bottom-4">
        <button className="btn-primary w-full text-xl" disabled={!s.total} onClick={() => navigate('/practice')}>
          {s.total ? `Procvičovat (${s.learned}/${s.total} naučeno) 🚀` : 'Vyber aspoň jednu lekci'}
        </button>
      </div>
    </div>
  )
}

/** "1A – At home" -> code "1A", name "At home"; titles without a number stay whole. */
function splitTitle(title: string) {
  const m = title.match(/^(\d+[A-Za-z]?)\s*[–-]\s*(.+)$/)
  return m ? { code: m[1], name: m[2] } : { code: '', name: title }
}

/** Groups lessons whose titles start with the same number (1A, 1B, 1 – Data → unit 1), keeping order. */
function groupLessons(ls: Lesson[]) {
  const groups: { unit: string | null; lessons: Lesson[] }[] = []
  for (const l of ls) {
    const unit = l.title.match(/^(\d+)/)?.[1] ?? null
    const existing = unit ? groups.find(g => g.unit === unit) : undefined
    if (existing) existing.lessons.push(l)
    else if (unit) groups.push({ unit, lessons: [l] })
    else groups.push({ unit: null, lessons: [l] })
  }
  return groups
}
