import { callFunction } from './supabase'

export interface Match { message: string; offset: number; length: number; replacements: string[]; rule: string }

/** Checks British English spelling and grammar via LanguageTool (through our Edge Function). */
export async function checkGrammar(text: string): Promise<Match[]> {
  if (!text.trim()) return []
  const res = await callFunction<{ matches?: Match[]; error?: string }>('grammar', { text })
  if (!res.matches) throw new Error(res.error || 'Kontrola gramatiky teď nefunguje.')
  return res.matches
}

export const applyFix = (text: string, m: Match, replacement: string) =>
  text.slice(0, m.offset) + replacement + text.slice(m.offset + m.length)

/** Checks many short texts with a single request and maps findings back to each text. */
export async function checkMany(texts: string[]): Promise<Match[][]> {
  // The function accepts up to 2000 characters, so send long lists in batches.
  const out: Match[][] = []
  let batch: string[] = []
  const flush = async () => { if (batch.length) out.push(...await checkBatch(batch)); batch = [] }
  for (const t of texts) {
    if (batch.join('\n').length + t.length > 1800) await flush()
    batch.push(t)
  }
  await flush()
  return out
}

async function checkBatch(texts: string[]): Promise<Match[][]> {
  const joined = texts.join('\n')
  const all = await checkGrammar(joined)
  const starts: number[] = []
  let pos = 0
  for (const t of texts) { starts.push(pos); pos += t.length + 1 }
  const out: Match[][] = texts.map(() => [])
  for (const m of all) {
    let i = starts.length - 1
    while (i > 0 && starts[i] > m.offset) i--
    // A sentence-start rule can fire because lines were joined; ignore matches that span lines.
    if (m.offset + m.length > starts[i] + texts[i].length) continue
    out[i].push({ ...m, offset: m.offset - starts[i] })
  }
  return out
}

/** Splits "english ; česky ; poznámka" (also tab, =, or a dash with spaces). */
export function parseLine(line: string): { en: string; cz: string; note: string } | null {
  const seps = ['\t', ';', ' = ', ' – ', ' - ']
  const sep = seps.find(s => line.includes(s))
  if (!sep) return null
  const [en, cz, ...rest] = line.split(sep).map(s => s.trim())
  if (!en || !cz) return null
  return { en, cz, note: rest.join(' ').trim() }
}

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
