// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { Engine } from './engine'
import { Cancelled, CHUNK_BYTES, scan } from './scanner'

const noop = () => {}
const never = () => false

describe('limites du scanner', () => {
  it('retrouve les octets des lignes pour toutes les coupures UTF-8 et CRLF', async () => {
    const text = 'é🙂\r\n\nété\n漢字\r\nfin\r'
    const file = new Blob([text])

    for (let size = 1; size <= 16; size++) {
      const entries: [number, number][] = []
      const progress: number[] = []

      await scan(
        file,
        {
          part: noop,
          line: (offset, length) => entries.push([offset, length]),
          progress: (bytes) => progress.push(bytes),
          cancelled: never,
        },
        size,
      )

      const lines = await Promise.all(
        entries.map(async ([offset, length]) =>
          new TextDecoder().decode(await file.slice(offset, offset + length).arrayBuffer()),
        ),
      )

      expect(lines).toEqual(['é🙂', '', 'été', '漢字', 'fin\r'])
      expect(progress.at(-1)).toBe(file.size)
      expect(progress).toEqual([...new Set(progress)].sort((a, b) => a - b))
    }
  })

  it('borne chaque lecture et le préfixe même pour une ligne de plusieurs Mio', async () => {
    const file = new Blob(['INFO ', 'x'.repeat(CHUNK_BYTES * 4), '🙂\r\nfin'])
    const slice = file.slice.bind(file)

    const reads: number[] = []

    file.slice = (start = 0, end = file.size) => {
      reads.push(end - start)
      return slice(start, end)
    }

    file.text = () => {
      throw new Error('Lecture intégrale interdite')
    }

    let longestPrefix = 0

    const engine = new Engine(file, {
      level: (prefix) => {
        longestPrefix = Math.max(longestPrefix, prefix.length)
        return undefined
      },
    })

    await engine.build(never, noop)
    expect(engine.count).toBe(2)
    expect(engine.index.get(0).length).toBe(CHUNK_BYTES * 4 + 9)
    expect(engine.index.get(1).offset).toBe(CHUNK_BYTES * 4 + 11)
    expect(Math.max(...reads)).toBeLessThanOrEqual(CHUNK_BYTES)
    expect(longestPrefix).toBe(8192)
    expect(engine.budget.used).toBe(65_536 * 13)
    expect((await engine.row(1, 1)).text).toBe('fin')
  })

  it('ne traite aucun octet si une annulation arrive pendant la lecture', async () => {
    const file = new Blob(['INFO test'])

    let cancelled = false

    file.slice = () =>
      ({
        arrayBuffer: () => {
          cancelled = true
          return Promise.resolve(new ArrayBuffer(9))
        },
      }) as Blob

    const engine = new Engine(file)

    await expect(engine.build(() => cancelled, noop)).rejects.toBeInstanceOf(Cancelled)

    expect(engine.count).toBe(0)
    expect(engine.budget.used).toBe(0)
  })

  it('libère un index partiel après annulation et permet une nouvelle indexation', async () => {
    const engine = new Engine(new Blob(['INFO test\n'.repeat(150_000)]))

    let cancelled = false

    await expect(
      engine.build(
        () => cancelled,
        () => {
          cancelled = true
        },
      ),
    ).rejects.toBeInstanceOf(Cancelled)

    expect(engine.budget.used).toBe(0)
    expect(engine.count).toBe(0)

    await engine.build(never, noop)
    expect(engine.count).toBe(150_000)

    await engine.build(never, noop)
    expect(engine.count).toBe(150_000)
  })

  it('libère les blocs après une erreur de lecture ou un dépassement du budget', async () => {
    const file = new Blob(['INFO test\n'.repeat(150_000)])
    const slice = file.slice.bind(file)

    file.slice = (start = 0, end) => {
      if (start) throw new Error('Lecture impossible')
      return slice(start, end)
    }

    const engine = new Engine(file)

    await expect(engine.build(never, noop)).rejects.toThrow('Lecture impossible')
    expect(engine.budget.used).toBe(0)
    expect(engine.count).toBe(0)

    const limited = new Engine(new Blob(['\n'.repeat(65_537)]))
    limited.budget.reserve(limited.budget.max - 65_536 * 13)

    await expect(limited.build(never, noop)).rejects.toThrow('Limite')
    expect(limited.index.count).toBe(0)
    expect(limited.budget.used).toBe(limited.budget.max - 65_536 * 13)
  })

  it('refuse les blocs invalides et détecte aussi un BOM UTF-16 coupé', async () => {
    const hooks = { part: noop, line: noop, progress: noop, cancelled: never }

    for (const size of [0, -1, 1.5, Number.NaN]) {
      await expect(scan(new Blob(['a']), hooks, size)).rejects.toThrow('Taille de bloc')
    }

    await expect(scan(new Blob([new Uint8Array([255, 254])]), hooks, 1)).rejects.toThrow('UTF-16')
  })
})
