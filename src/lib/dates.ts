export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Consecutive days with at least one answer, ending today (or yesterday, so the streak survives until evening). */
export function streakDays(days: Set<string>) {
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export const relTime = (iso: string | null) => {
  if (!iso) return 'nikdy'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 3600) return 'před chvílí'
  if (diff < 86400) return `před ${Math.round(diff / 3600)} h`
  const days = Math.round(diff / 86400)
  return days === 1 ? 'včera' : `před ${days} dny`
}
