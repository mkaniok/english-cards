import { useEffect, useState } from 'react'
import type { Dir } from './types'
import type { Mode } from './exercise'

export type DirMode = Dir | 'mix'
/** round = cards per round; a summary follows each round. */
export interface Selection { lessons: string[]; dir: DirMode; mode: Mode; round: number }
export const ROUNDS = [5, 10, 20]

const KEY = 'ec.selection'
const load = (): Selection => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '')
    if (s && Array.isArray(s.lessons)) return { mode: 'flip', round: 10, ...s }
  } catch { /* empty */ }
  return { lessons: [], dir: 'en', mode: 'flip', round: 10 }
}

export function useSelection() {
  const [sel, setSel] = useState<Selection>(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(sel)) } catch { /* private mode */ } }, [sel])
  return [sel, setSel] as const
}

/** Directions practised. Scrambling builds English words, so it always runs Czech → English. */
export const dirsOf = (d: DirMode, mode: Mode = 'flip'): Dir[] => (mode === 'scramble' ? ['cz'] : d === 'mix' ? ['en', 'cz'] : [d])
