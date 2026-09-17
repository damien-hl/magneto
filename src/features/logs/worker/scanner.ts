export const CHUNK_BYTES = 1024 * 1024

export class Cancelled extends Error {}

export const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export interface ScanHooks {
  part(bytes: Uint8Array): void
  line(offset: number, length: number): void
  progress(bytes: number): void
  cancelled(): boolean
}

// LF is unambiguous in UTF-8. Byte offsets never depend on decoded string length.
// CRLF is trimmed even when CR and LF straddle two chunks. Bare CR is content.
export async function scan(file: Blob, hooks: ScanHooks, chunkSize = CHUNK_BYTES) {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
    throw new Error('Taille de bloc invalide.')
  }

  let first = -1
  let start = 0,
    last = -1

  for (let base = 0; base < file.size; base += chunkSize) {
    if (hooks.cancelled()) {
      throw new Cancelled()
    }

    const bytes = new Uint8Array(
      await file.slice(base, Math.min(base + chunkSize, file.size)).arrayBuffer(),
    )

    // A cancellation may arrive while the asynchronous disk read is pending.
    if (hooks.cancelled()) {
      throw new Cancelled()
    }

    if (base === 0) first = bytes[0] ?? -1
    const second = base === 0 ? bytes[1] : base === 1 ? bytes[0] : undefined

    if ((first === 255 && second === 254) || (first === 254 && second === 255)) {
      throw new Error('UTF-16 non pris en charge. Convertissez le fichier en UTF-8.')
    }

    let segment = 0,
      yieldedAt = performance.now()

    for (let i = 0; i < bytes.length; i++) {
      if (i % 16_384 === 0 && performance.now() - yieldedAt > 12) {
        await yieldTask()

        if (hooks.cancelled()) {
          throw new Cancelled()
        }

        yieldedAt = performance.now()
      }

      if (bytes[i] !== 10) {
        continue
      }

      if (segment < i) {
        hooks.part(bytes.subarray(segment, i))
      }

      const previous = i > 0 ? bytes[i - 1] : last

      hooks.line(start, base + i - start - (previous === 13 ? 1 : 0))

      start = base + i + 1
      segment = i + 1
    }

    if (segment < bytes.length) {
      hooks.part(bytes.subarray(segment))
    }

    if (bytes.length) {
      last = bytes[bytes.length - 1]!
    }

    hooks.progress(base + bytes.length)

    await yieldTask() // A macrotask lets cancel/search/viewport messages run.
  }

  if (hooks.cancelled()) {
    throw new Cancelled()
  }

  if (start < file.size) {
    hooks.line(start, file.size - start)
  }

  if (!file.size) {
    hooks.progress(0)
  }
}
