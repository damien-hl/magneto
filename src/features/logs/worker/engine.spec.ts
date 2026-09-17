// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { Engine } from './engine'
import { Matcher, parseTerms } from './matcher'
import { Cancelled, scan } from './scanner'
import { Budget, LineIndex, Results } from './storage'

const noop = () => {}
const never = () => false

async function indexed(text: string) {
  const engine = new Engine(new Blob([text]))
  await engine.build(never, noop)
  return engine
}

describe('lecture locale', () => {
  it('conserve les offsets UTF-8, les lignes vides et les fins CRLF entre blocs', async () => {
    const file = new Blob(['é\r\n\nINFO fin'])
    const entries: { offset: number; length: number }[] = []

    await scan(
      file,
      {
        part: noop,
        line: (offset, length) => entries.push({ offset, length }),
        progress: noop,
        cancelled: never,
      },
      3,
    )

    expect(entries).toEqual([
      { offset: 0, length: 2 },
      { offset: 4, length: 0 },
      { offset: 5, length: 8 },
    ])

    const engine = await indexed('é\r\n\nINFO fin')

    expect((await engine.row(0, 0)).text).toBe('é')
    expect((await engine.row(2, 2)).level).toBe('INFO')
  })

  it('ne crée pas de ligne fantôme après le dernier saut de ligne', async () => {
    expect((await indexed('')).count).toBe(0)
    expect((await indexed('INFO fin\n')).count).toBe(1)
    expect((await indexed('\n')).count).toBe(1)
  })

  it('combine les termes par ET et les niveaux par OU, puis réinitialise les résultats', async () => {
    const engine = await indexed(
      'INFO Payment timeout\nERROR TIMEOUT payment\nWARN payment\ninconnu',
    )

    await engine.search({ text: 'payment TIMEOUT', levels: ['ERROR', 'WARN'] }, never, noop)

    expect(engine.count).toBe(1)
    expect(engine.resultLine(0)).toBe(1)

    await engine.search({ text: '', levels: ['INFO', 'WARN'] }, never, noop)

    expect(engine.count).toBe(2)
    expect(engine.resultLine(1)).toBe(2)

    await engine.search({ text: '', levels: [] }, never, noop)

    expect(engine.count).toBe(4)
  })

  it('cherche au-delà de l’aperçu et tronque sans couper un caractère UTF-8', async () => {
    const engine = await indexed(`INFO ${'x'.repeat(5000)} aiguille\nééé`)

    await engine.search({ text: 'aiguille', levels: [] }, never, noop)

    expect(engine.count).toBe(1)
    expect((await engine.row(0, 0)).truncated).toBe(true)
    expect(await engine.row(1, 1, 3)).toMatchObject({ text: 'é', truncated: true })
  })

  it('refuse UTF-16 et interrompt une indexation annulée', async () => {
    const engine = new Engine(new Blob([new Uint8Array([255, 254, 65, 0])]))

    await expect(engine.build(never, noop)).rejects.toThrow('UTF-16')
    await expect(
      new Engine(new Blob(['INFO test'])).build(() => true, noop),
    ).rejects.toBeInstanceOf(Cancelled)
  })

  it('conserve les résultats partiels lors d’une recherche annulée', async () => {
    const engine = await indexed('INFO test\n'.repeat(100_000))

    let cancelled = false

    await engine.search(
      { text: '', levels: ['INFO'] },
      () => cancelled,
      (bytes) => {
        if (bytes > 0) cancelled = true
      },
    )

    expect(engine.count).toBe(65_536)
  })
})

describe('recherche en flux', () => {
  it('reconnaît un terme partagé entre blocs UTF-8 et ne mélange pas les lignes', () => {
    const matcher = new Matcher(['été', 'timeout'])
    const bytes = new TextEncoder().encode('ÉTÉ timeout')

    for (const byte of bytes) {
      matcher.part(new Uint8Array([byte]))
    }

    expect(matcher.end()).toBe(true)

    matcher.part(new TextEncoder().encode('été'))

    expect(matcher.end()).toBe(false)

    matcher.part(new TextEncoder().encode('timeout'))

    expect(matcher.end()).toBe(false)
  })

  it('déduplique les termes et borne les requêtes', () => {
    expect(parseTerms(' Timeout  TIMEOUT\tété ')).toEqual(['timeout', 'été'])
    expect(() => parseTerms('x'.repeat(1025))).toThrow('1 024')
    expect(() => parseTerms(Array.from({ length: 33 }, (_, i) => `t${i}`).join(' '))).toThrow('32')
  })
})

describe('stockage borné', () => {
  it('libère les blocs et rejette les accès hors limites', () => {
    const budget = new Budget()
    const index = new LineIndex(budget)
    const results = new Results(budget)

    index.add(2 ** 32, 12, 1)
    results.add(0)

    expect(index.get(0).offset).toBe(2 ** 32)
    expect(() => index.get(0.5)).toThrow('Ligne hors limite.')
    expect(() => results.get(1)).toThrow('Résultat hors limite.')

    index.clear()
    results.clear()

    expect(budget.used).toBe(0)
  })

  it('refuse une allocation au-delà du budget sans le modifier', () => {
    const budget = new Budget(1)

    expect(() => new LineIndex(budget).add(0, 1, 0)).toThrow('Limite')
    expect(budget.used).toBe(0)
  })
})
