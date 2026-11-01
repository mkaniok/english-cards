import { useMemo } from 'react'

const COLOURS = ['#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#f43f5e']

export default function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    dur: 2 + Math.random() * 2,
    colour: COLOURS[i % COLOURS.length],
    rot: Math.random() * 360,
  })), [count])
  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece" style={{
          left: `${p.left}vw`, background: p.colour, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  )
}
