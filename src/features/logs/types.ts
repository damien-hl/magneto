import type { LEVELS } from './constants'

export type Level = (typeof LEVELS)[number]

export type Phase = 'index' | 'search'

export interface Query {
  text: string
  levels: Level[]
}

export interface Row {
  position: number
  line: number
  offset: number
  length: number
  level?: Level
  text: string
  truncated: boolean
}

export type Request =
  | { type: 'open'; id: number; file: File }
  | { type: 'search'; id: number; query: Query }
  | { type: 'cancel'; id: number }
  | { type: 'rows'; id: number; queryId: number; start: number; count: number }
  | { type: 'context'; id: number; line: number; radius: number }

export type Response =
  | {
      type: 'progress'
      id: number
      phase: Phase
      bytes: number
      total: number
      lines: number
      matches: number
      memory: number
    }
  | { type: 'indexed'; id: number; lines: number; memory: number }
  | { type: 'searched'; id: number; count: number; partial: boolean; memory: number }
  | { type: 'cancelled'; id: number; phase: 'index' }
  | { type: 'rows'; id: number; queryId: number; rows: Row[] }
  | { type: 'context'; id: number; rows: Row[] }
  | { type: 'error'; id: number; message: string }
