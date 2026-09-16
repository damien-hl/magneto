const BLOCK = 65_536

export class Budget {
  used = 0

  constructor(readonly max = 256 * 1024 * 1024) {}

  reserve(bytes: number) {
    if (this.used + bytes > this.max) {
      throw new Error(
        'Limite de 256 Mio atteinte pour l’index et les résultats. Réduisez ou découpez le fichier.',
      )
    }

    this.used += bytes
  }

  release(bytes: number) {
    this.used -= bytes
  }
}

// Separate arrays avoid JS object overhead and doubling reallocations.
export class LineIndex {
  private blocks: { offsets: Float64Array; lengths: Uint32Array; levels: Uint8Array }[] = []

  count = 0

  constructor(private budget: Budget) {}

  add(offset: number, length: number, level: number) {
    if (length > 0xffff_ffff) {
      throw new Error('Une ligne dépasse 4 Gio : format non pris en charge.')
    }

    if (this.count >= 0xffff_ffff) {
      throw new Error('Trop de lignes pour cet index.')
    }

    const slot = this.count % BLOCK

    if (!slot) {
      this.budget.reserve(BLOCK * 13)
      this.blocks.push({
        offsets: new Float64Array(BLOCK),
        lengths: new Uint32Array(BLOCK),
        levels: new Uint8Array(BLOCK),
      })
    }

    const block = this.blocks[Math.floor(this.count / BLOCK)]!

    block.offsets[slot] = offset
    block.lengths[slot] = length
    block.levels[slot] = level

    this.count++
  }

  get(line: number) {
    if (!Number.isInteger(line) || line < 0 || line >= this.count) {
      throw new Error('Ligne hors limite.')
    }

    const b = this.blocks[Math.floor(line / BLOCK)]!,
      i = line % BLOCK

    return { offset: b.offsets[i]!, length: b.lengths[i]!, level: b.levels[i]! }
  }

  clear() {
    this.budget.release(this.blocks.length * BLOCK * 13)
    this.blocks = []
    this.count = 0
  }
}

export class Results {
  private blocks: Uint32Array[] = []

  count = 0

  constructor(private budget: Budget) {}

  add(line: number) {
    if (this.count % BLOCK === 0) {
      this.budget.reserve(BLOCK * 4)
      this.blocks.push(new Uint32Array(BLOCK))
    }

    this.blocks[Math.floor(this.count / BLOCK)]![this.count % BLOCK] = line

    this.count++
  }

  get(i: number) {
    if (!Number.isInteger(i) || i < 0 || i >= this.count) {
      throw new Error('Résultat hors limite.')
    }
    return this.blocks[Math.floor(i / BLOCK)]![i % BLOCK]!
  }

  clear() {
    this.budget.release(this.blocks.length * BLOCK * 4)
    this.blocks = []
    this.count = 0
  }
}
