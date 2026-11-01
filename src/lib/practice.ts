import { LEARNED, pkey, type Card, type Dir, type Grade } from './types'

// Same idea as v1: the lower the level, the more often a card comes back.
const WEIGHTS = [10, 6, 3, 1, 0.5, 0.25]
const NEW_WEIGHT = 4

export interface Item { card: Card; dir: Dir }

export const weightOf = (level: number | undefined) =>
  level === undefined ? NEW_WEIGHT : WEIGHTS[Math.min(level, WEIGHTS.length - 1)]

export function nextLevel(level: number | undefined, grade: Grade) {
  if (grade === 'knew') return (level ?? 0) + 1
  if (grade === 'partial') return level ?? 0
  return 0
}

export const isLearned = (level: number | undefined) => (level ?? -1) >= LEARNED

/** Weighted random pick that avoids repeating the last few cards. */
export function pick(pool: Item[], levels: Map<string, number>, recent: string[]): Item | null {
  if (!pool.length) return null
  const avoid = Math.min(3, Math.floor(pool.length / 2))
  const recentIds = recent.slice(-avoid)
  const candidates = pool.filter(p => !recentIds.includes(pkey(p.card.id, p.dir)))
  const list = candidates.length ? candidates : pool
  const total = list.reduce((s, p) => s + weightOf(levels.get(pkey(p.card.id, p.dir))), 0)
  let r = Math.random() * total
  for (const p of list) {
    r -= weightOf(levels.get(pkey(p.card.id, p.dir)))
    if (r <= 0) return p
  }
  return list[list.length - 1]
}
