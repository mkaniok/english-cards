import { useEffect, useState } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1e1b4b' : '#7c3aed')
  }, [dark])
  const toggle = () => setDark(d => { localStorage.setItem('ec.theme', d ? 'light' : 'dark'); return !d })
  return { dark, toggle }
}
