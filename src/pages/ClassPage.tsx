import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { callFunction, fetchAll, supabase } from '../lib/supabase'
import { relTime } from '../lib/dates'
import { LEARNED, type Answer, type Profile, type Progress, type Role } from '../lib/types'
import Tile from '../components/Tile'
import DayChart from '../components/DayChart'
import { plural } from '../lib/plural'

const ROLE_LABEL: Record<Role, string> = { student: '🙂 žák', editor: '✏️ editor', admin: '👑 admin' }

export default function ClassPage() {
  const { profile, klass } = useAuth()
  const { cards } = useData()
  const isAdmin = profile?.role === 'admin'
  const [people, setPeople] = useState<Profile[]>([])
  const [progress, setProgress] = useState<Pick<Progress, 'user_id' | 'card_id' | 'level'>[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400e3).toISOString()
    const [p, pr, an] = await Promise.all([
      supabase.from('profiles').select('id, class_id, nickname, role, created_at').order('nickname'),
      fetchAll<Pick<Progress, 'user_id' | 'card_id' | 'level'>>((a, b) => supabase.from('progress').select('user_id, card_id, level').range(a, b)),
      fetchAll<Answer>((a, b) => supabase.from('answers').select('user_id, card_id, dir, grade, answered_at').gte('answered_at', since).range(a, b)),
    ])
    setPeople((p.data ?? []) as Profile[])
    setProgress(pr); setAnswers(an); setLoading(false)
  }, [])
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
  const share = `Kartičky – anglická slovíčka\n${location.origin}\nKód třídy: ${klass?.code}`

  if (loading) return <p className="panel text-center font-bold">Načítám třídu…</p>
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">👩‍🏫 Třída {klass?.name}</h1>

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
          {people.map(p => <Member key={p.id} p={p} me={p.id === profile?.id} isAdmin={isAdmin} stats={perUser.get(p.id)} onChange={load} />)}
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

function Member({ p, me, isAdmin, stats, onChange }: {
  p: Profile; me: boolean; isAdmin: boolean; onChange: () => void
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
        {isAdmin && !me ? (
          <>
            <select className="rounded-xl border-2 border-violet-100 bg-white px-2 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-900" value={p.role} onChange={e => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setMode(mode === 'pin' ? '' : 'pin')}>🔑 PIN</button>
            <button className="btn-soft !px-3 !py-2 text-sm" onClick={() => setMode(mode === 'remove' ? '' : 'remove')} aria-label="Odebrat">🗑️</button>
          </>
        ) : <span className="text-sm font-bold">{ROLE_LABEL[p.role]}</span>}
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
