import { useCallback, useEffect, useState } from 'react'

/** auto follows the phone's setting; light and dark are fixed. Stored as before: no value means auto. */
export type ThemeMode = 'auto' | 'light' | 'dark'
const KEY = 'ec.theme'
const media = () => matchMedia('(prefers-color-scheme: dark)')

const readMode = (): ThemeMode => {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch { return 'auto' }
}

function apply(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'auto' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  // Status bar / browser toolbar colour follows the page background.
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.setAttribute('content', dark ? '#0b0a14' : '#f7f5ff')
  return dark
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    setDark(apply(mode))
    if (mode !== 'auto') return
    const mq = media()
    const onChange = () => setDark(apply('auto'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const setMode = useCallback((m: ThemeMode) => {
    try { if (m === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m) } catch { /* private mode */ }
    setModeState(m)
  }, [])
  const toggle = () => setMode(dark ? 'light' : 'dark')
  return { mode, setMode, dark, toggle }
}
