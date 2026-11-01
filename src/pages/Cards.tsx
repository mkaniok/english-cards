import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { supabase } from '../lib/supabase'
import { applyFix, checkGrammar, checkMany, norm, parseLine, type Match } from '../lib/grammar'
import type { Card } from '../lib/types'
import GrammarHints from '../components/GrammarHints'
import { cardsWord } from '../lib/plural'

export default function Cards() {
  const { profile } = useAuth()
  const editor = profile?.role !== 'student'
  const { textbooks, lessons } = useData()
  const [lessonId, setLessonId] = useState(() => localStorage.getItem('ec.editLesson') ?? '')
  const lesson = lessons.find(l => l.id === lessonId)

  useEffect(() => {
    if (!lesson && lessons.length) {
      const tb = textbooks[0]
      setLessonId((lessons.find(l => l.textbook_id === tb?.id) ?? lessons[0]).id)
    }
  }, [lesson, lessons, textbooks])
  useEffect(() => { if (lessonId) localStorage.setItem('ec.editLesson', lessonId) }, [lessonId])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">{editor ? '🗂️ Kartičky a lekce' : '💡 Navrhnout kartičku'}</h1>
      {!editor && (
        <p className="panel font-bold text-slate-600 dark:text-slate-300">
          Chybí ti v lekci nějaké slovíčko? Navrhni ho. Jakmile ho správce zkontroluje a schválí, objeví se všem v procvičování.
        </p>
      )}
      <LessonPicker lessonId={lessonId} setLessonId={setLessonId} editor={editor} />
      {lesson && <AddCard lessonId={lesson.id} editor={editor} />}
      {lesson && editor && <BulkImport lessonId={lesson.id} />}
      <Pending editor={editor} />
      {lesson && <CardList lessonId={lesson.id} editor={editor} />}
    </div>
  )
}

function LessonPicker({ lessonId, setLessonId, editor }: { lessonId: string; setLessonId: (id: string) => void; editor: boolean }) {
  const { textbooks, lessons, cards, reload } = useData()
  const lesson = lessons.find(l => l.id === lessonId)
  const [mode, setMode] = useState<'' | 'lesson' | 'rename' | 'book'>('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const title = name.trim()
    if (!title) return
    setErr('')
    let error
    if (mode === 'lesson' && lesson) {
      const pos = Math.max(-1, ...lessons.filter(l => l.textbook_id === lesson.textbook_id).map(l => l.position)) + 1
      const r = await supabase.from('lessons').insert({ textbook_id: lesson.textbook_id, title, position: pos }).select().single()
      error = r.error
      if (r.data) setLessonId(r.data.id)
    } else if (mode === 'rename' && lesson) {
      error = (await supabase.from('lessons').update({ title }).eq('id', lesson.id)).error
    } else if (mode === 'book') {
      const pos = Math.max(0, ...textbooks.map(t => t.position)) + 1
      const r = await supabase.from('textbooks').insert({ title, position: pos }).select().single()
      error = r.error
      if (r.data) {
        const l = await supabase.from('lessons').insert({ textbook_id: r.data.id, title: 'Lekce 1', position: 0 }).select().single()
        if (l.data) setLessonId(l.data.id)
      }
    }
    if (error) return setErr('Uložení se nepovedlo.')
    setMode(''); setName('')
    await reload()
  }

  const removeLesson = async () => {
    if (!lesson) return
    if (cards.some(c => c.lesson_id === lesson.id)) return setErr('Smazat jde jen prázdnou lekci.')
    const { error } = await supabase.from('lessons').delete().eq('id', lesson.id)
    if (error) return setErr('Smazání se nepovedlo.')
    setLessonId('')
    await reload()
  }

  return (
    <section className="panel space-y-3">
      <label className="label" htmlFor="lesson">Lekce</label>
      <select id="lesson" className="input" value={lessonId} onChange={e => setLessonId(e.target.value)}>
        {textbooks.map(tb => (
          <optgroup key={tb.id} label={tb.title}>
            {lessons.filter(l => l.textbook_id === tb.id).map(l => (
              <option key={l.id} value={l.id}>{l.title} ({cards.filter(c => c.lesson_id === l.id && c.status === 'approved').length})</option>
            ))}
          </optgroup>
        ))}
      </select>
      {editor && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-soft !py-2 text-sm" onClick={() => { setMode('lesson'); setName('') }}>+ Nová lekce</button>
          <button className="btn-soft !py-2 text-sm" onClick={() => { setMode('rename'); setName(lesson?.title ?? '') }}>✏️ Přejmenovat</button>
          <button className="btn-soft !py-2 text-sm" onClick={() => { setMode('book'); setName('') }}>+ Nová učebnice</button>
          <button className="btn-danger !py-2 text-sm" onClick={removeLesson}>Smazat prázdnou lekci</button>
        </div>
      )}
      {mode && (
        <form onSubmit={save} className="flex gap-2">
          <input autoFocus className="input" value={name} onChange={e => setName(e.target.value)}
            placeholder={mode === 'book' ? 'Název učebnice' : 'Název lekce, např. Unit 1 – My family'} />
          <button className="btn-primary">Uložit</button>
          <button type="button" className="btn-soft" onClick={() => setMode('')}>✕</button>
        </form>
      )}
      {err && <p className="font-bold text-rose-600">{err}</p>}
    </section>
  )
}

function AddCard({ lessonId, editor }: { lessonId: string; editor: boolean }) {
  const { profile } = useAuth()
  const { cards, reload } = useData()
  const [en, setEn] = useState('')
  const [cz, setCz] = useState('')
  const [note, setNote] = useState('')
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const duplicate = cards.find(c => c.lesson_id === lessonId && norm(c.en) === norm(en))
  const reset = () => { setMatches(null); setMsg(null) }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!en.trim() || !cz.trim()) return
    setBusy(true)
    try {
      if (matches === null) {
        // First press: run the check. Save straight away only if there is nothing to look at.
        let found: Match[] = []
        try { found = await checkGrammar(en.trim()) } catch {
          setMsg({ ok: false, text: 'Kontrola gramatiky teď nefunguje, zkontroluj kartičku sám.' })
        }
        setMatches(found)
        if (found.length || duplicate) return
      }
      const { error } = await supabase.from('cards').insert({
        lesson_id: lessonId, en: en.trim(), cz: cz.trim(), note: note.trim(),
        status: editor ? 'approved' : 'pending', created_by: profile!.id,
      })
      if (error) throw error
      setEn(''); setCz(''); setNote(''); setMatches(null)
      setMsg({ ok: true, text: editor ? 'Kartička je uložená ✅' : 'Díky! Návrh čeká na schválení ✅' })
      await reload()
    } catch {
      setMsg({ ok: false, text: 'Uložení se nepovedlo.' })
    } finally {
      setBusy(false)
    }
  }

  const needsLook = (matches?.length ?? 0) > 0 || !!duplicate
  return (
    <section className="panel">
      <h2 className="label">{editor ? 'Nová kartička' : 'Návrh kartičky'}</h2>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <input className="input" value={en} onChange={e => { setEn(e.target.value); reset() }} placeholder="🇬🇧 anglicky, např. a pencil case" lang="en-GB" spellCheck required />
        </div>
        {matches && <GrammarHints text={en} matches={matches} onFix={(m, r) => { setEn(applyFix(en, m, r)); setMatches(null) }} />}
        {matches && !matches.length && en.trim() && <p className="text-sm font-bold text-emerald-600">✓ Gramatika v pořádku</p>}
        {duplicate && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold dark:bg-amber-950/40">⚠️ Tahle kartička už v lekci je: {duplicate.en} = {duplicate.cz}</p>}
        <input className="input" value={cz} onChange={e => { setCz(e.target.value); setMsg(null) }} placeholder="🇨🇿 česky, např. penál" required />
        <input className="input !text-base" value={note} onChange={e => setNote(e.target.value)} placeholder="Poznámka nebo příkladová věta (nepovinné)" />
        <button className="btn-primary w-full" disabled={busy || !en.trim() || !cz.trim()}>
          {busy ? 'Kontroluji…' : matches === null ? 'Zkontrolovat a uložit' : needsLook ? 'Uložit i tak' : 'Uložit'}
        </button>
        {msg && <p className={`pop font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
      </form>
    </section>
  )
}

interface Row { en: string; cz: string; note: string; matches: Match[]; dup: boolean; include: boolean }

function BulkImport({ lessonId }: { lessonId: string }) {
  const { profile } = useAuth()
  const { cards, reload } = useData()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [bad, setBad] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const check = async () => {
    setBusy(true); setMsg('')
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed = lines.map(parseLine)
    setBad(lines.filter((_, i) => !parsed[i]))
    const ok = parsed.filter((p): p is NonNullable<typeof p> => !!p)
    const existing = new Set(cards.filter(c => c.lesson_id === lessonId).map(c => norm(c.en)))
    let found: Match[][] = ok.map(() => [])
    try { found = await checkMany(ok.map(o => o.en)) } catch { setMsg('Kontrola gramatiky teď nefunguje, zkontroluj řádky sám.') }
    const seen = new Set<string>()
    setRows(ok.map((o, i) => {
      const dup = existing.has(norm(o.en)) || seen.has(norm(o.en))
      seen.add(norm(o.en))
      return { ...o, matches: found[i] ?? [], dup, include: !dup }
    }))
    setBusy(false)
  }

  const save = async () => {
    const chosen = (rows ?? []).filter(r => r.include)
    if (!chosen.length) return
    setBusy(true)
    const { error } = await supabase.from('cards').insert(chosen.map(r => ({
      lesson_id: lessonId, en: r.en.trim(), cz: r.cz.trim(), note: r.note, status: 'approved', created_by: profile!.id,
    })))
    setBusy(false)
    if (error) return setMsg('Uložení se nepovedlo.')
    setMsg(`Uloženo: ${cardsWord(chosen.length)} ✅`)
    setRows(null); setText('')
    await reload()
  }

  const update = (i: number, patch: Partial<Row>) => setRows(rs => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  if (!open) return <button className="btn-soft w-full" onClick={() => setOpen(true)}>📋 Hromadný import (třeba celý seznam z učebnice)</button>
  return (
    <section className="panel space-y-3">
      <h2 className="label">Hromadný import</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">Každá kartička na vlastní řádek: <b>anglicky ; česky ; poznámka</b>. Místo středníku můžeš použít tabulátor (kopírování z Excelu) nebo pomlčku s mezerami.</p>
      {!rows && (
        <>
          <textarea className="input min-h-40 font-mono !text-base" value={text} onChange={e => setText(e.target.value)} lang="en-GB"
            placeholder={'a pencil case ; penál\na rubber ; guma ; British English (US: eraser)\na ruler - pravítko'} />
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy || !text.trim()} onClick={check}>{busy ? 'Kontroluji…' : 'Zkontrolovat'}</button>
            <button className="btn-soft" onClick={() => setOpen(false)}>Zavřít</button>
          </div>
        </>
      )}
      {bad.length > 0 && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Tyhle řádky jsem nepochopil (chybí oddělovač): {bad.join(' | ')}</p>}
      {rows && (
        <>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className={`rounded-2xl border-2 p-3 ${r.include ? 'border-violet-200 dark:border-slate-700' : 'border-dashed border-slate-200 opacity-60 dark:border-slate-800'}`}>
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-2 h-5 w-5 accent-violet-600" checked={r.include} onChange={e => update(i, { include: e.target.checked })} />
                  <div className="flex-1 space-y-1">
                    <input className="input !py-1 !text-base" value={r.en} onChange={e => update(i, { en: e.target.value })} lang="en-GB" />
                    <div className="text-sm font-bold text-slate-600 dark:text-slate-400">{r.cz}{r.note && <span className="font-normal"> · {r.note}</span>}</div>
                    {r.dup && <p className="text-sm font-bold text-amber-600">⚠️ Už v lekci je</p>}
                    <GrammarHints text={r.en} matches={r.matches} onFix={(m, rep) => update(i, { en: applyFix(r.en, m, rep), matches: r.matches.filter(x => x !== m).map(x => x.offset > m.offset ? { ...x, offset: x.offset + rep.length - m.length } : x) })} />
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={save}>Uložit {cardsWord(rows.filter(r => r.include).length)}</button>
            <button className="btn-soft" onClick={() => setRows(null)}>Zpět</button>
          </div>
        </>
      )}
      {msg && <p className="font-bold text-violet-700 dark:text-violet-300">{msg}</p>}
    </section>
  )
}

function Pending({ editor }: { editor: boolean }) {
  const { profile } = useAuth()
  const { cards, lessons, reload } = useData()
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const pending = useMemo(() => cards.filter(c => c.status === 'pending' && (editor || c.created_by === profile?.id)), [cards, editor, profile])

  useEffect(() => {
    if (!editor || !pending.length) return
    supabase.from('profiles').select('id, nickname').then(({ data }) => setNames(new Map((data ?? []).map(p => [p.id, p.nickname]))))
  }, [editor, pending.length])

  if (!pending.length) return null
  const act = async (c: Card, approve: boolean) => {
    if (approve) await supabase.from('cards').update({ status: 'approved' }).eq('id', c.id)
    else await supabase.from('cards').delete().eq('id', c.id)
    await reload()
  }
  return (
    <section className="panel">
      <h2 className="label">{editor ? `Návrhy ke schválení (${pending.length})` : 'Moje návrhy čekající na schválení'}</h2>
      <ul className="divide-y divide-violet-100 dark:divide-slate-800">
        {pending.map(c => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-40 flex-1">
              <div className="font-extrabold">{c.en} = {c.cz}</div>
              <div className="text-sm text-slate-500">{lessons.find(l => l.id === c.lesson_id)?.title}{editor && c.created_by && ` · navrhl(a) ${names.get(c.created_by) ?? '…'}`}</div>
            </div>
            {editor && <button className="btn-primary !px-3 !py-2 text-sm" onClick={() => act(c, true)}>✓ Schválit</button>}
            <button className="btn-danger !px-3 !py-2 text-sm" onClick={() => act(c, false)}>{editor ? 'Zamítnout' : 'Zrušit'}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CardList({ lessonId, editor }: { lessonId: string; editor: boolean }) {
  const { cards } = useData()
  const list = cards.filter(c => c.lesson_id === lessonId && c.status === 'approved')
  return (
    <section className="panel">
      <h2 className="label">Kartičky v lekci ({list.length})</h2>
      {!list.length ? <p className="font-bold text-slate-500">Lekce je zatím prázdná.</p> : (
        <ul className="divide-y divide-violet-100 dark:divide-slate-800">
          {list.map(c => <CardRow key={c.id} card={c} editor={editor} />)}
        </ul>
      )}
    </section>
  )
}

function CardRow({ card, editor }: { card: Card; editor: boolean }) {
  const { reload } = useData()
  const [edit, setEdit] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [v, setV] = useState({ en: card.en, cz: card.cz, note: card.note })
  const [matches, setMatches] = useState<Match[]>([])
  const [err, setErr] = useState('')

  const save = async () => {
    setErr('')
    const { error } = await supabase.from('cards').update({ en: v.en.trim(), cz: v.cz.trim(), note: v.note.trim() }).eq('id', card.id)
    if (error) return setErr('Uložení se nepovedlo.')
    setEdit(false)
    await reload()
  }
  const remove = async () => {
    const { error } = await supabase.from('cards').delete().eq('id', card.id)
    if (error) return setErr('Smazání se nepovedlo.')
    await reload()
  }

  if (edit) return (
    <li className="space-y-2 py-3">
      <input className="input !py-2 !text-base" value={v.en} onChange={e => { setV({ ...v, en: e.target.value }); setMatches([]) }} lang="en-GB" />
      <GrammarHints text={v.en} matches={matches} onFix={(m, r) => { setV({ ...v, en: applyFix(v.en, m, r) }); setMatches([]) }} />
      <input className="input !py-2 !text-base" value={v.cz} onChange={e => setV({ ...v, cz: e.target.value })} />
      <input className="input !py-2 !text-base" value={v.note} onChange={e => setV({ ...v, note: e.target.value })} placeholder="Poznámka" />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary !py-2 text-sm" onClick={save}>Uložit</button>
        <button className="btn-soft !py-2 text-sm" onClick={async () => { try { setMatches(await checkGrammar(v.en)) } catch { setErr('Kontrola teď nefunguje.') } }}>Zkontrolovat gramatiku</button>
        <button className="btn-soft !py-2 text-sm" onClick={() => { setEdit(false); setV({ en: card.en, cz: card.cz, note: card.note }) }}>Zrušit</button>
      </div>
      {err && <p className="text-sm font-bold text-rose-600">{err}</p>}
    </li>
  )
  return (
    <li className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="font-extrabold [overflow-wrap:anywhere]">{card.en}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400 [overflow-wrap:anywhere]">{card.cz}{card.note && ` · ${card.note}`}</div>
      </div>
      {editor && !confirm && (
        <>
          <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setEdit(true)} aria-label="Upravit">✏️</button>
          <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setConfirm(true)} aria-label="Smazat">🗑️</button>
        </>
      )}
      {confirm && (
        <>
          <button className="btn-danger !px-3 !py-2 text-sm" onClick={remove}>Opravdu smazat</button>
          <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setConfirm(false)}>Ne</button>
        </>
      )}
      {err && <p className="text-sm font-bold text-rose-600">{err}</p>}
    </li>
  )
}
