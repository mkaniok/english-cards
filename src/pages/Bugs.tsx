import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { classLabel, ROLE_ICON, type BugReport, type ClassInfo, type Role } from '../lib/types'

type Row = BugReport & {
  profiles: { nickname: string; role: Role; classes: Pick<ClassInfo, 'name' | 'school_year'> | null } | null
}

/** Super admin only: every bug report from every class. */
export default function Bugs() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('bug_reports')
      .select('*, profiles(nickname, role, classes(name, school_year))')
      .order('created_at', { ascending: false }).limit(200)
    setRows((data ?? []) as Row[]); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const setStatus = async (r: Row, status: BugReport['status']) => {
    await supabase.from('bug_reports').update({ status, resolved_at: status === 'done' ? new Date().toISOString() : null }).eq('id', r.id)
    await load(); window.dispatchEvent(new Event('bugs-changed'))
  }
  const remove = async (r: Row) => {
    if (!window.confirm('Smazat hlášení natrvalo?')) return
    await supabase.from('bug_reports').delete().eq('id', r.id)
    await load(); window.dispatchEvent(new Event('bugs-changed'))
  }

  const open = rows.filter(r => r.status === 'new')
  const shown = showDone ? rows : open
  const when = (iso: string) => new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) return <p className="panel text-center font-bold">Načítám hlášení…</p>
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black">🐞 Nahlášené chyby</h1>
        <label className="ml-auto flex items-center gap-2 font-bold">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="h-5 w-5 accent-violet-600" />
          i vyřešené ({rows.length - open.length})
        </label>
      </div>

      {!shown.length && <p className="panel text-center font-bold text-slate-500">Žádné nevyřešené hlášení. 🎉</p>}

      {shown.map(r => (
        <article key={r.id} className={`panel space-y-2 ${r.status === 'done' ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-slate-500 dark:text-slate-400">
            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              {r.profiles ? `${ROLE_ICON[r.profiles.role]} ${r.profiles.nickname}` : 'smazaný uživatel'}
            </span>
            {r.profiles?.classes && <span>{classLabel(r.profiles.classes as ClassInfo)}</span>}
            <span>{when(r.created_at)}</span>
            {r.page && <code className="rounded bg-violet-50 px-1.5 dark:bg-slate-800">{r.page}</code>}
          </div>
          <p className="whitespace-pre-wrap break-words text-lg">{r.message}</p>
          {(r.device || r.errors) && (
            <details className="text-sm text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer font-bold">Technické údaje{r.errors ? ' ⚠️ chyba v prohlížeči' : ''}</summary>
              {r.errors && <pre className="mt-1 whitespace-pre-wrap break-words text-rose-600">{r.errors}</pre>}
              <p className="mt-1 break-words">{r.device}</p>
            </details>
          )}
          <div className="flex gap-2">
            {r.status === 'new'
              ? <button className="btn-primary !py-2" onClick={() => setStatus(r, 'done')}>✓ Vyřešeno</button>
              : <button className="btn-soft !py-2" onClick={() => setStatus(r, 'new')}>Znovu otevřít</button>}
            <button className="btn-danger ml-auto !py-2" onClick={() => remove(r)}>Smazat</button>
          </div>
        </article>
      ))}
    </div>
  )
}
