import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchAll, supabase } from './supabase'
import { useAuth } from './auth'
import { pkey, type Card, type Lesson, type Progress, type Textbook } from './types'

interface DataState {
  loading: boolean
  error: string | null
  textbooks: Textbook[]
  lessons: Lesson[]
  cards: Card[]
  levels: Map<string, number>
  setLevel: (key: string, level: number) => void
  reload: () => Promise<void>
}

const Ctx = createContext<DataState | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [state, setState] = useState<Omit<DataState, 'setLevel' | 'reload'>>({
    loading: true, error: null, textbooks: [], lessons: [], cards: [], levels: new Map(),
  })

  const reload = useCallback(async () => {
    if (!profile) return
    try {
      const [tb, ls, cards, progress] = await Promise.all([
        supabase.from('textbooks').select('*').order('position'),
        supabase.from('lessons').select('*').order('position'),
        fetchAll<Card>((a, b) => supabase.from('cards').select('*').order('created_at').range(a, b)),
        fetchAll<Progress>((a, b) => supabase.from('progress').select('card_id, dir, level').eq('user_id', profile.id).range(a, b)),
      ])
      if (tb.error || ls.error) throw tb.error || ls.error
      setState({
        loading: false, error: null,
        textbooks: tb.data as Textbook[], lessons: ls.data as Lesson[], cards,
        levels: new Map(progress.map(p => [pkey(p.card_id, p.dir), p.level])),
      })
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Data se nepodařilo načíst. Zkontroluj připojení a obnov stránku.' }))
    }
  }, [profile])

  useEffect(() => { reload() }, [reload])

  const setLevel = useCallback((key: string, level: number) => {
    setState(s => { const m = new Map(s.levels); m.set(key, level); return { ...s, levels: m } })
  }, [])

  return <Ctx.Provider value={{ ...state, setLevel, reload }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}
