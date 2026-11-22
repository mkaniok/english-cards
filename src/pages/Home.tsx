import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { useSelection } from '../lib/selection'
import { MODES } from '../lib/exercise'
import { dayKey, streakDays } from '../lib/dates'
import { usePrefs } from '../lib/prefs'
import { plural } from '../lib/plural'
import { lessonTone, splitTitle, useLessonStats } from '../lib/lessons'
import Icon from '../components/Icon'
import Kbd from '../components/Kbd'
import PracticeSheet, { dirLabel } from '../components/PracticeSheet'

export default function Home() {
  const { profile, klass } = useAuth()
  const { loading, error, lessons, activity } = useData()
  const [sel, setSel] = useSelection()
  const [prefs] = usePrefs()
  const [sheet, setSheet] = useState(false)
  const navigate = useNavigate()
  const { stat } = useLessonStats(sel)

  const ready = !loading && sel.lessons.some(id => stat([id]).cards > 0)
  // Computer: Enter starts practising straight away.
  useEffect(() => {
    if (!ready || sheet) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement || e.target instanceof HTMLInputElement)) navigate('/practice')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, sheet, navigate])

  if (loading) return <p className="panel text-center font-bold">Načítám kartičky…</p>
  if (error) return <p className="panel text-center font-bold text-rose-600">{error}</p>

  const chosen = lessons.filter(l => sel.lessons.includes(l.id) && stat([l.id]).cards > 0)
  const s = stat(chosen.map(l => l.id))
  const today = activity.get(dayKey(new Date())) ?? 0
  const streak = streakDays(new Set(activity.keys()))
  const goalDone = today >= prefs.goal
  const title = chosen.length === 1 ? chosen[0].title.replace(/\s*[–-]\s*/, ' · ')
    : chosen.length ? chosen.map(l => splitTitle(l.title).code || l.title).join(', ') : ''
  const mode = MODES.find(m => m.id === sel.mode)

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Link to="/profile" aria-label="Profil" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-100 text-lg font-black text-violet-700 dark:bg-violet-950 dark:text-violet-200">
          {profile?.nickname.slice(0, 1).toUpperCase()}
        </Link>
        <div className="min-w-0 flex-1">
          {klass && <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{klass.name}</p>}
          <h1 className="truncate text-xl font-black">Ahoj, {profile?.nickname}!</h1>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 font-black ${streak ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' : 'bg-[#f1eefa] text-slate-500 dark:bg-slate-800'}`}
          title="Kolik dní v řadě procvičuješ">
          <Icon name="flame" size={20} className={streak ? 'text-orange-500' : ''} />{plural(streak, 'den', 'dny', 'dní')}
        </div>
      </header>

      <div className="md:grid md:grid-cols-[2fr_1fr] md:gap-4 md:space-y-0 space-y-4">
        {chosen.length ? (
          <section className="rounded-[1.75rem] bg-violet-600 p-5 text-white shadow-[0_6px_0_#5b21b6] dark:bg-violet-700 dark:shadow-[0_6px_0_#4c1d95]">
            <p className="text-xs font-black uppercase tracking-wider text-violet-100">Pokračuj, kde jsi skončil</p>
            <h2 className="mt-1 text-2xl font-black leading-tight">{title}</h2>
            <p className="mt-1 font-bold text-violet-100">{mode?.label} · {sel.mode === 'scramble' ? 'česky → anglicky' : dirLabel(sel.dir)}</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${s.total ? (s.learned / s.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-1.5 text-sm font-extrabold text-violet-100">{s.learned} z {s.total} naučeno</p>
            <div className="mt-4 flex gap-2">
              <button className="btn !min-h-14 flex-1 bg-white text-xl text-violet-700 shadow-[0_4px_0_#ddd6fe] hover:bg-violet-50 active:shadow-none" onClick={() => navigate('/practice')}>
                Pokračovat<Kbd k="Enter" />
              </button>
              <button className="btn !min-h-14 !px-4 bg-white/15 text-white hover:bg-white/25" onClick={() => setSheet(true)} aria-label="Nastavení cvičení" title="Směr, typ cvičení, délka kola">
                <Icon name="sliders" />
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-[1.75rem] bg-violet-600 p-5 text-white shadow-[0_6px_0_#5b21b6]">
            <h2 className="text-2xl font-black">Vyber si první lekci</h2>
            <p className="mt-1 font-bold text-violet-100">Pak tu bude tlačítko, kterým budeš pokračovat.</p>
            <Link to="/lessons" className="btn mt-4 !min-h-14 w-full bg-white text-xl text-violet-700 shadow-[0_4px_0_#ddd6fe]">Vybrat lekce</Link>
          </section>
        )}

        <section className="panel flex items-center gap-4 !p-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(#10b981 0 ${Math.min(1, today / prefs.goal) * 100}%, var(--ring-rest, #e9e5f7) 0 100%)` }}>
            <div className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-full bg-white text-sm font-black dark:bg-slate-900">
              {goalDone ? <Icon name="check" className="text-emerald-500" stroke={3} /> : `${today}/${prefs.goal}`}
            </div>
          </div>
          <div>
            <h2 className="font-black">Dnešní cíl</h2>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {goalDone ? 'Splněno! Můžeš pokračovat dál.' : `Ještě ${plural(prefs.goal - today, 'kartička', 'kartičky', 'kartiček')} a máš splněno.`}
            </p>
          </div>
        </section>
      </div>

      <section>
        <div className="mb-2 mt-6 flex items-baseline">
          <h2 className="flex-1 text-lg font-black">Moje lekce</h2>
          <Link to="/lessons" className="font-extrabold text-violet-700 hover:underline dark:text-violet-300">Všechny lekce</Link>
        </div>
        {chosen.length ? (
          <ul className="divide-y divide-[#f1eefa] overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_#e9e5f7] dark:divide-slate-800 dark:bg-slate-900 dark:shadow-none md:grid md:grid-cols-2 md:divide-y-0">
            {chosen.map(l => {
              const st = stat([l.id])
              const { code, name } = splitTitle(l.title)
              const done = st.total > 0 && st.learned === st.total
              return (
                <li key={l.id}>
                  <Link to="/lessons" className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-violet-50 dark:hover:bg-slate-800">
                    <span className={`grid h-10 min-w-10 place-items-center rounded-xl px-1 text-sm font-black ${lessonTone(st)}`}>{code || name.slice(0, 2)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">{name}</span>
                      <span className={`block text-sm font-bold ${done ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {done ? `Hotovo · ${st.learned}/${st.total}` : `${st.learned} z ${st.total} naučeno`}
                      </span>
                    </span>
                    <Icon name="chevron" size={20} className="text-slate-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="panel font-bold text-slate-500 dark:text-slate-400">Zatím nemáš vybranou žádnou lekci.</p>
        )}
      </section>

      {sheet && <PracticeSheet sel={sel} setSel={setSel} cards={s.cards} onClose={() => setSheet(false)} onStart={() => navigate('/practice')} />}
    </div>
  )
}
