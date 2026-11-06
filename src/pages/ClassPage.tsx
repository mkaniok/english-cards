import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { callFunction, fetchAll, supabase } from '../lib/supabase'
import { relTime } from '../lib/dates'
import {
  CLASS_COLS, LEARNED, ROLE_ICON, classLabel, isAdminRole, currentSchoolYear, schoolYear,
  type Answer, type ClassInfo, type Profile, type Progress, type Role,
} from '../lib/types'
import Tile from '../components/Tile'
import DayChart from '../components/DayChart'
import { plural } from '../lib/plural'

const ROLE_NAME: Record<Role, string> = { student: 'žák', editor: 'editor', admin: 'admin', superadmin: 'super admin' }
const roleLabel = (r: Role) => `${ROLE_ICON[r]} ${ROLE_NAME[r]}`
const PICKED = 'ec.class'

export default function ClassPage() {
  const { profile, klass: myClass } = useAuth()
  const { cards } = useData()
  const isAdmin = isAdminRole(profile?.role)
  const isSuper = profile?.role === 'superadmin'
  // Admins (teachers) manage every class; editors only see their own.
  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [picked, setPicked] = useState<string | null>(() => localStorage.getItem(PICKED))
  const klass = (isAdmin && classes.find(c => c.id === picked)) || myClass
  const [people, setPeople] = useState<Profile[]>([])
  const [progress, setProgress] = useState<Pick<Progress, 'user_id' | 'card_id' | 'level'>[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const loadClasses = useCallback(async () => {
    if (!isAdmin) return
    const { data } = await supabase.from('classes').select(CLASS_COLS)
      .order('school_year', { ascending: false }).order('grade').order('letter')
    setClasses((data ?? []) as ClassInfo[])
  }, [isAdmin])
  useEffect(() => { loadClasses() }, [loadClasses])

  const pick = (id: string) => { setPicked(id); localStorage.setItem(PICKED, id) }

  const classId = klass?.id
  const load = useCallback(async () => {
    if (!classId) return
    const since = new Date(Date.now() - 30 * 86400e3).toISOString()
    const p = await supabase.from('profiles').select('id, class_id, nickname, role, created_at').eq('class_id', classId).order('nickname')
    const members = (p.data ?? []) as Profile[]
    const ids = members.map(m => m.id)
    const [pr, an] = ids.length ? await Promise.all([
      fetchAll<Pick<Progress, 'user_id' | 'card_id' | 'level'>>((a, b) => supabase.from('progress').select('user_id, card_id, level').in('user_id', ids).range(a, b)),
      fetchAll<Answer>((a, b) => supabase.from('answers').select('user_id, card_id, dir, grade, answered_at').in('user_id', ids).gte('answered_at', since).range(a, b)),
    ]) : [[], []]
    setPeople(members)
    setProgress(pr); setAnswers(an); setLoading(false)
  }, [classId])
  useEffect(() => { load() }, [load])

  const perUser = useMemo(() => {
    const m = new Map<string, { learned: Set<string>; week: number; knew: number; last: string | null }>()
    const get = (id: string) => m.get(id) ?? (m.set(id, { learned: new Set(), week: 0, knew: 0, last: null }), m.get(id)!)
    for (const p of progress) if (p.level >= LEARNED) get(p.user_id).learned.add(p.card_id)
    const weekAgo = Date.now() - 7 * 86400e3
    for (const a of answers) {
      const u = get(a.user_id)
      if (new Date(a.answered_at).getTime() >= weekAgo) { u.week++; if (a.grade === 'knew') u.knew++ }
      if (!u.last || a.answered_at > u.last) u.last = a.answered_at
    }
    return m
  }, [progress, answers])

  const hardest = useMemo(() => {
    const m = new Map<string, { miss: number; total: number; users: Set<string> }>()
    for (const a of answers) {
      const e = m.get(a.card_id) ?? { miss: 0, total: 0, users: new Set() }
      e.total++
      if (a.grade === 'unknown') { e.miss++; e.users.add(a.user_id) }
      m.set(a.card_id, e)
    }
    return [...m.entries()].filter(([, e]) => e.miss > 0).sort((a, b) => b[1].users.size - a[1].users.size || b[1].miss - a[1].miss)
      .slice(0, 10).map(([id, e]) => ({ card: cards.find(c => c.id === id), ...e })).filter(x => x.card)
  }, [answers, cards])

  const activeWeek = [...perUser.values()].filter(u => u.week > 0).length
  const share = `Kartičky – anglická slovíčka\n${location.origin}\nTřída: ${klass ? classLabel(klass) : ''}\nKód třídy: ${klass?.code}`

  if (loading) return <p className="panel text-center font-bold">Načítám třídu…</p>
  return (
    <div className="space-y-4">
      {isAdmin && klass && (
        <ClassPicker classes={classes} current={klass} onPick={pick}
          onSaved={async id => { await loadClasses(); if (id) pick(id) }} />
      )}
      <h1 className="text-2xl font-black">👩‍🏫 Třída {klass?.name} <span className="text-slate-500 dark:text-slate-400">{klass && schoolYear(klass.school_year)}</span></h1>

      <section className="panel flex flex-wrap items-center gap-4">
        <div>
          <div className="label">Kód třídy pro žáky</div>
          <div className="text-4xl font-black tracking-[.2em] text-violet-700 dark:text-violet-300">{klass?.code}</div>
        </div>
        <button className="btn-soft ml-auto" onClick={async () => { await navigator.clipboard.writeText(share); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
          {copied ? '✓ Zkopírováno' : '📋 Zkopírovat pozvánku'}
        </button>
        <p className="w-full text-sm text-slate-500 dark:text-slate-400">Pošli spolužákům adresu aplikace a tenhle kód. Při první návštěvě kliknou na „Jsem tu poprvé“.</p>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Tile icon="👥" value={people.length} label="členů třídy" />
        <Tile icon="🔥" value={activeWeek} label="aktivních za týden" />
        <Tile icon="🃏" value={answers.length} label="odpovědí za 30 dní" />
      </div>

      <section className="panel">
        <h2 className="label">Aktivita třídy (14 dní)</h2>
        <DayChart answers={answers} />
      </section>

      <section className="panel">
        <h2 className="label">Členové</h2>
        <ul className="divide-y divide-violet-100 dark:divide-slate-800">
          {people.map(p => <Member key={p.id} p={p} me={p.id === profile?.id} isAdmin={isAdmin} isSuper={isSuper} stats={perUser.get(p.id)} onChange={load} />)}
        </ul>
      </section>

      <section className="panel">
        <h2 className="label">Nejtěžší slovíčka třídy (30 dní)</h2>
        {!hardest.length ? <p className="font-bold text-slate-500">Zatím žádná data.</p> : (
          <ul className="divide-y divide-violet-100 dark:divide-slate-800">
            {hardest.map(h => (
              <li key={h.card!.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 font-extrabold">{h.card!.en}</span>
                <span className="flex-1 text-slate-500 dark:text-slate-400">{h.card!.cz}</span>
                <span className="text-right text-sm font-bold text-rose-600">nevědělo {plural(h.users.size, 'dítě', 'děti', 'dětí')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Member({ p, me, isAdmin, isSuper, stats, onChange }: {
  p: Profile; me: boolean; isAdmin: boolean; isSuper: boolean; onChange: () => void
  stats?: { learned: Set<string>; week: number; knew: number; last: string | null }
}) {
  const [mode, setMode] = useState<'' | 'pin' | 'remove'>('')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')

  const setRole = async (role: Role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    setMsg(error ? 'Změna se nepovedla.' : 'Role změněna ✅')
    onChange()
  }
  const resetPin = async () => {
    try { await callFunction('pupil-auth', { action: 'reset_pin', userId: p.id, pin }); setMsg(`Nový PIN je ${pin} ✅`); setMode(''); setPin('') }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Nepovedlo se.') }
  }
  const remove = async () => {
    try { await callFunction('pupil-auth', { action: 'remove', userId: p.id }); onChange() }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Nepovedlo se.') }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-32 flex-1">
          <div className="font-extrabold">{p.nickname}{me && ' (ty)'}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            ⭐ {stats?.learned.size ?? 0} naučeno · 🃏 {stats?.week ?? 0} za týden{stats?.week ? ` (${Math.round((stats.knew / stats.week) * 100)} %)` : ''} · {relTime(stats?.last ?? null)}
          </div>
        </div>
        {isAdmin && !me && (isSuper || p.role !== 'superadmin') ? (
          <>
            <select className="rounded-xl border-2 border-violet-100 bg-white px-2 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-900" value={p.role} onChange={e => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_NAME) as Role[]).filter(r => isSuper || r !== 'superadmin').map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setMode(mode === 'pin' ? '' : 'pin')}>🔑 PIN</button>
            <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setMode(mode === 'remove' ? '' : 'remove')} aria-label="Odebrat">🗑️</button>
          </>
        ) : <span className="text-sm font-bold">{roleLabel(p.role)}</span>}
      </div>
      {mode === 'pin' && (
        <div className="mt-2 flex gap-2">
          <input className="input !py-2 text-center tracking-[.4em]" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="nový PIN" />
          <button className="btn-primary !py-2" disabled={pin.length !== 4} onClick={resetPin}>Nastavit</button>
        </div>
      )}
      {mode === 'remove' && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/40">
          <span className="flex-1 text-sm font-bold">Odebrat {p.nickname} i s celým pokrokem?</span>
          <button className="btn-danger !py-2 text-sm" onClick={remove}>Odebrat</button>
          <button className="btn-soft !py-2 text-sm" onClick={() => setMode('')}>Ne</button>
        </div>
      )}
      {msg && <p className="mt-1 text-sm font-bold text-violet-700 dark:text-violet-300">{msg}</p>}
    </li>
  )
}

/** Teacher's class switcher with "new class" and "edit class" forms. */
function ClassPicker({ classes, current, onPick, onSaved }: {
  classes: ClassInfo[]; current: ClassInfo; onPick: (id: string) => void; onSaved: (id?: string) => Promise<void>
}) {
  const [form, setForm] = useState<'' | 'new' | 'edit'>('')
  const years = [...new Set(classes.map(c => c.school_year))]
  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="label !mb-0 mr-auto">Třídy</h2>
        <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setForm(form === 'edit' ? '' : 'edit')}>✏️ Upravit {current.name}</button>
        <button className="btn-primary !px-3 !py-2 text-sm" onClick={() => setForm(form === 'new' ? '' : 'new')}>➕ Nová třída</button>
      </div>
      {years.map(y => (
        <div key={y}>
          <div className="mb-1 text-sm font-bold text-slate-500 dark:text-slate-400">Školní rok {schoolYear(y)}</div>
          <div className="flex flex-wrap gap-2">
            {classes.filter(c => c.school_year === y).map(c => (
              <button key={c.id} onClick={() => { onPick(c.id); setForm('') }}
                className={`rounded-xl px-3 py-2 font-extrabold transition ${c.id === current.id ? 'bg-violet-600 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-slate-800 dark:text-violet-300'}`}>
                {c.name} <span className="ml-1 font-mono text-xs opacity-75">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {form && (
        <ClassForm key={form + current.id} edit={form === 'edit' ? current : null}
          onDone={async id => { setForm(''); await onSaved(id) }} onCancel={() => setForm('')} />
      )}
    </section>
  )
}

function ClassForm({ edit, onDone, onCancel }: { edit: ClassInfo | null; onDone: (id?: string) => Promise<void>; onCancel: () => void }) {
  const now = currentSchoolYear()
  const [grade, setGrade] = useState(edit?.grade ?? 6)
  const [letter, setLetter] = useState(edit?.letter ?? '')
  const [year, setYear] = useState(edit?.school_year ?? now)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const yearOptions = [...new Set([now - 1, now, now + 1, year])].sort()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const l = letter.trim().toUpperCase()
    if (!/^[A-Z]{1,2}$/.test(l)) return setError('Písmeno třídy: jedno nebo dvě písmena bez háčků, např. A.')
    setBusy(true); setError('')
    const row = { grade, letter: l, school_year: year }
    const { data, error: err } = edit
      ? await supabase.from('classes').update(row).eq('id', edit.id).select('id').single()
      : await supabase.from('classes').insert(row).select('id').single()
    setBusy(false)
    if (err) return setError(err.code === '23505' ? `Třída ${grade}. ${l} ${schoolYear(year)} už existuje.` : 'Uložení se nepovedlo.')
    await onDone(data?.id)
  }

  const field = 'rounded-xl border-2 border-violet-100 bg-white px-3 py-2 font-bold dark:border-slate-700 dark:bg-slate-900'
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-violet-50 p-3 dark:bg-slate-800/60">
      <div className="font-extrabold">{edit ? `Upravit třídu ${classLabel(edit)}` : 'Nová třída'}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-bold">Ročník<br />
          <select className={field} value={grade} onChange={e => setGrade(Number(e.target.value))}>
            {Array.from({ length: 9 }, (_, i) => i + 1).map(g => <option key={g} value={g}>{g}.</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Písmeno<br />
          <input className={`${field} w-20 uppercase`} value={letter} maxLength={2} onChange={e => setLetter(e.target.value.toUpperCase())} placeholder="A" required />
        </label>
        <label className="text-sm font-bold">Školní rok<br />
          <select className={field} value={year} onChange={e => setYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{schoolYear(y)}</option>)}
          </select>
        </label>
        <button className="btn-primary !py-2" disabled={busy}>{busy ? 'Ukládám…' : edit ? 'Uložit' : 'Vytvořit'}</button>
        <button type="button" className="btn-soft !py-2" onClick={onCancel}>Zrušit</button>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {edit
          ? 'Kód třídy zůstává stejný, žáci se dál přihlašují jako dřív. Takhle jde třídu na konci roku posunout do dalšího ročníku.'
          : 'Kód pro žáky se vytvoří sám a uvidíš ho v seznamu tříd.'}
      </p>
      {error && <p className="rounded-2xl bg-rose-100 px-4 py-2 font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{error}</p>}
    </form>
  )
}
