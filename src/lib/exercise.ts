import type { Card, Dir, Grade } from './types'

/** How a pupil practises: flip cards and grade yourself, or one of three checked levels. */
export type Mode = 'flip' | 'choice' | 'scramble' | 'type'

export const MODES: { id: Mode; level: string; label: string; emoji: string; hint: string }[] = [
  { id: 'flip', level: '', label: 'Kartičky', emoji: '🃏', hint: 'Otočíš a sám se ohodnotíš' },
  { id: 'choice', level: 'Úroveň 1', label: 'Výběr ze 4', emoji: '🔢', hint: 'Vybereš správný překlad ze 4 možností' },
  { id: 'scramble', level: 'Úroveň 2', label: 'Skládání', emoji: '🧩', hint: 'Složíš anglické slovo z přeházených písmen' },
  { id: 'type', level: 'Úroveň 3', label: 'Psaní', emoji: '⌨️', hint: 'Napíšeš celý překlad' },
]

/** Letter scrambling only makes sense when the answer is English (Czech → English). */
export const modeAllowsDir = (mode: Mode, dir: Dir) => mode !== 'scramble' || dir === 'cz'

export const answerOf = (card: Card, dir: Dir) => (dir === 'en' ? card.cz : card.en)
export const questionOf = (card: Card, dir: Dir) => (dir === 'en' ? card.en : card.cz)

export function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- Level 1: multiple choice ----------

/**
 * The right answer plus up to three wrong ones. Wrong answers come from the cards being practised
 * (same lesson first, so they look alike), then from any other card.
 */
export function choicesFor(card: Card, dir: Dir, pool: Card[], all: Card[]): string[] {
  const right = answerOf(card, dir)
  const seen = new Set([norm(right)])
  const wrong: string[] = []
  const take = (cards: Card[]) => {
    for (const c of shuffle(cards)) {
      if (wrong.length >= 3) return
      const a = answerOf(c, dir)
      if (seen.has(norm(a))) continue
      seen.add(norm(a)); wrong.push(a)
    }
  }
  take(pool.filter(c => c.lesson_id === card.lesson_id))
  take(pool)
  take(all.filter(c => c.status === 'approved'))
  return shuffle([right, ...wrong])
}

// ---------- Level 2: letter scramble ----------

/** One position of the word: a letter to place, or a fixed character (space, hyphen, apostrophe…) shown from the start. */
export type Slot = { fixed: true; ch: string } | { fixed: false; ch: string }

/** "a hundred / one hundred" → "a hundred"; "carrots (pl.)" → "carrots". */
export function scrambleTarget(en: string) {
  return en.split('/')[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
}

const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch)

export function slotsOf(word: string): Slot[] {
  return [...word].map(ch => (isLetter(ch) ? { fixed: false, ch } : { fixed: true, ch }))
}

/** The letters to place, shuffled; never left in the right order if it can be helped. */
export function scrambledLetters(word: string): string[] {
  const letters = [...word].filter(isLetter)
  if (new Set(letters.map(l => l.toLowerCase())).size < 2) return letters
  for (let i = 0; i < 20; i++) {
    const s = shuffle(letters)
    if (s.join('') !== letters.join('')) return s
  }
  return letters
}

// ---------- Level 3: typing ----------

export interface TypedResult {
  grade: Grade
  /** Short Czech explanation shown to the pupil when the answer is almost right. */
  hint?: string
}

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Lower case, unified quotes and dashes, no end punctuation, single spaces. */
export function norm(s: string) {
  return s.toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s*[–—]\s*/g, ' - ')
    .replace(/\s+-\s*|\s*-\s+/g, ' - ')
    .replace(/[.!?,;:„“"…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Every way of writing the answer that counts as right.
 * "matka, maminka" → matka | maminka; "a hundred / one hundred" → both; "guma (na gumování)" → with or without the bracket.
 */
export function acceptedAnswers(answer: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => { const n = norm(s); if (n) out.add(n) }
  const variants = [answer, answer.replace(/\([^)]*\)/g, ' '), answer.replace(/[()]/g, ' ')]
  for (const v of variants) {
    add(v)
    for (const part of v.split(/[,/;]/)) add(part)
  }
  // "5 (pět)": the number alone or the word in the bracket alone.
  for (const m of answer.matchAll(/\(([^)]*)\)/g)) add(m[1])
  return [...out]
}

const ARTICLE = /^(a|an|the) /

function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Right, almost right (missing article, missing accents, one typo) or wrong. */
export function checkTyped(input: string, answer: string, dir: Dir): TypedResult {
  const got = norm(input)
  if (!got) return { grade: 'unknown' }
  const ok = acceptedAnswers(answer)
  if (ok.includes(got)) return { grade: 'knew' }

  if (dir === 'cz') {
    // English answer: "mother" for "a mother".
    if (ok.some(a => ARTICLE.test(a) && a.replace(ARTICLE, '') === got.replace(ARTICLE, '')))
      return { grade: 'partial', hint: 'Skoro! Nezapomeň na člen (a / an / the).' }
    if (ok.some(a => a.replace(/-/g, ' ') === got.replace(/-/g, ' ')))
      return { grade: 'partial', hint: 'Skoro! Pozor na spojovník (-).' }
  } else if (ok.some(a => stripDiacritics(a) === stripDiacritics(got))) {
    return { grade: 'partial', hint: 'Skoro! Chybí háčky nebo čárky.' }
  }
  const bare = (s: string) => s.replace(ARTICLE, '')
  if (bare(got).length >= 4 && ok.some(a => bare(a).length >= 4 && distance(bare(a), bare(got)) <= 1))
    return { grade: 'partial', hint: 'Skoro! Jen jeden překlep.' }
  return { grade: 'unknown' }
}
