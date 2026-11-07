/** Keeps the last few JavaScript errors so a bug report can include them. */
const MAX = 5
const recent: string[] = []

function remember(msg: string) {
  const line = `${new Date().toLocaleTimeString('cs-CZ')} ${msg}`.slice(0, 700)
  if (recent[recent.length - 1] === line) return
  recent.push(line)
  if (recent.length > MAX) recent.shift()
}

export function installErrorLog() {
  window.addEventListener('error', e => {
    remember(`${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`)
  })
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason
    remember(`Promise: ${r instanceof Error ? r.message : String(r)}`)
  })
}

export const recentErrors = () => recent.join('\n')

/** Short description of the device, without anything that identifies the person. */
export function deviceInfo() {
  const ua = navigator.userAgent
  const standalone = window.matchMedia('(display-mode: standalone)').matches ? ', z plochy' : ''
  return `${ua} | okno ${window.innerWidth}×${window.innerHeight}, ${navigator.language}${standalone}`.slice(0, 500)
}
