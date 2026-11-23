import { useEffect } from 'react'
import { MODES } from '../lib/exercise'
import { ROUNDS, type DirMode, type Selection } from '../lib/selection'
import { cardsWord } from '../lib/plural'
import Icon from './Icon'

const DIRS: { id: DirMode; label: string; hint: string }[] = [
  { id: 'en', label: 'EN → CZ', hint: 'Anglicky → česky' },
  { id: 'cz', label: 'CZ → EN', hint: 'Česky → anglicky' },
  { id: 'mix', label: 'Oba', hint: 'Oba směry' },
]
export const dirLabel = (d: DirMode) => DIRS.find(x => x.id === d)?.hint.toLowerCase() ?? ''

/** "Jak chceš procvičovat?": direction, exercise type and round length, as a panel from the bottom. */
export default function PracticeSheet({ sel, setSel, cards, onClose, onStart }: {
  sel: Selection; setSel: (f: (s: Selection) => Selection) => void; cards: number; onClose: () => void; onStart: () => void
}) {
  const scramble = sel.mode === 'scramble'
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="fade-in absolute inset-0 bg-[#1e1b2e]/40" onClick={onClose} />
      <div className="sheet-up relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-2.5 dark:bg-slate-900 md:rounded-3xl md:pb-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#d9d4ea] dark:bg-slate-700 md:hidden" />
        <div className="flex items-center gap-2">
          <h2 id="sheet-title" className="flex-1 text-xl font-black">Jak chceš procvičovat?</h2>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{cardsWord(cards)}</span>
          <button onClick={onClose} aria-label="Zavřít" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-violet-50 dark:hover:bg-slate-800"><Icon name="x" /></button>
        </div>

        <h3 className="label mt-3">Směr</h3>
        <Segmented value={scramble ? 'cz' : sel.dir} disabled={scramble} onChange={d => setSel(v => ({ ...v, dir: d }))}
          options={DIRS.map(d => ({ id: d.id, label: d.label, title: d.hint }))} />
        {scramble && <p className="mt-1.5 text-sm font-bold text-slate-500 dark:text-slate-400">Skládání je vždy česky → anglicky.</p>}

        <h3 className="label mt-4">Cvičení</h3>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map(m => {
            const on = sel.mode === m.id
            return (
              <button key={m.id} onClick={() => setSel(v => ({ ...v, mode: m.id }))} aria-pressed={on} title={m.hint}
                className={`rounded-2xl border-2 p-3 text-left transition ${on ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/60' : 'border-[#ece8f8] hover:border-violet-300 dark:border-slate-700'}`}>
                <div className={`font-black ${on ? 'text-violet-700 dark:text-violet-200' : ''}`}>{m.label}</div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{m.level || 'Otočíš a ohodnotíš se'}</div>
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-sm font-bold text-slate-500 dark:text-slate-400">{MODES.find(m => m.id === sel.mode)?.hint}</p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <h3 className="font-extrabold">Délka kola</h3>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Pak uvidíš souhrn</p>
          </div>
          <Segmented value={sel.round} onChange={r => setSel(v => ({ ...v, round: r }))} options={ROUNDS.map(r => ({ id: r, label: String(r) }))} compact />
        </div>

        <button className="btn-primary mt-5 !min-h-14 w-full text-xl" onClick={onStart} disabled={!cards} autoFocus>Začít procvičovat</button>
      </div>
    </div>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, disabled, compact }: {
  value: T; options: { id: T; label: string; title?: string }[]; onChange: (v: T) => void; disabled?: boolean; compact?: boolean
}) {
  return (
    <div className={`${compact ? 'flex' : 'grid'} gap-1 rounded-2xl bg-[#f1eefa] p-1 dark:bg-slate-800`} style={compact ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={String(o.id)} onClick={() => onChange(o.id)} disabled={disabled} title={o.title} aria-pressed={on}
            className={`min-h-10 rounded-xl px-3 font-extrabold transition disabled:cursor-not-allowed ${compact ? 'min-w-11' : ''} ${on
              ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-200'
              : 'text-slate-600 hover:text-violet-700 dark:text-slate-300'} ${disabled && !on ? 'opacity-40' : ''}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
