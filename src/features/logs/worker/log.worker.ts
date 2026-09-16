/// <reference lib="webworker" />

import type { Phase, Request, Response } from '../types'

import { Engine } from './engine'
import { Cancelled } from './scanner'

const scope = self as unknown as DedicatedWorkerGlobalScope

const send = (message: Response) => scope.postMessage(message)

let engine: Engine | undefined,
  ready = false,
  busy = false,
  queryId = 0

let active: { id: number; cancelled: boolean } | undefined

let rowsId = 0,
  contextId = 0

scope.onmessage = (event: MessageEvent<Request>) => {
  void handle(event.data)
}

async function handle(message: Request) {
  try {
    if (message.type === 'cancel') {
      if (active?.id === message.id) {
        active.cancelled = true
        return
      }
    }

    if (message.type === 'open' || message.type === 'search') {
      if (busy) {
        throw new Error('Une opération est déjà en cours.')
      }

      if (message.type === 'search' && !ready) {
        throw new Error('Indexation requise.')
      }

      busy = true

      const job = (active = { id: message.id, cancelled: false })
      const phase: Phase = message.type === 'open' ? 'index' : 'search'

      let last = 0

      if (message.type === 'open') {
        engine = new Engine(message.file)
        ready = false
      }

      const current = engine!

      queryId = message.id

      rowsId++
      contextId++

      const progress = (bytes: number) => {
        if (performance.now() - last < 100 && bytes !== current.file.size) {
          return
        }

        last = performance.now()

        send({
          type: 'progress',
          id: job.id,
          phase,
          bytes,
          total: current.file.size,
          lines: current.index.count,
          matches: phase === 'search' ? current.count : 0,
          memory: current.budget.used,
        })
      }

      try {
        if (message.type === 'open') {
          await current.build(() => job.cancelled, progress)

          ready = true

          send({
            type: 'indexed',
            id: job.id,
            lines: current.index.count,
            memory: current.budget.used,
          })
        } else {
          await current.search(message.query, () => job.cancelled, progress)

          send({
            type: 'searched',
            id: job.id,
            count: current.count,
            partial: job.cancelled,
            memory: current.budget.used,
          })
        }
      } catch (error) {
        if (error instanceof Cancelled) {
          if (phase === 'index') {
            current.index.clear()

            engine = undefined

            send({
              type: 'cancelled',
              id: job.id,
              phase,
            })
          } else {
            send({
              type: 'searched',
              id: job.id,
              count: current.count,
              partial: true,
              memory: current.budget.used,
            })
          }
        } else {
          if (phase === 'index') {
            current.index.clear()
            engine = undefined
          } else {
            current.results.clear()
            current.identity = false
          }

          throw error
        }
      } finally {
        busy = false
        active = undefined
      }

      return
    }

    if (!engine || !ready) {
      return
    }

    const current = engine

    if (message.type === 'rows') {
      if (message.queryId !== queryId) {
        return
      }

      rowsId = message.id

      const rows = []

      const start = Math.max(0, Math.floor(message.start)),
        count = Math.min(200, Math.max(0, Math.floor(message.count)))

      for (let i = start; i < Math.min(current.count, start + count); i++) {
        if (rowsId !== message.id || message.queryId !== queryId) {
          return
        }

        rows.push(await current.row(current.resultLine(i), i))
      }

      if (rowsId === message.id && message.queryId === queryId) {
        send({ type: 'rows', id: message.id, queryId, rows })
      }
    } else if (message.type === 'context') {
      contextId = message.id

      const rows = [],
        radius = Math.min(20, Math.max(0, Math.floor(message.radius)))

      for (
        let i = Math.max(0, message.line - radius);
        i <= Math.min(current.index.count - 1, message.line + radius);
        i++
      ) {
        if (contextId !== message.id) {
          return
        }

        rows.push(await current.row(i, i, 8192))
      }

      if (contextId === message.id) {
        send({ type: 'context', id: message.id, rows })
      }
    }
  } catch (error) {
    send({
      type: 'error',
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
