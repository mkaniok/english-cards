import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { fetchAll, supabase } from '../lib/supabase'
import { isLearned } from '../lib/practice'
import { dayKey, streakDays } from '../lib/dates'
import { pkey, type Answer } from '../lib/types'
import ProgressBar from '../components/ProgressBar'
import Tile from '../components/Tile'
import DayChart from '../components/DayChart'

export default function Stats() {
  const { profile } = useAuth()
  const { textbooks, lessons, cards, levels } = useData()
  const [answers, setAnswers] = useState<Answer[] | null>(null)

  useEffect(() => {
    if (!profile) return
    fetchAll<Answer>((a, b) => supabase.from('answers').select('card_id, dir, grade, answered_at').eq('user_id', profile.id).order('answered_at').range(a, b))
      .then(setAnswers).catch(() => setAnswers([]))
  }, [profile])

  const approved = useMemo(() => cards.filter(c => c.status === 'approved'), [cards])
  const learnedCard = (id: string) => isLearned(levels.get(pkey(id, 'en'))) || isLearned(levels.get(pkey(id, 'cz')))
  const totalLearned = approved.filter(c => learnedCard(c.id)).length

  const days = useMemo(() => new Set((answers ?? []).map(a => dayKey(a.answered_at))), [answers])
  const week = useMemo(() => {
    const since = Date.now() - 7 * 86400e3
    const w = (answers ?? []).filter(a => new Date(a.answered_at).getTime() >= since)
    return { n: w.length, knew: w.filter(a => a.grade === 'knew').length }
  }, [answers])

  const hardest = useMemo(() => {
    const m = new Map<string, { miss: number; total: number }>()
    for (const a of answers ?? []) {
      const e = m.get(a.card_id) ?? { miss: 0, total: 0 }
      e.total++
      if (a.grade !== 'knew') e.miss += a.grade === 'unknown' ? 1 : 0.5
      m.set(a.card_id, e)
    }
    return [...m.entries()].filter(([, e]) => e.miss > 0)
      .sort((a, b) => b[1].miss - a[1].miss).slice(0, 8)
      .map(([id, e]) => ({ card: cards.find(c => c.id === id), ...e })).filter(x => x.card)
  }, [answers, cards])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">📈 Moje statistiky</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon="⭐" value={totalLearned} label="naučených kartiček" />
        <Tile icon="🔥" value={streakDays(days)} label="dní v řadě" />
        <Tile icon="🃏" value={week.n} label="odpovědí za týden" />
        <Tile icon="🎯" value={week.n ? `${Math.round((week.knew / week.n) * 100)} %` : '–'} label="úspěšnost za týden" />
      </div>

      <section className="panel">
        <h2 className="label">Posledních 14 dní</h2>
        {answers === null ? <p className="font-bold">Načítám…</p> : <DayChart answers={answers} />}
      </section>

      <section className="panel">
        <h2 className="label">Lekce</h2>
        <div className="space-y-4">
          {textbooks.map(tb => {
            const ls = lessons.filter(l => l.textbook_id === tb.id && approved.some(c => c.lesson_id === l.id))
            if (!ls.length) return null
            return (
              <div key={tb.id}>
                <h3 className="mb-2 font-black">📘 {tb.title}</h3>
                <div className="space-y-2">
                  {ls.map(l => {
                    const lc = approved.filter(c => c.lesson_id === l.id)
                    const n = lc.filter(c => learnedCard(c.id)).length
                    return (
                      <div key={l.id}>
                        <div className="flex justify-between text-sm font-bold"><span>{l.title}</span><span>{n}/{lc.length}{n === lc.length ? ' 🏆' : ''}</span></div>
                        <ProgressBar value={n} max={lc.length} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Kartička je naučená, když ji víš třikrát za sebou (stačí v jednom směru).</p>
      </section>

      <section className="panel">
        <h2 className="label">Na tyhle si dej pozor</h2>
        {hardest.length === 0 ? <p className="font-bold text-slate-500">Zatím nic, jen tak dál! 💪</p> : (
          <ul className="divide-y divide-violet-100 dark:divide-slate-800">
            {hardest.map(h => (
              <li key={h.card!.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 font-extrabold">{h.card!.en}</span>
                <span className="flex-1 text-slate-500 dark:text-slate-400">{h.card!.cz}</span>
                <span className="text-sm font-bold text-rose-600">{h.total}× zkoušeno</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
