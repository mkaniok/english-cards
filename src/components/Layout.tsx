import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { ROLE_ICON, isAdminRole } from '../lib/types'
import { supabase } from '../lib/supabase'
import BugReportDialog from './BugReportDialog'

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const { pathname } = useLocation()
  const editor = profile?.role !== 'student'
  const isSuper = profile?.role === 'superadmin'
  const [reporting, setReporting] = useState(false)
  const openBugs = useOpenBugCount(isSuper, pathname)
  const nav = [
    { to: '/', icon: '🎯', label: 'Procvičovat' },
    { to: '/stats', icon: '📈', label: 'Statistiky' },
    { to: '/cards', icon: editor ? '🗂️' : '💡', label: editor ? 'Kartičky' : 'Navrhnout' },
    ...(editor ? [{ to: '/class', icon: '👩‍🏫', label: isAdminRole(profile?.role) ? 'Třídy' : 'Třída' }] : []),
    ...(isSuper ? [{ to: '/bugs', icon: '🐞', label: 'Chyby', badge: openBugs }] : []),
  ]
  const practicing = pathname === '/practice'

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pb-28 pt-4 md:pb-10">
      <header className="mb-4 flex items-center gap-3">
        <NavLink to="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-2xl font-black tracking-tight text-violet-700 dark:text-violet-300">
          <img src="/icon-192.png" alt="" className="h-9 w-9" /> Kartičky
        </NavLink>
        <nav className="ml-2 hidden shrink-0 gap-1 md:flex">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) =>
              `whitespace-nowrap rounded-xl px-3 py-2 font-extrabold transition ${isActive ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              {'badge' in n ? <span title={n.label}>{n.icon}</span> : n.label}{'badge' in n && n.badge ? <Badge n={n.badge} /> : null}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!isSuper && (
            <button onClick={() => setReporting(true)} className="btn-soft !px-3 !py-2 text-lg" aria-label="Nahlásit chybu" title="Nahlásit chybu">
              🐞
            </button>
          )}
          <button onClick={toggle} className="btn-soft !px-3 !py-2 text-lg" aria-label={dark ? 'Světlý motiv' : 'Tmavý motiv'} title={dark ? 'Světlý motiv' : 'Tmavý motiv'}>
            {dark ? '☀️' : '🌙'}
          </button>
          <button onClick={signOut} className="btn-soft !px-3 !py-2 text-sm" title={`Odhlásit ${profile ? ROLE_ICON[profile.role] + ' ' + profile.nickname : ''}`}>Odhlásit</button>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      {reporting && <BugReportDialog onClose={() => setReporting(false)} />}

      {!practicing && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-violet-100 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
          <div className="mx-auto flex max-w-md justify-around">
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} end className={({ isActive }) =>
                `flex min-w-16 flex-col items-center rounded-2xl px-3 py-1 text-xs font-extrabold ${isActive ? 'bg-violet-100 text-violet-700 dark:bg-slate-800 dark:text-violet-300' : 'text-slate-500'}`}>
                <span className="relative text-2xl leading-7">{n.icon}{'badge' in n && n.badge ? <Badge n={n.badge} corner /> : null}</span>{n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

function Badge({ n, corner }: { n: number; corner?: boolean }) {
  return (
    <span className={`${corner ? 'absolute -right-3 -top-1' : 'ml-1.5'} inline-grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-xs font-black leading-5 text-white`}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

/** Number of unresolved bug reports, for the super admin's "Chyby" menu item. */
function useOpenBugCount(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const load = () => supabase.from('bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'new')
      .then(({ count: c }) => setCount(c ?? 0))
    load()
    window.addEventListener('bugs-changed', load)
    return () => window.removeEventListener('bugs-changed', load)
  }, [enabled, pathname])
  return count
}
