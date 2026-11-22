import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Dir, Grade } from '../lib/types'
import { answerOf, checkTyped, choicesFor, scrambledLetters, scrambleTarget, slotsOf } from '../lib/exercise'

export interface Result { grade: Grade; hint?: string }

interface Props {
  card: Card
  dir: Dir
  /** Set once answered; the exercise then shows what was right and wrong. */
  result: Result | null
  onAnswer: (r: Result) => void
  onNext: () => void
}

const LETTER_KEY = /^[\p{L}\p{N}]$/u
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ---------- Level 1: multiple choice ----------

export function ChoiceExercise({ card, dir, result, onAnswer, pool, all }: Props & { pool: Card[]; all: Card[] }) {
  // Options are fixed for this card; new ones only when the next card comes.
  const [options] = useState(() => choicesFor(card, dir, pool, all))
  const [picked, setPicked] = useState<number | null>(null)
  const right = answerOf(card, dir)

  const choose = (i: number) => {
    if (result) return
    setPicked(i)
    onAnswer({ grade: options[i] === right ? 'knew' : 'unknown' })
  }

  useEffect(() => {
    if (result) return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) choose(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o, i) => {
        const isRight = o === right
        const state = !result ? 'idle' : isRight ? 'right' : i === picked ? 'wrong' : 'other'
        return (
          <button key={i} onClick={() => choose(i)} disabled={!!result}
            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-extrabold transition active:scale-[.98] ${{
              idle: 'border-violet-100 bg-white hover:border-violet-400 dark:border-slate-700 dark:bg-slate-900',
              right: 'pop border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
              wrong: 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
              other: 'border-violet-100 bg-white opacity-50 dark:border-slate-700 dark:bg-slate-900',
            }[state]}`}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-100 text-sm font-black text-violet-700 dark:bg-slate-800 dark:text-violet-300">
              {state === 'right' ? '✓' : state === 'wrong' ? '✗' : i + 1}
            </span>
            <span className="[overflow-wrap:anywhere]">{o}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------- Level 2: letter scramble ----------

export function ScrambleExercise({ card, result, onAnswer }: Props) {
  const target = useMemo(() => scrambleTarget(card.en), [card.en])
  const slots = useMemo(() => slotsOf(target), [target])
  const [tiles] = useState(() => scrambledLetters(target))
  /** Indexes into tiles, in the order the pupil placed them. */
  const [placed, setPlaced] = useState<number[]>([])
  const letterCount = tiles.length

  const place = (t: number) => {
    if (result || placed.includes(t)) return
    const next = [...placed, t]
    setPlaced(next)
    if (next.length === letterCount) {
      const built = next.map(i => tiles[i]).join('')
      const want = slots.filter(s => !s.fixed).map(s => s.ch).join('')
      onAnswer({ grade: built.toLowerCase() === want.toLowerCase() ? 'knew' : 'unknown' })
    }
  }
  const remove = (pos: number) => { if (!result) setPlaced(p => p.filter((_, i) => i !== pos)) }

  useEffect(() => {
    if (result) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Backspace') { e.preventDefault(); setPlaced(p => p.slice(0, -1)); return }
      if (!LETTER_KEY.test(e.key)) return
      const t = tiles.findIndex((ch, i) => !placed.includes(i) && fold(ch) === fold(e.key))
      if (t >= 0) place(t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Split into words so a long phrase wraps between words, never inside one.
  const words: { ch: string; fixed: boolean; pos: number }[][] = [[]]
  let pos = 0
  for (const s of slots) {
    if (s.fixed && s.ch === ' ') { words.push([]); continue }
    words[words.length - 1].push({ ch: s.ch, fixed: s.fixed, pos: s.fixed ? -1 : pos++ })
  }
  const longest = Math.max(...words.map(w => w.length))
  const box = `min(2.6rem, calc((100vw - 5rem) / ${longest}))`
  const wrong = result && result.grade !== 'knew'

  return (
    <div className="panel space-y-5">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {words.map((w, wi) => (
          <div key={wi} className="flex gap-1">
            {w.map((s, i) => {
              if (s.fixed) return <span key={i} style={{ width: `calc(${box} / 2)` }} className="grid place-items-center text-2xl font-black">{s.ch}</span>
              const t = placed[s.pos]
              const filled = t !== undefined
              return (
                <button key={i} onClick={() => filled && remove(s.pos)} disabled={!!result || !filled}
                  style={{ width: box, height: `calc(${box} * 1.25)` }}
                  className={`grid place-items-center rounded-xl border-b-4 text-[clamp(1rem,5vw,1.6rem)] font-black transition ${
                    !filled ? 'border-violet-300 bg-violet-50 dark:border-slate-600 dark:bg-slate-800'
                    : !result ? 'pop border-violet-700 bg-violet-600 text-white'
                    : wrong ? 'border-rose-700 bg-rose-500 text-white' : 'border-emerald-700 bg-emerald-500 text-white'}`}>
                  {filled ? tiles[t] : ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {!result && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {tiles.map((ch, i) => {
              const used = placed.includes(i)
              return (
                <button key={i} onClick={() => place(i)} disabled={used} aria-hidden={used}
                  className={`h-12 w-12 rounded-2xl bg-white text-2xl font-black text-violet-800 shadow-[0_4px_0_#c4b5fd] ring-2 ring-violet-200 transition active:translate-y-1 active:shadow-none dark:bg-slate-900 dark:text-violet-200 dark:shadow-[0_4px_0_#4c1d95] dark:ring-slate-700 ${used ? 'invisible' : ''}`}>
                  {ch}
                </button>
              )
            })}
          </div>
          <div className="flex justify-center gap-2 whitespace-nowrap">
            <button className="btn-soft !px-4 !py-2" onClick={() => setPlaced(p => p.slice(0, -1))} disabled={!placed.length} aria-label="Vrátit poslední písmeno">⌫</button>
            <button className="btn-soft !px-4 !py-2" onClick={() => setPlaced([])} disabled={!placed.length}>Smazat</button>
            <button className="btn-soft !px-4 !py-2" onClick={() => onAnswer({ grade: 'unknown' })}>Nevím 🤷</button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Level 3: typing ----------

export function TypeExercise({ card, dir, result, onAnswer, onNext }: Props) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])

  const check = () => {
    if (result) return
    onAnswer(text.trim() ? checkTyped(text, answerOf(card, dir), dir) : { grade: 'unknown' })
  }

  const tone = !result ? '' : result.grade === 'knew' ? '!border-emerald-500 !bg-emerald-50 dark:!bg-emerald-950/50'
    : result.grade === 'partial' ? '!border-amber-500 !bg-amber-50 dark:!bg-amber-950/50' : '!border-rose-500 !bg-rose-50 dark:!bg-rose-950/50'

  return (
    <form className="space-y-2" onSubmit={e => { e.preventDefault(); if (result) onNext(); else check() }}>
      <input ref={input} value={text} onChange={e => setText(e.target.value)} readOnly={!!result}
        lang={dir === 'en' ? 'cs' : 'en-GB'} placeholder={dir === 'en' ? 'Napiš česky…' : 'Napiš anglicky…'}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint={result ? 'next' : 'done'}
        className={`input text-center !text-2xl ${tone}`} />
      {!result && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button type="submit" className="btn-primary text-lg">Zkontrolovat ✔️</button>
          <button type="button" className="btn-soft" onClick={() => onAnswer({ grade: 'unknown' })}>Nevím 🤷</button>
        </div>
      )}
    </form>
  )
}
