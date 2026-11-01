const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
export const speechAvailable = !!synth && typeof SpeechSynthesisUtterance !== 'undefined'

// Voices load asynchronously in most browsers, so keep the list fresh.
let voices: SpeechSynthesisVoice[] = []
const loadVoices = () => { if (synth) voices = synth.getVoices() }
if (synth) {
  loadVoices()
  synth.addEventListener?.('voiceschanged', loadVoices)
}

/** Best available English voice: British first, then any English one. */
function englishVoice() {
  if (!voices.length) loadVoices()
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  return voices.find(v => norm(v.lang) === 'en-gb')
    ?? voices.find(v => norm(v.lang).startsWith('en'))
}

export function speak(text: string) {
  if (!synth || !speechAvailable) return
  // iOS only plays speech started synchronously inside the tap handler, so no timers here.
  if (synth.speaking || synth.pending) synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-GB'
  const v = englishVoice()
  if (v) u.voice = v
  u.rate = 0.9
  synth.speak(u)
}
