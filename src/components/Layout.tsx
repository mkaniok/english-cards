import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isAdminRole } from '../lib/types'
import { supabase } from '../lib/supabase'
import Icon, { type IconName } from './Icon'

interface NavItem { to: string; icon: IconName; label: string; badge?: number }

export default function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const editor = profile?.role !== 'student'
  const isSuper = profile?.role === 'superadmin'
  const openBugs = useOpenBugCount(isSuper, pathname)
  const nav: NavItem[] = [
    { to: '/', icon: 'home', label: 'Učit se' },
    { to: '/stats', icon: 'chart', label: 'Statistiky' },
    { to: '/cards', icon: editor ? 'cards' : 'plus', label: editor ? 'Kartičky' : 'Navrhnout' },
    ...(editor ? [{ to: '/class', icon: 'users' as const, label: isAdminRole(profile?.role) ? 'Třídy' : 'Třída' }] : []),
    ...(isSuper ? [{ to: '/bugs', icon: 'bug' as const, label: 'Chyby', badge: openBugs }] : []),
    { to: '/profile', icon: 'user', label: 'Profil' },
  ]

  // Practising is full screen: no menus, nothing to tap by mistake.
  if (pathname === '/practice') {
    return <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),12px)] md:min-h-[44rem] md:pt-8">{children}</div>
  }

  return (
    <div className="md:flex md:min-h-dvh">
      {/* Computer: menu on the side. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-[#ece8f8] bg-white px-4 py-7 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <NavLink to="/" className="mb-5 flex items-center gap-2 px-3 text-2xl font-black text-violet-700 dark:text-violet-300">
          <img src="/icon-192.png" alt="" className="h-9 w-9" /> Kartičky
        </NavLink>
        {nav.map(n => (
          <NavLink key={n.to} to={n.to} end className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 font-extrabold transition ${isActive
              ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200'
              : 'border-transparent text-slate-600 hover:bg-violet-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
            <Icon name={n.icon} />{n.label}{n.badge ? <Badge n={n.badge} /> : null}
          </NavLink>
        ))}
      </aside>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-[max(env(safe-area-inset-top),20px)] md:max-w-5xl md:px-10 md:pb-12 md:pt-8">
        {children}
      </main>

      {/* Phone: tab bar at the bottom, in reach of the thumb. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ece8f8] bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        <div className="mx-auto flex max-w-lg">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) =>
              `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold ${isActive ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400'}`}>
              <span className="relative"><Icon name={n.icon} size={26} />{n.badge ? <Badge n={n.badge} corner /> : null}</span>{n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function Badge({ n, corner }: { n: number; corner?: boolean }) {
  return (
    <span className={`${corner ? 'absolute -right-3 -top-1' : 'ml-auto'} inline-grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-xs font-black leading-5 text-white`}>
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
