import { useCallback, useState } from 'react'

/** Small per-device settings kept in the browser. */
export interface Prefs {
  /** Cards to answer per day. */
  goal: number
  /** Short sounds after an answer. */
  sounds: boolean
  /** Phone vibration after an answer (Android; iPhone browsers don't support it). */
  haptics: boolean
}

const KEY = 'ec.prefs'
const DEFAULTS: Prefs = { goal: 10, sounds: true, haptics: true }
export const GOALS = [5, 10, 20, 30]

export function loadPrefs(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs(p => {
      const next = { ...p, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [])
  return [prefs, update] as const
}

export const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator

let ctx: AudioContext | null = null
function tone(freqs: number[], step = 0.09) {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain()
      o.type = 'sine'; o.frequency.value = f
      const t = t0 + i * step
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + step + 0.12)
      o.connect(g).connect(ctx!.destination)
      o.start(t); o.stop(t + step + 0.15)
    })
  } catch { /* no audio */ }
}

/** Sound and vibration after a checked answer, as the pupil set them in Profil. */
export function answerFeedback(right: boolean | 'partial') {
  const p = loadPrefs()
  if (p.sounds) tone(right === true ? [660, 880] : right === 'partial' ? [520, 600] : [300, 220], 0.1)
  if (p.haptics && canVibrate) navigator.vibrate(right === true ? 30 : [60, 50, 60])
}
