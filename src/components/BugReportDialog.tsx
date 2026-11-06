import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { deviceInfo, recentErrors } from '../lib/errors'
import { relTime } from '../lib/dates'
import type { BugReport } from '../lib/types'

/** "Nahlásit chybu": a short form; the page, device and recent JS errors are attached automatically. */
export default function BugReportDialog({ onClose }: { onClose: () => void }) {
  const { pathname, search } = useLocation()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [mine, setMine] = useState<BugReport[]>([])
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    box.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  useEffect(() => {
    // Own earlier reports, so people can see whether theirs was fixed. (The super admin sees everything on the "Chyby" page.)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('bug_reports').select('*').eq('user_id', data.user.id).order('created_at', { ascending: false }).limit(5)
        .then(({ data: rows }) => setMine((rows ?? []) as BugReport[]))
    })
  }, [sent])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const text = message.trim()
    if (text.length < 3) { setError('Napiš prosím pár slov, co se stalo.'); return }
    setBusy(true); setError('')
    const { error: err } = await supabase.from('bug_reports').insert({
      message: text.slice(0, 2000), page: (pathname + search).slice(0, 300), device: deviceInfo(), errors: recentErrors().slice(0, 4000),
    })
    setBusy(false)
    if (err) { setError('Odeslání se nepovedlo. Zkus to prosím znovu.'); return }
    setSent(true); setMessage('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="bug-title" onClick={e => e.stopPropagation()}
        className="panel max-h-[90dvh] w-full max-w-lg overflow-y-auto !bg-white dark:!bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="bug-title" className="text-xl font-black">🐞 Nahlásit chybu</h2>
          <button onClick={onClose} className="btn-soft ml-auto !px-3 !py-1" aria-label="Zavřít">✕</button>
        </div>

        {sent ? (
          <div className="space-y-3 text-center">
            <div className="pop text-5xl">🙏</div>
            <p className="font-bold">Díky! Hlášení jsme dostali a podíváme se na to.</p>
            <div className="flex justify-center gap-2">
              <button className="btn-soft" onClick={() => setSent(false)}>Nahlásit další</button>
              <button className="btn-primary" onClick={onClose}>Hotovo</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="label" htmlFor="bug-msg">Co se stalo?</label>
            <textarea id="bug-msg" ref={box} className="input min-h-32 !text-base" maxLength={2000} value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Např.: Kartička „fourth“ má špatný překlad. / Po kliknutí na Věděl se nic nestalo." />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              K hlášení se automaticky přidá stránka, na které jsi, typ zařízení a prohlížeče a případná technická chyba. Nepiš sem žádné osobní údaje.
            </p>
            {error && <p className="font-bold text-rose-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Odesílám…' : 'Odeslat'}</button>
          </form>
        )}

        {mine.length > 0 && (
          <div className="mt-5">
            <h3 className="label">Moje hlášení</h3>
            <ul className="divide-y divide-violet-100 text-sm dark:divide-slate-800">
              {mine.map(r => (
                <li key={r.id} className="flex items-start gap-2 py-2">
                  <span className="flex-1 break-words">{r.message}</span>
                  <span className={`shrink-0 font-extrabold ${r.status === 'done' ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {r.status === 'done' ? '✓ vyřešeno' : relTime(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
