import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { dirsOf, useSelection, type DirMode } from '../lib/selection'
import { isLearned } from '../lib/practice'
import { pkey } from '../lib/types'
import ProgressBar from '../components/ProgressBar'
import { cardsWord } from '../lib/plural'

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
            <div className="grid gap-2 sm:grid-cols-2">
              {ls.map(l => {
                const n = byLesson.get(l.id)?.length ?? 0
                const st = stat([l.id])
                const on = sel.lessons.includes(l.id)
                return (
                  <button key={l.id} disabled={!n} onClick={() => toggle(l.id)}
                    className={`rounded-2xl border-2 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/40' : 'border-violet-100 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900'}`}>
                    <div className="flex items-center gap-2 font-extrabold">
                      <span className={`grid h-6 w-6 place-items-center rounded-lg text-sm ${on ? 'bg-violet-600 text-white' : 'bg-violet-100 dark:bg-slate-800'}`}>{on ? '✓' : ''}</span>
                      <span className="flex-1">{l.title}</span>
                      <span className="text-sm text-slate-500">{n ? cardsWord(n) : 'zatím prázdná'}</span>
                    </div>
                    {n > 0 && <ProgressBar className="mt-2" value={st.learned} max={st.total} />}
                  </button>
                )
              })}
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
