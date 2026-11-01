import { createClient } from '@supabase/supabase-js'

// The publishable key is meant to be public; access is enforced by Row Level Security.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ldujkfiltxpilzeoznmy.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4Ao1q_ff8_n8Zjxas4ltww_fq1C1X1K'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ec.auth' },
})

/** Fetch every row of a query, page by page (PostgREST returns at most 1000 at a time). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < size) return out
  }
}

export async function callFunction<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // Surface the function's own Czech error message when there is one.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json()
        if (j?.error) throw new Error(j.error)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw new Error('Spojení se nepovedlo. Zkus to znovu.')
  }
  return data as T
}
