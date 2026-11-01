// Pupils sign in with class code + nickname + PIN. Keep in sync with supabase/functions/pupil-auth.
export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const emailFor = (nickname: string, classCode: string) =>
  `${slugify(nickname)}.${classCode.trim().toLowerCase()}@pupil.invalid`

export const passwordFor = (pin: string, nickname: string) => `ec:${pin}:${slugify(nickname)}`
