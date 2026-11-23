import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { dirsOf, useSelection } from '../lib/selection'
import { isLearned, nextLevel, pick, type Item } from '../lib/practice'
import { speak, speechAvailable } from '../lib/speech'
import { LEARNED, pkey, type Card, type Grade } from '../lib/types'
import { streakDays } from '../lib/dates'
import { answerFeedback } from '../lib/prefs'
import ProgressBar from '../components/ProgressBar'
import Icon from '../components/Icon'
import Kbd from '../components/Kbd'
import { ChoiceExercise, ScrambleExercise, TypeExercise, type Result } from '../components/Exercises'
import Confetti from '../components/Confetti'

const GRADES: { id: Grade; label: string; key: string; cls: string }[] = [
  { id: 'unknown', label: 'Nevěděl', key: '1', cls: 'bg-rose-500 shadow-[0_4px_0_#be123c] hover:bg-rose-400' },
  { id: 'partial', label: 'Napůl', key: '2', cls: 'bg-amber-500 shadow-[0_4px_0_#b45309] hover:bg-amber-400' },
  { id: 'knew', label: 'Věděl', key: '3', cls: 'bg-emerald-500 shadow-[0_4px_0_#047857] hover:bg-emerald-400' },
]

const PROMPT = {
  flip: () => 'Víš, co to znamená?',
  choice: () => 'Vyber správný překlad',
  scramble: () => 'Slož anglické slovo',
  type: (en: boolean) => (en ? 'Napiš česky' : 'Napiš anglicky'),
}

interface RoundStats { answered: number; knew: number; learnedNow: number; missed: Card[] }
const EMPTY: RoundStats = { answered: 0, knew: 0, learnedNow: 0, missed: [] }

export default function Practice() {
  const { loading, cards, lessons, levels, setLevel, activity, addAnswer } = useData()
  const [sel] = useSelection()
  const pool: Item[] = useMemo(() => {
    const ids = new Set(sel.lessons)
    const dirs = dirsOf(sel.dir, sel.mode)
    return cards.filter(c => c.status === 'approved' && ids.has(c.lesson_id)).flatMap(card => dirs.map(dir => ({ card, dir })))
  }, [cards, sel])
  const roundSize = sel.round || 10

  const recent = useRef<string[]>([])
  const [current, setCurrent] = useState<Item | null>(() => pick(pool, levels, []))
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState<RoundStats>(EMPTY)
  const [finished, setFinished] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [lastLevelUp, setLastLevelUp] = useState<string | null>(null)
  const mode = sel.mode
  /** Outcome of a checked exercise (levels 1–3); null while the pupil is still answering. */
  const [result, setResult] = useState<Result | null>(null)
  /** Bumped for every new question so the exercise starts fresh even when the same card comes back. */
  const [round, setRound] = useState(0)
  const poolCards = useMemo(() => [...new Set(pool.map(p => p.card))], [pool])

  const learned = pool.filter(p => isLearned(levels.get(pkey(p.card.id, p.dir)))).length
  const allLearned = pool.length > 0 && learned === pool.length

  /** Saves the grade and returns the levels as they are after it. */
  const record = useCallback((grade: Grade) => {
    if (!current) return levels
    const key = pkey(current.card.id, current.dir)
    const before = levels.get(key)
    const after = nextLevel(before, grade)
    const map = new Map(levels); map.set(key, after)
    setLevel(key, after)
    addAnswer()
    const levelUp = !isLearned(before) && isLearned(after)
    setStats(s => ({
      answered: s.answered + 1,
      knew: s.knew + (grade === 'knew' ? 1 : 0),
      learnedNow: s.learnedNow + (levelUp ? 1 : 0),
      missed: grade !== 'knew' && !s.missed.includes(current.card) ? [...s.missed, current.card] : s.missed,
    }))
    setLastLevelUp(levelUp ? current.card.en : null)
    recent.current = [...recent.current, key].slice(-5)

    const { id } = current.card, dir = current.dir
    void (async () => {
      const save = () => supabase.rpc('record_answer', { p_card: id, p_dir: dir, p_grade: grade })
      let { error } = await save()
      if (error) ({ error } = await save())
      setSaveError(!!error)
    })()
    return map
  }, [current, levels, setLevel, addAnswer])

  const answer = useCallback((grade: Grade) => {
    if (!current || !flipped) return
    const map = record(grade)
    setFlipped(false)
    if (stats.answered + 1 >= roundSize) { setFinished(true); return }
    // Let the card turn back before swapping its content.
    setTimeout(() => setCurrent(pick(pool, map, recent.current)), 180)
  }, [current, flipped, record, pool, stats.answered, roundSize])

  const check = useCallback((r: Result) => {
    if (result) return
    setResult(r)
    record(r.grade)
    answerFeedback(r.grade === 'knew' ? true : r.grade === 'partial' ? 'partial' : false)
  }, [result, record])

  // levels already hold the last answer by the time the pupil asks for the next card.
  const next = useCallback(() => {
    setResult(null)
    if (stats.answered >= roundSize) { setFinished(true); return }
    setRound(n => n + 1)
    setCurrent(pick(pool, levels, recent.current))
  }, [pool, levels, stats.answered, roundSize])

  const again = useCallback(() => {
    setStats(EMPTY); setFinished(false); setResult(null); setFlipped(false); setLastLevelUp(null)
    setRound(n => n + 1)
    setCurrent(pick(pool, levels, recent.current))
  }, [pool, levels])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (finished) {
        if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) { e.preventDefault(); again() }
        return
      }
      // A focused button already reacts to Enter and space by itself.
      if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return
      if (mode !== 'flip') {
        if (result && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next() }
        return
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
      const g = GRADES.find(g => g.key === e.key)
      if (g) answer(g.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, mode, result, next, finished, again])

  useEffect(() => {
    if (!current && pool.length) setCurrent(pick(pool, levels, recent.current))
  }, [current, pool, levels])

  if (loading) return <p className="m-auto font-bold text-slate-500">Načítám kartičky…</p>
  if (!pool.length) return <Navigate to="/" replace />
  if (!current) return null

  const { card, dir } = current
  const front = dir === 'en' ? card.en : card.cz
  const back = dir === 'en' ? card.cz : card.en
  const level = levels.get(pkey(card.id, dir))
  const lessonTitle = lessons.find(l => l.id === card.lesson_id)?.title ?? ''
  const shown = Math.min(stats.answered + (result ? 0 : 1), roundSize)

  return (
    <>
      <div className="flex items-center gap-3 py-2">
        <Link to="/" aria-label="Ukončit kolo" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-violet-100 dark:hover:bg-slate-800">
          <Icon name="x" size={26} stroke={2.6} />
        </Link>
        <ProgressBar className="!h-4 flex-1" value={finished ? roundSize : stats.answered} max={roundSize} />
        <span className="w-12 text-right text-sm font-black tabular-nums text-slate-500">{finished ? roundSize : shown}/{roundSize}</span>
      </div>

      {finished ? (
        <Summary stats={stats} roundSize={roundSize} streak={streakDays(new Set(activity.keys()))} allLearned={allLearned} onAgain={again} />
      ) : (<>
        <p className="mt-5 text-xl font-black">{PROMPT[mode](dir === 'en')}</p>

        {mode === 'flip' ? (<>
          <div className="flip mt-4 select-none" onClick={() => setFlipped(f => !f)}>
            <div className={`flip-inner relative min-h-72 cursor-pointer sm:min-h-80 ${flipped ? 'flipped' : ''}`}>
              <Face lang={dir === 'en' ? 'EN' : 'CZ'} lesson={lessonTitle} text={front} level={level}
                onSpeak={dir === 'en' && speechAvailable ? () => speak(card.en) : undefined}
                hint="Klepni pro otočení" />
              <Face back lang={dir === 'en' ? 'CZ' : 'EN'} lesson={lessonTitle} text={back} level={level} note={card.note}
                onSpeak={speechAvailable ? () => speak(card.en) : undefined} />
            </div>
          </div>
          {lastLevelUp && !flipped && <p className="pop mt-3 text-center font-black text-emerald-600 dark:text-emerald-400">„{lastLevelUp}“ je naučené!</p>}

          <div className="mt-auto pt-6">
            {flipped ? (
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map(g => (
                  <button key={g.id} onClick={() => answer(g.id)} className={`btn !min-h-14 !px-2 text-lg text-white active:shadow-none ${g.cls}`}>
                    {g.label}<Kbd k={g.key} light />
                  </button>
                ))}
              </div>
            ) : (
              <button className="btn-primary !min-h-14 w-full text-xl" onClick={() => setFlipped(true)}>
                <Icon name="flip" />Otočit kartičku<Kbd k="mezerník" light />
              </button>
            )}
          </div>
        </>) : (<>
          <div className="mt-4 flex items-center gap-4">
            {speechAvailable && dir === 'en' && (
              <button onClick={() => speak(card.en)} aria-label="Přečíst anglicky"
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-[0_4px_0_#5b21b6] active:translate-y-1 active:shadow-none">
                <Icon name="speaker" size={30} />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[clamp(1.8rem,8vw,2.4rem)] font-black leading-tight [overflow-wrap:anywhere]">{front}</p>
              <p className="mt-0.5 text-sm font-bold text-slate-500 dark:text-slate-400">{lessonTitle}<span className="ml-2 tracking-widest" title="Úroveň">{stars(level)}</span></p>
            </div>
          </div>

          <div className="flex flex-1 flex-col pt-6">
            {mode === 'choice' && <ChoiceExercise key={round} card={card} dir={dir} result={result} onAnswer={check} onNext={next} pool={poolCards} all={cards} />}
            {mode === 'scramble' && <ScrambleExercise key={round} card={card} dir={dir} result={result} onAnswer={check} onNext={next} />}
            {mode === 'type' && <TypeExercise key={round} card={card} dir={dir} result={result} onAnswer={check} onNext={next} />}
          </div>
          {/* Keeps the content clear of the feedback panel. */}
          {result && <div className="h-64 shrink-0" />}
        </>)}

        {result && <Feedback result={result} answer={back} card={card} lastLevelUp={lastLevelUp} onNext={next} />}
      </>)}

      {saveError && <p className="mt-2 text-center text-sm font-bold text-rose-600">Poslední odpověď se nepodařilo uložit. Zkontroluj připojení.</p>}
    </>
  )
}

const stars = (level?: number) => Array.from({ length: LEARNED }, (_, i) => (i < (level ?? 0) ? '★' : '☆')).join('')

const TONES = {
  knew: { box: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100', dot: 'bg-emerald-500', btn: 'bg-emerald-500 shadow-[0_4px_0_#047857] hover:bg-emerald-400', title: 'Výborně!' },
  partial: { box: 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100', dot: 'bg-amber-500', btn: 'bg-amber-500 shadow-[0_4px_0_#b45309] hover:bg-amber-400', title: 'Skoro!' },
  unknown: { box: 'bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100', dot: 'bg-rose-600', btn: 'bg-rose-600 shadow-[0_4px_0_#9f1239] hover:bg-rose-500', title: 'Tohle nebylo ono' },
}

/** Coloured panel from the bottom edge: the result and the button to go on, right under the thumb. */
function Feedback({ result, answer, card, lastLevelUp, onNext }: {
  result: Result; answer: string; card: Card; lastLevelUp: string | null; onNext: () => void
}) {
  const t = TONES[result.grade]
  return (
    <div role="status" className={`sheet-up fixed inset-x-0 bottom-0 z-30 rounded-t-3xl px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-5 ${t.box}`}>
      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${t.dot}`}>
            <Icon name={result.grade === 'unknown' ? 'x' : 'check'} stroke={3} />
          </span>
          <p className="flex-1 text-2xl font-black">{t.title}</p>
          {speechAvailable && (
            <button onClick={() => speak(card.en)} aria-label="Přečíst anglicky" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/5 dark:bg-white/10">
              <Icon name="speaker" size={22} />
            </button>
          )}
        </div>
        {result.hint && <p className="font-bold">{result.hint.replace(/^Skoro!\s*/, '')}</p>}
        <p className="text-lg font-bold">
          {result.grade === 'knew' ? <>{card.en} = {card.cz}</> : <>Správně: <span className="font-black">{answer}</span></>}
        </p>
        {card.note && <p className="rounded-2xl bg-white/60 px-4 py-2 font-bold dark:bg-black/20">{card.note}</p>}
        {lastLevelUp && <p className="font-black">„{lastLevelUp}“ je naučené, 3× správně za sebou!</p>}
        <button className={`btn !min-h-14 w-full text-xl text-white active:shadow-none ${t.btn}`} onClick={onNext}>
          {result.grade === 'unknown' ? 'Rozumím' : 'Pokračovat'}<Kbd k="Enter" light />
        </button>
      </div>
    </div>
  )
}

function Summary({ stats, roundSize, streak, allLearned, onAgain }: {
  stats: RoundStats; roundSize: number; streak: number; allLearned: boolean; onAgain: () => void
}) {
  const good = stats.knew / Math.max(1, stats.answered) >= 0.8
  return (
    <div className="fade-in flex flex-1 flex-col pt-8">
      {good && <Confetti />}
      <div className="pop mx-auto grid h-28 w-28 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
        <Icon name="trophy" size={60} stroke={1.8} />
      </div>
      <h1 className="mt-5 text-center text-3xl font-black">{allLearned ? 'Všechno naučeno!' : good ? 'Skvělé kolo!' : 'Kolo dokončeno!'}</h1>
      <p className="mt-1 text-center font-bold text-slate-500 dark:text-slate-400">
        {allLearned ? 'Můžeš opakovat dál, nebo si vybrat další lekci.' : good ? 'Jen tak dál.' : 'Chybami se učíš. Zkus další kolo.'}
      </p>

      <div className="mt-7 grid grid-cols-3 gap-2.5">
        <Stat label="Správně" value={`${stats.knew}/${roundSize}`} cls="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300" />
        <Stat label="Naučeno" value={`+${stats.learnedNow}`} cls="border-violet-200 text-violet-700 dark:border-violet-900 dark:text-violet-300" />
        <Stat label="Série" value={`${streak} ${streak === 1 ? 'den' : streak >= 2 && streak <= 4 ? 'dny' : 'dní'}`} cls="border-orange-200 text-orange-700 dark:border-orange-900 dark:text-orange-300" />
      </div>

      {stats.missed.length > 0 && (
        <section className="mt-6">
          <h2 className="font-black">Tyhle si zopakuj</h2>
          <ul className="mt-2 divide-y divide-[#e9e5f7] rounded-2xl bg-white px-4 dark:divide-slate-800 dark:bg-slate-900">
            {stats.missed.slice(0, 6).map(c => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 font-black">{c.en}</span>
                <span className="flex-1 text-right font-bold text-slate-500 dark:text-slate-400">{c.cz}</span>
                {speechAvailable && <button onClick={() => speak(c.en)} aria-label={`Přečíst ${c.en}`} className="grid h-10 w-10 place-items-center rounded-xl text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-slate-800"><Icon name="speaker" size={20} /></button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-auto space-y-2 bg-[#f7f5ff] px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-4 dark:bg-[#0b0a14]">
        <button className="btn-primary !min-h-14 w-full text-xl" onClick={onAgain}>Další kolo<Kbd k="Enter" light /></button>
        <Link to="/" className="btn !min-h-12 w-full text-lg text-violet-700 dark:text-violet-300">Hotovo</Link>
      </div>
    </div>
  )
}

function Stat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`rounded-2xl border-2 px-1 py-3 text-center ${cls}`}>
      <div className="text-xs font-black uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 text-2xl font-black text-[#1e1b2e] dark:text-white">{value}</div>
    </div>
  )
}

function Face({ text, lang, lesson, level, note, hint, back, onSpeak }: {
  text: string; lang: string; lesson: string; level?: number; note?: string; hint?: string; back?: boolean; onSpeak?: () => void
}) {
  return (
    <div className={`flip-face absolute inset-0 flex flex-col rounded-[2rem] p-6 ${back
      ? 'flip-back bg-violet-600 text-white shadow-[0_6px_0_#5b21b6]'
      : 'border-2 border-[#e5e1f2] bg-white shadow-[0_6px_0_#e5e1f2] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_6px_0_#1e293b]'}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider opacity-70">
        <span className="rounded-lg bg-black/10 px-2 py-1 dark:bg-white/10">{lang}</span>
        <span className="truncate">{lesson}</span>
        <span className="ml-auto" title="Úroveň">{stars(level)}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[clamp(1.6rem,7vw,2.6rem)] font-black leading-tight [overflow-wrap:anywhere]">{text}</p>
        {note && <p className="mt-4 max-w-sm rounded-2xl bg-white/15 px-4 py-2 text-base font-bold">{note}</p>}
      </div>
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="opacity-70">{hint}</span>
        {onSpeak && (
          <button onClick={e => { e.stopPropagation(); onSpeak() }} className="grid h-11 w-11 place-items-center rounded-xl bg-black/10 dark:bg-white/10" aria-label="Přečíst anglicky">
            <Icon name="speaker" size={22} />
          </button>
        )}
      </div>
    </div>
  )
}
