export function parseTerms(text: string) {
  if (text.length > 1024) {
    throw new Error('La recherche est limitée à 1 024 caractères.')
  }

  const terms = [...new Set(text.toLowerCase().split(/\s+/u).filter(Boolean))]
  if (terms.length > 32) {
    throw new Error('La recherche est limitée à 32 termes.')
  }

  return terms
}

// Streaming AND matcher: each term may cross byte/chunk/UTF-8 boundaries.
// Retains only a tail as long as the longest term, never the entire line.
export class Matcher {
  private decoder = new TextDecoder('utf-8')
  private tail = ''
  private found: boolean[]
  private overlap: number

  constructor(private terms: string[]) {
    this.found = terms.map(() => false)
    this.overlap = Math.max(0, ...terms.map((t) => t.length - 1))
  }

  part(bytes: Uint8Array) {
    this.text(this.decoder.decode(bytes, { stream: true }))
  }

  private text(text: string) {
    const window = this.tail + text.toLowerCase()

    this.terms.forEach((term, i) => {
      if (!this.found[i] && window.includes(term)) this.found[i] = true
    })

    this.tail = this.overlap ? window.slice(-this.overlap) : ''
  }

  end() {
    this.text(this.decoder.decode())

    const matches = this.found.every(Boolean)

    this.found.fill(false)
    this.tail = ''

    return matches
  }
}
