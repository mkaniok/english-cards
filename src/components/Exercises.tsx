import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card, Dir, Grade } from '../lib/types'
import Icon from './Icon'
import Kbd from './Kbd'
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

/** Big check button pinned to the bottom of the exercise, in reach of the thumb. */
function CheckButton({ disabled, onClick, label = 'Zkontrolovat', type = 'button' }: { disabled?: boolean; onClick?: () => void; label?: string; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="btn-primary !min-h-14 flex-1 text-xl disabled:!bg-[#e9e5f7] disabled:!text-slate-400 disabled:!shadow-none dark:disabled:!bg-slate-800">
      {label}<Kbd k="Enter" light />
    </button>
  )
}
function DontKnow({ onClick }: { onClick: () => void }) {
  return <button type="button" className="btn-soft !min-h-14 !px-4" onClick={onClick}>Nevím</button>
}

export function ChoiceExercise({ card, dir, result, onAnswer, pool, all }: Props & { pool: Card[]; all: Card[] }) {
  // Options are fixed for this card; new ones only when the next card comes.
  const [options] = useState(() => choicesFor(card, dir, pool, all))
  const [picked, setPicked] = useState<number | null>(null)
  const right = answerOf(card, dir)

  const submit = () => {
    if (result || picked === null) return
    onAnswer({ grade: options[picked] === right ? 'knew' : 'unknown' })
  }

  useEffect(() => {
    if (result) return
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) setPicked(i)
      else if (e.key === 'Enter' && picked !== null) { e.preventDefault(); submit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-auto grid gap-2.5 sm:grid-cols-2">
        {options.map((o, i) => {
          const isRight = o === right
          const state = !result ? (i === picked ? 'picked' : 'idle') : isRight ? 'right' : i === picked ? 'wrong' : 'other'
          return (
            <button key={i} onClick={() => !result && setPicked(i)} disabled={!!result} aria-pressed={i === picked}
              className={`flex min-h-15 items-center gap-3 rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-lg font-extrabold transition active:translate-y-0.5 ${{
                idle: 'border-[#e5e1f2] bg-white hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
                picked: 'border-violet-500 bg-violet-50 text-violet-800 dark:border-violet-400 dark:bg-violet-950/60 dark:text-violet-100',
                right: 'pop border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
                wrong: 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
                other: 'border-[#eeebf7] bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900',
              }[state]}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-sm font-black ${state === 'picked' ? 'border-violet-300 text-violet-700 dark:text-violet-200' : 'border-[#e5e1f2] text-slate-400 dark:border-slate-700'}`}>
                {state === 'right' ? <Icon name="check" size={16} stroke={3} /> : state === 'wrong' ? <Icon name="x" size={16} stroke={3} /> : i + 1}
              </span>
              <span className="[overflow-wrap:anywhere]">{o}</span>
            </button>
          )
        })}
      </div>
      {!result && (
        <div className="mt-5 flex gap-2">
          <DontKnow onClick={() => onAnswer({ grade: 'unknown' })} />
          <CheckButton disabled={picked === null} onClick={submit} />
        </div>
      )}
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
  const box = `min(2.75rem, calc((100vw - 5rem) / ${longest}))`
  const wrong = result && result.grade !== 'knew'

  return (
    <div className="flex flex-1 flex-col">
      {/* Answer: empty dashed boxes that fill up; colour only once it is checked. */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {words.map((w, wi) => (
          <div key={wi} className="flex gap-1.5">
            {w.map((s, i) => {
              if (s.fixed) return <span key={i} style={{ width: `calc(${box} / 2)` }} className="grid place-items-center text-2xl font-black">{s.ch}</span>
              const t = placed[s.pos]
              const filled = t !== undefined
              return (
                <button key={i} onClick={() => filled && remove(s.pos)} disabled={!!result || !filled}
                  aria-label={filled ? `Vrátit písmeno ${tiles[t]}` : 'Prázdné políčko'}
                  style={{ width: box, height: `calc(${box} * 1.25)` }}
                  className={`grid place-items-center rounded-xl text-[clamp(1rem,5vw,1.6rem)] font-black transition ${
                    !filled ? 'border-2 border-dashed border-[#cfc8e8] dark:border-slate-600'
                    : !result ? 'pop border-2 border-b-4 border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-100'
                    : wrong ? 'border-2 border-b-4 border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-100'
                    : 'border-2 border-b-4 border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100'}`}>
                  {filled ? tiles[t] : ''}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {!result && (
        <>
          <div className="mt-auto flex flex-wrap justify-center gap-2.5 pt-8">
            {tiles.map((ch, i) => {
              const used = placed.includes(i)
              return (
                <button key={i} onClick={() => place(i)} disabled={used} aria-hidden={used} tabIndex={used ? -1 : 0}
                  className={`h-15 w-14 rounded-2xl border-2 border-b-[5px] text-2xl font-black transition active:translate-y-0.5 active:border-b-2 ${used
                    ? 'border-[#f1eefa] bg-[#f1eefa] text-transparent dark:border-slate-800 dark:bg-slate-800'
                    : 'border-[#e5e1f2] bg-white text-[#1e1b2e] dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}>
                  {ch}
                </button>
              )
            })}
          </div>
          <div className="mt-5 flex gap-2">
            <button className="btn-soft !min-h-14 !px-4" onClick={() => setPlaced(p => p.slice(0, -1))} disabled={!placed.length} aria-label="Vrátit poslední písmeno">
              <Icon name="undo" />
            </button>
            <button className="btn-soft !min-h-14 flex-1 text-lg" onClick={() => onAnswer({ grade: 'unknown' })}>Nevím</button>
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
    <form className="flex flex-1 flex-col" onSubmit={e => { e.preventDefault(); if (result) onNext(); else check() }}>
      <label htmlFor="answer" className="label">Tvoje odpověď</label>
      <input id="answer" ref={input} value={text} onChange={e => setText(e.target.value)} readOnly={!!result}
        lang={dir === 'en' ? 'cs' : 'en-GB'} placeholder={dir === 'en' ? 'Napiš česky…' : 'Napiš anglicky…'}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint={result ? 'next' : 'done'}
        className={`input !min-h-15 !text-2xl ${tone}`} />
      {!result && (
        <div className="mt-auto flex gap-2 pt-5">
          <DontKnow onClick={() => onAnswer({ grade: 'unknown' })} />
          <CheckButton type="submit" disabled={!text.trim()} />
        </div>
      )}
    </form>
  )
}
