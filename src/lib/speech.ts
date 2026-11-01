const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
export const speechAvailable = canSpeak

export function speak(text: string) {
  if (!canSpeak) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  const v = speechSynthesis.getVoices().find(v => v.lang === 'en-GB' || v.lang === 'en_GB')
  if (v) u.voice = v
  u.rate = 0.9
  speechSynthesis.speak(u)
}
