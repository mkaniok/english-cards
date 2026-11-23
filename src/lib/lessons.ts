import { useMemo } from 'react'
import { useData } from './data'
import { isLearned } from './practice'
import { dirsOf, type Selection } from './selection'
import { pkey, type Card, type Lesson } from './types'

/** "1A – At home" -> code "1A", name "At home"; titles without a number stay whole. */
export function splitTitle(title: string) {
  const m = title.match(/^(\d+[A-Za-z]?)\s*[–-]\s*(.+)$/)
  return m ? { code: m[1], name: m[2] } : { code: '', name: title }
}

/** Groups lessons whose titles start with the same number (1A, 1B, 1 – Data → unit 1), keeping order. */
export function groupLessons(ls: Lesson[]) {
  const groups: { unit: string | null; lessons: Lesson[] }[] = []
  for (const l of ls) {
    const unit = l.title.match(/^(\d+)/)?.[1] ?? null
    const existing = unit ? groups.find(g => g.unit === unit) : undefined
    if (existing) existing.lessons.push(l)
    else if (unit) groups.push({ unit, lessons: [l] })
    else groups.push({ unit: null, lessons: [l] })
  }
  return groups
}

export interface LessonStat { cards: number; total: number; learned: number }

/** Approved cards per lesson and how many are learned, in the directions the pupil practises. */
export function useLessonStats(sel: Selection) {
  const { cards, levels } = useData()
  const byLesson = useMemo(() => {
    const m = new Map<string, Card[]>()
    for (const c of cards) if (c.status === 'approved') m.set(c.lesson_id, [...(m.get(c.lesson_id) ?? []), c])
    return m
  }, [cards])
  const dirs = dirsOf(sel.dir, sel.mode)
  const stat = (ids: string[]): LessonStat => {
    let n = 0, total = 0, learned = 0
    for (const id of ids) for (const c of byLesson.get(id) ?? []) {
      n++
      for (const d of dirs) { total++; if (isLearned(levels.get(pkey(c.id, d)))) learned++ }
    }
    return { cards: n, total, learned }
  }
  return { byLesson, stat }
}

/** Badge colours: done, started, new. */
export const lessonTone = (s: LessonStat) =>
  s.total && s.learned === s.total ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
    : s.learned ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
    : 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'
