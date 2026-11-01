import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'

export default function Login() {
  const { signIn, register } = useAuth()
  const { dark, toggle } = useTheme()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [code, setCode] = useState(() => localStorage.getItem('ec.classCode') ?? '')
  const [nick, setNick] = useState(() => localStorage.getItem('ec.nickname') ?? '')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\d{4}$/.test(pin)) return setError('PIN musí mít 4 číslice.')
    if (mode === 'register' && pin !== pin2) return setError('PINy se neshodují.')
    setBusy(true)
    try {
      if (mode === 'login') await signIn(code, nick, pin)
      else await register(code, nick, pin)
      localStorage.setItem('ec.classCode', code.trim().toUpperCase())
      localStorage.setItem('ec.nickname', nick.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Něco se pokazilo.')
    } finally {
      setBusy(false)
    }
  }

  const pinInput = (v: string, set: (s: string) => void, label: string, id: string) => (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input text-center text-2xl tracking-[.6em]" inputMode="numeric" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        type="password" maxLength={4} value={v} onChange={e => set(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" required />
    </div>
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <button onClick={toggle} className="btn-soft absolute right-4 top-4 !px-3 !py-2 text-lg" aria-label="Přepnout motiv">{dark ? '☀️' : '🌙'}</button>
      <div className="mb-6 text-center">
        <img src="/icon-192.png" alt="" className="pop mx-auto h-20 w-20" />
        <h1 className="mt-3 text-4xl font-black text-violet-700 dark:text-violet-300">Kartičky</h1>
        <p className="mt-1 font-bold text-slate-500 dark:text-slate-400">Anglická slovíčka pro naši třídu</p>
      </div>

      <div className="panel">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-violet-100 p-1 dark:bg-slate-800">
          {(['login', 'register'] as const).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setError('') }}
              className={`rounded-xl py-2 font-extrabold transition ${mode === m ? 'bg-white text-violet-700 shadow dark:bg-slate-950 dark:text-violet-300' : 'text-slate-500'}`}>
              {m === 'login' ? 'Přihlásit se' : 'Jsem tu poprvé'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="code">Kód třídy</label>
            <input id="code" className="input uppercase tracking-widest" value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="např. ABC123" required />
          </div>
          <div>
            <label className="label" htmlFor="nick">Přezdívka</label>
            <input id="nick" className="input" value={nick} onChange={e => setNick(e.target.value)} maxLength={20} autoComplete="username" placeholder="např. Kuba" required />
            {mode === 'register' && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nepiš celé jméno a příjmení, stačí přezdívka, podle které tě spolužáci poznají.</p>}
          </div>
          {pinInput(pin, setPin, mode === 'login' ? 'PIN' : 'Vymysli si PIN (4 číslice)', 'pin')}
          {mode === 'register' && pinInput(pin2, setPin2, 'PIN ještě jednou', 'pin2')}
          {error && <p className="pop rounded-2xl bg-rose-100 px-4 py-3 font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{error}</p>}
          <button className="btn-primary w-full text-lg" disabled={busy}>
            {busy ? 'Chvilku…' : mode === 'login' ? 'Jdeme na to 🚀' : 'Vytvořit účet 🎉'}
          </button>
          {mode === 'login' && <p className="text-center text-sm text-slate-500 dark:text-slate-400">Zapomněl jsi PIN? Řekni správci třídy, nastaví ti nový.</p>}
        </form>
      </div>
    </div>
  )
}
