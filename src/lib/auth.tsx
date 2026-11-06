import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, callFunction } from './supabase'
import { emailFor, passwordFor } from './pupil'
import { CLASS_COLS, type ClassInfo, type Profile } from './types'

interface AuthState {
  loading: boolean
  session: Session | null
  profile: Profile | null
  klass: ClassInfo | null
  signIn: (classCode: string, nickname: string, pin: string) => Promise<void>
  register: (classCode: string, nickname: string, pin: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [klass, setKlass] = useState<ClassInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setKlass(null); return }
    const { data: p } = await supabase.from('profiles').select('id, class_id, nickname, role, created_at').eq('id', s.user.id).maybeSingle()
    setProfile(p as Profile | null)
    if (p) {
      const { data: c } = await supabase.from('classes').select(CLASS_COLS).eq('id', p.class_id).maybeSingle()
      setKlass(c as ClassInfo | null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') loadProfile(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const signIn = async (classCode: string, nickname: string, pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailFor(nickname, classCode), password: passwordFor(pin, nickname) })
    if (error) {
      if (error.status === 429) throw new Error('Moc pokusů za sebou. Počkej chvilku a zkus to znovu.')
      throw new Error('Kód třídy, přezdívka nebo PIN nesedí.')
    }
  }

  const register = async (classCode: string, nickname: string, pin: string) => {
    const res = await callFunction<{ ok?: boolean; classCode?: string; error?: string }>('pupil-auth', { action: 'register', classCode, nickname, pin })
    if (!res.ok || !res.classCode) throw new Error(res.error || 'Registrace se nepovedla.')
    await signIn(res.classCode, nickname, pin)
  }

  const value: AuthState = {
    loading, session, profile, klass, signIn, register,
    signOut: async () => { await supabase.auth.signOut() },
    refreshProfile: () => loadProfile(session),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
