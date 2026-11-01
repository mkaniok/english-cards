import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { dirsOf, useSelection } from '../lib/selection'
import { isLearned, nextLevel, pick, type Item } from '../lib/practice'
import { speak, speechAvailable } from '../lib/speech'
import { LEARNED, pkey, type Grade } from '../lib/types'
import ProgressBar from '../components/ProgressBar'
import Confetti from '../components/Confetti'

const GRADES: { id: Grade; label: string; emoji: string; key: string; cls: string }[] = [
  { id: 'unknown', label: 'Nevěděl', emoji: '😕', key: '1', cls: 'bg-rose-500 shadow-[0_4px_0_#be123c] hover:bg-rose-400' },
  { id: 'partial', label: 'Napůl', emoji: '🤔', key: '2', cls: 'bg-amber-500 shadow-[0_4px_0_#b45309] hover:bg-amber-400' },
  { id: 'knew', label: 'Věděl', emoji: '😎', key: '3', cls: 'bg-emerald-500 shadow-[0_4px_0_#047857] hover:bg-emerald-400' },
]

export default function Practice() {
  const { loading, cards, lessons, levels, setLevel } = useData()
  const [sel] = useSelection()
  const pool: Item[] = useMemo(() => {
    const ids = new Set(sel.lessons)
    const dirs = dirsOf(sel.dir)
    return cards.filter(c => c.status === 'approved' && ids.has(c.lesson_id)).flatMap(card => dirs.map(dir => ({ card, dir })))
  }, [cards, sel])

  const recent = useRef<string[]>([])
  const [current, setCurrent] = useState<Item | null>(() => pick(pool, levels, []))
  const [flipped, setFlipped] = useState(false)
  const [session, setSession] = useState({ answered: 0, knew: 0 })
  const [saveError, setSaveError] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [lastLevelUp, setLastLevelUp] = useState<string | null>(null)

  const learned = pool.filter(p => isLearned(levels.get(pkey(p.card.id, p.dir)))).length
  const allLearned = pool.length > 0 && learned === pool.length

  const answer = useCallback(async (grade: Grade) => {
    if (!current || !flipped) return
    const key = pkey(current.card.id, current.dir)
    const before = levels.get(key)
    const after = nextLevel(before, grade)
    const map = new Map(levels); map.set(key, after)
    setLevel(key, after)
    setSession(s => ({ answered: s.answered + 1, knew: s.knew + (grade === 'knew' ? 1 : 0) }))
    setLastLevelUp(!isLearned(before) && isLearned(after) ? current.card.en : null)
    recent.current = [...recent.current, key].slice(-5)

    const nowAll = pool.every(p => isLearned(map.get(pkey(p.card.id, p.dir))))
    if (nowAll && !allLearned) setCelebrate(true)
    setFlipped(false)
    // Let the card turn back before swapping its content.
    setTimeout(() => setCurrent(pick(pool, map, recent.current)), 180)

    const save = () => supabase.rpc('record_answer', { p_card: current.card.id, p_dir: current.dir, p_grade: grade })
    let { error } = await save()
    if (error) ({ error } = await save())
    setSaveError(!!error)
  }, [current, flipped, levels, setLevel, pool, allLearned])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
      const g = GRADES.find(g => g.key === e.key)
      if (g) answer(g.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])

  useEffect(() => {
    if (!current && pool.length) setCurrent(pick(pool, levels, recent.current))
  }, [current, pool, levels])

  if (loading) return <p className="panel text-center font-bold">Načítám kartičky…</p>
  if (!pool.length) return <Navigate to="/" replace />
  if (!current) return null

  const { card, dir } = current
  const front = dir === 'en' ? card.en : card.cz
  const back = dir === 'en' ? card.cz : card.en
  const level = levels.get(pkey(card.id, dir))
  const lessonTitle = lessons.find(l => l.id === card.lesson_id)?.title ?? ''

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {celebrate && <Confetti />}
      <div className="flex items-center gap-3">
        <Link to="/" className="btn-soft !px-3 !py-2">← Zpět</Link>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-sm font-extrabold text-slate-500 dark:text-slate-400">
            <span>Naučeno {learned} z {pool.length}</span>
            <span>Dnes: {session.knew}/{session.answered} 😎</span>
          </div>
          <ProgressBar value={learned} max={pool.length} />
        </div>
      </div>

      {celebrate && (
        <div className="panel pop text-center">
          <div className="text-5xl">🏆</div>
          <p className="mt-2 text-xl font-black">Všechno naučeno! Skvělá práce!</p>
          <p className="font-bold text-slate-500">Můžeš pokračovat v opakování, nebo si vybrat další lekci.</p>
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn-soft" onClick={() => setCelebrate(false)}>Opakovat dál</button>
            <Link className="btn-primary" to="/">Jiná lekce</Link>
          </div>
        </div>
      )}

      <div className="flip select-none" onClick={() => setFlipped(f => !f)}>
        <div className={`flip-inner relative min-h-72 cursor-pointer sm:min-h-80 ${flipped ? 'flipped' : ''}`}>
          <Face lang={dir === 'en' ? 'EN' : 'CZ'} lesson={lessonTitle} text={front} level={level}
            onSpeak={dir === 'en' && speechAvailable ? () => speak(card.en) : undefined}
            hint="Klepni pro otočení" />
          <Face back lang={dir === 'en' ? 'CZ' : 'EN'} lesson={lessonTitle} text={back} level={level} note={card.note}
            onSpeak={speechAvailable ? () => speak(card.en) : undefined} />
        </div>
      </div>

      {lastLevelUp && !flipped && <p className="pop text-center font-black text-emerald-600 dark:text-emerald-400">⭐ „{lastLevelUp}“ je naučené!</p>}

      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          {GRADES.map(g => (
            <button key={g.id} onClick={() => answer(g.id)} className={`btn flex-col !gap-0 !px-2 text-white active:shadow-none ${g.cls}`}>
              <span className="text-3xl">{g.emoji}</span>
              <span className="text-base sm:text-lg">{g.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn-primary w-full text-xl" onClick={() => setFlipped(true)}>Otočit kartičku 🔄</button>
      )}

      <p className="hidden text-center text-sm font-bold text-slate-400 sm:block">Klávesy: mezerník otočí, 1 nevěděl, 2 napůl, 3 věděl</p>
      {saveError && <p className="text-center text-sm font-bold text-rose-600">Poslední odpověď se nepodařilo uložit. Zkontroluj připojení.</p>}
    </div>
  )
}

function Face({ text, lang, lesson, level, note, hint, back, onSpeak }: {
  text: string; lang: string; lesson: string; level?: number; note?: string; hint?: string; back?: boolean; onSpeak?: () => void
}) {
  return (
    <div className={`flip-face absolute inset-0 flex flex-col rounded-[2rem] p-6 shadow-xl ring-1 ${back
      ? 'flip-back bg-gradient-to-br from-violet-600 to-indigo-600 text-white ring-violet-700'
      : 'bg-white ring-violet-100 dark:bg-slate-900 dark:ring-slate-700'}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider opacity-70">
        <span className="rounded-lg bg-black/10 px-2 py-1 dark:bg-white/10">{lang}</span>
        <span className="truncate">{lesson}</span>
        <span className="ml-auto" title="Úroveň">{Array.from({ length: LEARNED }, (_, i) => (i < (level ?? 0) ? '★' : '☆')).join('')}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[clamp(1.6rem,7vw,2.6rem)] font-black leading-tight [overflow-wrap:anywhere]">{text}</p>
        {note && <p className="mt-4 max-w-sm rounded-2xl bg-white/15 px-4 py-2 text-base font-bold">{note}</p>}
      </div>
      <div className="flex items-center justify-between text-sm font-bold opacity-70">
        <span>{hint}</span>
        {onSpeak && (
          <button onClick={e => { e.stopPropagation(); onSpeak() }} className="rounded-xl bg-black/10 px-3 py-2 text-lg opacity-100 dark:bg-white/10" aria-label="Přečíst anglicky">🔊</button>
        )}
      </div>
    </div>
  )
}
