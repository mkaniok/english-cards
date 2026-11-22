import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../lib/data'
import { useSelection } from '../lib/selection'
import { cardsWord } from '../lib/plural'
import { groupLessons, lessonTone, splitTitle, useLessonStats } from '../lib/lessons'
import type { Lesson } from '../lib/types'
import Icon from '../components/Icon'
import PracticeSheet from '../components/PracticeSheet'

/** All lessons, grouped by textbook and unit; tick the ones to practise, then pick how in the panel. */
export default function Lessons() {
  const { loading, error, textbooks, lessons } = useData()
  const [sel, setSel] = useSelection()
  const [sheet, setSheet] = useState(false)
  const navigate = useNavigate()
  const { stat } = useLessonStats(sel)

  if (loading) return <p className="panel text-center font-bold">Načítám lekce…</p>
  if (error) return <p className="panel text-center font-bold text-rose-600">{error}</p>

  const usable = (ids: string[]) => ids.filter(id => stat([id]).cards > 0)
  const toggle = (id: string) =>
    setSel(v => ({ ...v, lessons: v.lessons.includes(id) ? v.lessons.filter(x => x !== id) : [...v.lessons, id] }))
  const toggleAll = (ids: string[]) => {
    const all = ids.every(id => sel.lessons.includes(id))
    setSel(v => ({ ...v, lessons: all ? v.lessons.filter(x => !ids.includes(x)) : [...new Set([...v.lessons, ...ids])] }))
  }
  const chosen = usable(sel.lessons.filter(id => lessons.some(l => l.id === id)))
  const s = stat(chosen)

  const Row = ({ lesson: l }: { lesson: Lesson }) => {
    const st = stat([l.id])
    const on = sel.lessons.includes(l.id)
    const { code, name } = splitTitle(l.title)
    return (
      <button disabled={!st.cards} onClick={() => toggle(l.id)} aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-900 ${on ? 'border-violet-500 dark:border-violet-400' : 'border-[#ece8f8] hover:border-violet-300 dark:border-slate-800'}`}>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${on ? 'bg-violet-600 text-white' : 'border-2 border-[#cfc8e8] dark:border-slate-600'}`}>
          {on && <Icon name="check" size={18} stroke={3} />}
        </span>
        {code && <span className={`grid h-8 min-w-9 place-items-center rounded-lg px-1.5 text-sm font-black ${lessonTone(st)}`}>{code}</span>}
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{name}</span>
          <span className="block text-sm font-bold text-slate-500 dark:text-slate-400">
            {!st.cards ? 'prázdná' : st.learned === st.total ? `${cardsWord(st.cards)} · hotovo` : st.learned ? `${cardsWord(st.cards)} · ${st.learned} naučeno` : `${cardsWord(st.cards)} · nová`}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-5 pb-24 md:pb-20">
      <header className="flex items-center gap-3">
        <Link to="/" aria-label="Zpět" className="grid h-11 w-11 place-items-center rounded-full bg-white shadow-[0_1px_0_#e9e5f7] dark:bg-slate-900 dark:shadow-none">
          <Icon name="back" />
        </Link>
        <h1 className="flex-1 text-2xl font-black">Lekce</h1>
      </header>

      {textbooks.map(tb => {
        const ls = lessons.filter(l => l.textbook_id === tb.id)
        if (!ls.length) return null
        return (
          <section key={tb.id} className="space-y-3">
            <h2 className="text-lg font-black">{tb.title}</h2>
            {groupLessons(ls).map(g => {
              const ids = usable(g.lessons.map(l => l.id))
              return (
                <div key={g.unit ?? g.lessons[0].id}>
                  {g.unit !== null && (
                    <div className="mb-1.5 flex items-center">
                      <h3 className="flex-1 text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Lekce {g.unit}</h3>
                      {ids.length > 1 && (
                        <button onClick={() => toggleAll(ids)} className="min-h-9 px-2 text-sm font-extrabold text-violet-700 hover:underline dark:text-violet-300">
                          {ids.every(id => sel.lessons.includes(id)) ? 'Zrušit výběr' : 'Vybrat vše'}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="grid gap-2 md:grid-cols-2">
                    {g.lessons.map(l => <Row key={l.id} lesson={l} />)}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}

      <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),8px)+3.6rem)] z-10 px-4 md:bottom-6 md:left-60">
        <div className="mx-auto max-w-3xl">
          <button className="btn-primary !min-h-14 w-full text-xl" disabled={!chosen.length} onClick={() => setSheet(true)}>
            {chosen.length ? `Pokračovat · ${cardsWord(s.cards)}` : 'Vyber aspoň jednu lekci'}
          </button>
        </div>
      </div>

      {sheet && <PracticeSheet sel={sel} setSel={setSel} cards={s.cards} onClose={() => setSheet(false)} onStart={() => navigate('/practice')} />}
    </div>
  )
}
