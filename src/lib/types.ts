export type Role = 'student' | 'editor' | 'admin'
export type Dir = 'en' | 'cz'
export type Grade = 'knew' | 'partial' | 'unknown'

export interface Profile { id: string; class_id: string; nickname: string; role: Role; created_at: string }
export interface ClassInfo { id: string; name: string; code: string }
export interface Textbook { id: string; title: string; position: number }
export interface Lesson { id: string; textbook_id: string; title: string; position: number }
export interface Card {
  id: string; lesson_id: string; en: string; cz: string; note: string
  status: 'pending' | 'approved'; created_by: string | null; created_at: string
}
export interface Progress { user_id: string; card_id: string; dir: Dir; level: number; seen: number; last_seen: string | null; learned_at: string | null }
export interface Answer { user_id: string; card_id: string; dir: Dir; grade: Grade; answered_at: string }

export const LEARNED = 3
export const pkey = (cardId: string, dir: Dir) => `${dir}|${cardId}`
