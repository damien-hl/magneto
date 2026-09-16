import type { Level } from '../types'

import { LEVELS } from '../constants'

export interface LogParser {
  level(prefix: string): Level | undefined
}

// Extension point: replace with a parser for your format. Only the first 8 KiB
// of each line is supplied; never parse an unbounded line into an object.
export const defaultParser: LogParser = {
  level(prefix) {
    return /\b(DEBUG|INFO|WARN|ERROR)\b/i.exec(prefix)?.[1]?.toUpperCase() as Level | undefined
  },
}

export const levelCode = (level?: Level) => (level ? LEVELS.indexOf(level) + 1 : 0)

export const levelName = (code: number) => (code ? LEVELS[code - 1] : undefined)
