import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { mkdir, open, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { preview } from 'vite'

const exec = promisify(execFile)

const sizes = (process.env.BENCH_SIZES || '100,500,1000').split(',').map(Number)

const repeats = Number(process.env.BENCH_REPEATS || 3)

if (
  sizes.some((size) => !Number.isSafeInteger(size) || size <= 0) ||
  !Number.isSafeInteger(repeats) ||
  repeats < 1
) {
  throw new Error('Paramètres invalides')
}

const directory = path.resolve('benchmarks/local')
await mkdir(directory, { recursive: true })

// 256 bytes per line, deterministic UTF-8 + CRLF, written in bounded blocks.
const prefix = Buffer.from('2026-01-01T00:00:00Z INFO requête été 🙂 ')
const line = Buffer.concat([prefix, Buffer.alloc(254 - prefix.length, 120), Buffer.from('\r\n')])

const block = Buffer.alloc(1024 * 1024)

for (let offset = 0; offset < block.length; offset += line.length) {
  line.copy(block, offset)
}

async function fixture(size) {
  const bytes = size * 1_000_000

  const filename = path.join(directory, `${size}MB.log`)
  const file = await open(filename, 'w')

  try {
    for (let written = 0; written < bytes;) {
      const chunk = block.subarray(0, Math.min(block.length, bytes - written))
      await file.writeFile(chunk)
      written += chunk.length
    }
  } finally {
    await file.close()
  }

  return { filename, bytes }
}

async function rss(root) {
  const { stdout } = await exec('ps', ['-axo', 'pid=,ppid=,rss='])

  const rows = stdout
    .trim()
    .split('\n')
    .map((row) => row.trim().split(/\s+/).map(Number))

  const descendants = new Set([root])

  let changed = true

  while (changed) {
    changed = false

    for (const [pid, parent] of rows) {
      if (descendants.has(parent) && !descendants.has(pid)) {
        descendants.add(pid)
        changed = true
      }
    }
  }

  return rows.reduce(
    (total, [pid, , memory]) => total + (descendants.has(pid) ? memory * 1024 : 0),
    0,
  )
}

const server = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } })

const report = {
  createdAt: new Date().toISOString(),
  platform: `${os.platform()} ${os.release()} ${os.arch()}`,
  cpu: os.cpus()[0]?.model,
  ramBytes: os.totalmem(),
  node: process.version,
  repeats,
  samples: [],
}

try {
  for (const size of sizes) {
    const { filename, bytes } = await fixture(size)

    for (let run = 1; run <= repeats; run++) {
      const browserServer = await chromium.launchServer({ headless: true })
      const browser = await chromium.connect(browserServer.wsEndpoint())

      try {
        report.chromium = browser.version()

        const page = await browser.newPage()

        await page.addInitScript(() => {
          const samples = []
          const idleSamples = []
          const longTasks = []

          let start = 0
          let end = Infinity
          let lastFrame = 0
          let active = false
          let frames = 0

          const frame = (now) => {
            if (active) {
              samples.push(now - lastFrame)
              frames++
            } else if (!start && lastFrame) {
              idleSamples.push(now - lastFrame)
            }

            lastFrame = now

            requestAnimationFrame(frame)
          }

          requestAnimationFrame(frame)

          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.startTime >= start && entry.startTime <= end && start) {
                longTasks.push(entry.duration)
              }
            }
          })

          observer.observe({ type: 'longtask', buffered: false })

          const NativeWorker = window.Worker

          window.Worker = class extends NativeWorker {
            postMessage(message, ...options) {
              if (message.type === 'open') {
                start = performance.now()
                lastFrame = start
                active = true
              }

              return super.postMessage(message, ...options)
            }

            constructor(...args) {
              super(...args)

              this.addEventListener('message', ({ data }) => {
                if (data.type === 'error') window.benchmarkError = data.message

                if (data.type !== 'indexed') return

                end = performance.now()

                samples.push(end - lastFrame)

                const elapsedMs = end - start

                active = false

                // Allow the observer to deliver its final records.
                setTimeout(() => {
                  const ordered = samples.toSorted((a, b) => a - b)
                  const idle = idleSamples.toSorted((a, b) => a - b)

                  window.benchmarkResult = {
                    idleFrameGapP95Ms: idle[Math.floor(idle.length * 0.95)] ?? null,
                    elapsedMs,
                    lines: data.lines,
                    indexBytes: data.memory,
                    linesPerSecond: data.lines / (elapsedMs / 1000),
                    frames,
                    frameGapP95Ms: ordered[Math.floor(ordered.length * 0.95)] ?? null,
                    frameGapMaxMs: ordered.at(-1) ?? null,
                    longTasks: longTasks.length,
                    longTaskTotalMs: longTasks.reduce((a, b) => a + b, 0),
                  }
                }, 100)
              })
            }
          }
        })

        await page.goto('http://127.0.0.1:4173')
        await page.waitForTimeout(500)

        const baseline = await rss(browserServer.process().pid)

        let peak = baseline
        let sampling = true
        let rssSamples = 0

        const sampler = (async () => {
          while (sampling) {
            peak = Math.max(peak, await rss(browserServer.process().pid))
            rssSamples++

            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        })()

        let result

        try {
          await page.getByLabel('Choisir un fichier de logs').setInputFiles(filename)
          await page.waitForFunction(
            () => window.benchmarkResult || window.benchmarkError,
            undefined,
            { timeout: 600_000 },
          )

          result = await page.evaluate(() => {
            if (window.benchmarkError) {
              throw new Error(window.benchmarkError)
            }

            return window.benchmarkResult
          })
        } finally {
          sampling = false
          await sampler
        }

        if (result.lines !== Math.ceil(bytes / 256)) {
          throw new Error('Nombre de lignes incorrect')
        }

        report.samples.push({
          sizeMB: size,
          bytes,
          run,
          ...result,
          browserRssBaselineBytes: baseline,
          browserRssPeakBytes: peak,
          browserRssDeltaBytes: peak - baseline,
          rssSamples,
        })

        await writeFile(
          path.join(directory, 'results.json'),
          JSON.stringify(report, null, 2) + '\n',
        )

        process.stdout.write(
          `${size} Mo, essai ${run}: ${(result.elapsedMs / 1000).toFixed(2)} s, ${Math.round(result.linesPerSecond)} lignes/s\n`,
        )
      } finally {
        await browser.close()
        await browserServer.close()
      }
    }
  }
} finally {
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  )
}
