import { useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { useTheme, type ThemeMode } from '../lib/theme'
import { GOALS, canVibrate, usePrefs } from '../lib/prefs'
import { dayKey, streakDays } from '../lib/dates'
import { isLearned } from '../lib/practice'
import { classLabel, pkey, type Role } from '../lib/types'
import Icon, { type IconName } from '../components/Icon'
import BugReportDialog from '../components/BugReportDialog'
import { Segmented } from '../components/PracticeSheet'

const ROLE: Record<Role, string> = { student: 'Žák', editor: 'Editor', admin: 'Učitel', superadmin: 'Správce aplikace' }
const THEMES: { id: ThemeMode; label: string }[] = [{ id: 'auto', label: 'Auto' }, { id: 'light', label: 'Světlý' }, { id: 'dark', label: 'Tmavý' }]

export default function Profile() {
  const { profile, klass, signOut } = useAuth()
  const { cards, levels, activity } = useData()
  const { mode, setMode } = useTheme()
  const [prefs, setPrefs] = usePrefs()
  const [reporting, setReporting] = useState(false)

  const learned = useMemo(() => cards.filter(c => c.status === 'approved'
    && (isLearned(levels.get(pkey(c.id, 'en'))) || isLearned(levels.get(pkey(c.id, 'cz'))))).length, [cards, levels])
  const streak = streakDays(new Set(activity.keys()))
  const today = activity.get(dayKey(new Date())) ?? 0

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="flex flex-col items-center pt-2 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-violet-100 text-4xl font-black text-violet-700 dark:bg-violet-950 dark:text-violet-200">
          {profile?.nickname.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="mt-2 text-2xl font-black">{profile?.nickname}</h1>
        <p className="font-bold text-slate-500 dark:text-slate-400">{profile && ROLE[profile.role]}{klass && ` · ${classLabel(klass)}`}</p>
      </header>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={streak} label="dní v řadě" />
        <Stat value={learned} label="naučených slov" />
        <Stat value={today} label="odpovědí dnes" />
      </div>

      <section>
        <h2 className="label px-1">Nastavení</h2>
        <List>
          <Row icon="moon" label="Vzhled">
            <Segmented compact value={mode} onChange={setMode} options={THEMES} />
          </Row>
          <Row icon="target" label="Denní cíl">
            <Segmented compact value={prefs.goal} onChange={goal => setPrefs({ goal })} options={GOALS.map(g => ({ id: g, label: String(g) }))} />
          </Row>
          <Row icon="speaker" label="Zvuky po odpovědi">
            <Switch on={prefs.sounds} onChange={sounds => setPrefs({ sounds })} label="Zvuky po odpovědi" />
          </Row>
          {canVibrate && (
            <Row icon="bell" label="Vibrace">
              <Switch on={prefs.haptics} onChange={haptics => setPrefs({ haptics })} label="Vibrace" />
            </Row>
          )}
        </List>
      </section>

      <List>
        {profile?.role !== 'superadmin' && (
          <li>
            <button onClick={() => setReporting(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-extrabold hover:bg-violet-50 dark:hover:bg-slate-800">
              <Icon name="flag" className="text-violet-600 dark:text-violet-300" /><span className="flex-1">Nahlásit chybu</span><Icon name="chevron" size={20} className="text-slate-300" />
            </button>
          </li>
        )}
        <li>
          <button onClick={signOut} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-extrabold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">
            <Icon name="logout" /><span className="flex-1">Odhlásit se</span>
          </button>
        </li>
      </List>

      {reporting && <BugReportDialog onClose={() => setReporting(false)} />}
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="panel !px-1 !py-3 text-center">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-[#f1eefa] overflow-hidden rounded-3xl bg-white shadow-[0_1px_0_#e9e5f7] dark:divide-slate-800 dark:bg-slate-900 dark:shadow-none">{children}</ul>
}

function Row({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-3 px-4 py-2">
      <Icon name={icon} className="text-violet-600 dark:text-violet-300" />
      <span className="flex-1 font-extrabold">{label}</span>
      {children}
    </li>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-8 w-13 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}
