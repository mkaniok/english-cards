import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchAll, supabase } from './supabase'
import { useAuth } from './auth'
import { pkey, type Card, type Lesson, type Progress, type Textbook } from './types'
import { dayKey } from './dates'

interface DataState {
  loading: boolean
  error: string | null
  textbooks: Textbook[]
  lessons: Lesson[]
  cards: Card[]
  levels: Map<string, number>
  /** Number of answers per day (dayKey), for the streak and the daily goal. */
  activity: Map<string, number>
  setLevel: (key: string, level: number) => void
  /** Counts one more answer today (the database already has it). */
  addAnswer: () => void
  reload: () => Promise<void>
}

const Ctx = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [state, setState] = useState<Omit<DataState, 'setLevel' | 'reload' | 'addAnswer'>>({
    loading: true, error: null, textbooks: [], lessons: [], cards: [], levels: new Map(), activity: new Map(),
  })

  const reload = useCallback(async () => {
    if (!profile) return
    try {
      const since = new Date(Date.now() - 400 * 86400e3).toISOString()
      const [tb, ls, cards, progress, answers] = await Promise.all([
        supabase.from('textbooks').select('*').order('position'),
        supabase.from('lessons').select('*').order('position'),
        fetchAll<Card>((a, b) => supabase.from('cards').select('*').order('created_at').range(a, b)),
        fetchAll<Progress>((a, b) => supabase.from('progress').select('card_id, dir, level').eq('user_id', profile.id).range(a, b)),
        fetchAll<{ answered_at: string }>((a, b) => supabase.from('answers').select('answered_at').eq('user_id', profile.id).gte('answered_at', since).order('answered_at').range(a, b))
          .catch(() => []),
      ])
      const activity = new Map<string, number>()
      for (const a of answers) { const k = dayKey(a.answered_at); activity.set(k, (activity.get(k) ?? 0) + 1) }
      if (tb.error || ls.error) throw tb.error || ls.error
      setState({
        loading: false, error: null,
        textbooks: tb.data as Textbook[], lessons: ls.data as Lesson[], cards,
        levels: new Map(progress.map(p => [pkey(p.card_id, p.dir), p.level])),
        activity,
      })
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Data se nepodařilo načíst. Zkontroluj připojení a obnov stránku.' }))
    }
  }, [profile])

  useEffect(() => { reload() }, [reload])

  const setLevel = useCallback((key: string, level: number) => {
    setState(s => { const m = new Map(s.levels); m.set(key, level); return { ...s, levels: m } })
  }, [])

  const addAnswer = useCallback(() => {
    setState(s => { const m = new Map(s.activity); const k = dayKey(new Date()); m.set(k, (m.get(k) ?? 0) + 1); return { ...s, activity: m } })
  }, [])

  return <Ctx.Provider value={{ ...state, setLevel, reload, addAnswer }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}
