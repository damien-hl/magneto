import type { Query, Row } from '../types'

import { Matcher, parseTerms } from './matcher'
import { defaultParser, levelCode, levelName, type LogParser } from './parser'
import { scan, yieldTask } from './scanner'
import { Budget, LineIndex, Results } from './storage'

export class Engine {
  readonly budget = new Budget()
  readonly index = new LineIndex(this.budget)

  results = new Results(this.budget)

  identity = true

  constructor(
    readonly file: Blob,
    private parser: LogParser = defaultParser,
  ) {}

  get count() {
    return this.identity ? this.index.count : this.results.count
  }

  async build(cancelled: () => boolean, progress: (bytes: number) => void) {
    const prefix = new Uint8Array(8192)

    let used = 0

    await scan(this.file, {
      cancelled,
      progress,
      part: (bytes) => {
        const n = Math.min(bytes.length, prefix.length - used)
        prefix.set(bytes.subarray(0, n), used)
        used += n
      },
      line: (offset, length) => {
        const text = new TextDecoder().decode(prefix.subarray(0, used))
        this.index.add(offset, length, levelCode(this.parser.level(text)))
        used = 0
      },
    })
  }

  async search(query: Query, cancelled: () => boolean, progress: (bytes: number) => void) {
    const terms = parseTerms(query.text),
      levels = new Set(query.levels.map(levelCode))

    this.results.clear()
    this.identity = terms.length === 0 && levels.size === 0

    if (this.identity) {
      progress(this.file.size)
      return
    }

    if (!terms.length) {
      for (let i = 0; i < this.index.count; i++) {
        if (i % 65_536 === 0) {
          if (cancelled()) {
            return
          }

          progress(this.index.get(i).offset)

          await yieldTask()

          if (cancelled()) {
            return
          }
        }

        if (levels.has(this.index.get(i).level)) {
          this.results.add(i)
        }
      }

      progress(this.file.size)

      return
    }

    const matcher = new Matcher(terms)

    let line = 0

    await scan(this.file, {
      cancelled,
      progress,
      part: (bytes) => matcher.part(bytes),
      line: () => {
        const matches = matcher.end()

        if (matches && (!levels.size || levels.has(this.index.get(line).level))) {
          this.results.add(line)
        }

        line++
      },
    })
  }

  async row(line: number, position: number, previewBytes = 4096): Promise<Row> {
    const entry = this.index.get(line)
    const end = Math.min(entry.length, previewBytes)

    const bytes = await this.file.slice(entry.offset, entry.offset + end).arrayBuffer()

    // stream:true avoids a replacement character for a preview cut inside UTF-8.
    const text = new TextDecoder().decode(bytes, { stream: end < entry.length })

    return {
      position,
      line,
      ...entry,
      level: levelName(entry.level),
      text,
      truncated: end < entry.length,
    }
  }

  resultLine(position: number) {
    return this.identity ? position : this.results.get(position)
  }
}
