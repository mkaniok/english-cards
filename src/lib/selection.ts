import { useEffect, useState } from 'react'
import type { Dir } from './types'

export type DirMode = Dir | 'mix'
export interface Selection { lessons: string[]; dir: DirMode }

const KEY = 'ec.selection'
const load = (): Selection => {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? ''); if (s && Array.isArray(s.lessons)) return s } catch { /* empty */ }
  return { lessons: [], dir: 'en' }
}

export function useSelection() {
  const [sel, setSel] = useState<Selection>(load)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(sel)) }, [sel])
  return [sel, setSel] as const
}

export const dirsOf = (d: DirMode): Dir[] => (d === 'mix' ? ['en', 'cz'] : [d])
