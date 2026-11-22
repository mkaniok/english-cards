import { useEffect, useState } from 'react'
import type { Dir } from './types'
import type { Mode } from './exercise'

export type DirMode = Dir | 'mix'
export interface Selection { lessons: string[]; dir: DirMode; mode: Mode }

const KEY = 'ec.selection'
const load = (): Selection => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '')
    if (s && Array.isArray(s.lessons)) return { mode: 'flip', ...s }
  } catch { /* empty */ }
  return { lessons: [], dir: 'en', mode: 'flip' }
}

export function useSelection() {
  const [sel, setSel] = useState<Selection>(load)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(sel)) }, [sel])
  return [sel, setSel] as const
}

/** Directions practised. Scrambling builds English words, so it always runs Czech → English. */
export const dirsOf = (d: DirMode, mode: Mode = 'flip'): Dir[] => (mode === 'scramble' ? ['cz'] : d === 'mix' ? ['en', 'cz'] : [d])
