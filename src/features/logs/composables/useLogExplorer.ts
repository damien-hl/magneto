import { onBeforeUnmount, ref, shallowRef } from 'vue'

import type { Query, Request, Response, Row } from '../types'

export function useLogExplorer() {
  let worker: Worker | undefined,
    sequence = 0,
    operation = 0,
    latestRows = 0,
    latestContext = 0

  const file = shallowRef<File>(),
    status = ref<'empty' | 'index' | 'ready' | 'search' | 'cancelled' | 'error'>('empty')

  const lines = ref(0),
    count = ref(0),
    percent = ref(0),
    memory = ref(0),
    queryId = ref(0)

  const error = ref(''),
    partial = ref(false),
    cancelling = ref(false)

  const rows = shallowRef<Row[]>([]),
    context = shallowRef<Row[]>([]),
    selected = ref<number>()

  const post = (message: Request) => worker?.postMessage(message)

  function open(next: File) {
    worker?.terminate()
    latestRows = latestContext = ++sequence

    file.value = next
    lines.value = count.value = memory.value = percent.value = 0
    rows.value = []
    context.value = []
    selected.value = undefined
    error.value = ''
    partial.value = false
    cancelling.value = false
    status.value = 'index'
    operation = ++sequence
    queryId.value = operation

    try {
      worker = new Worker(new URL('../worker/log.worker.ts', import.meta.url), { type: 'module' })
    } catch (cause) {
      worker = undefined
      error.value =
        cause instanceof Error ? cause.message : 'Impossible de démarrer la lecture locale.'
      status.value = 'error'
      return
    }

    const currentWorker = worker

    worker.onerror = (event) => {
      if (worker !== currentWorker) return
      error.value = event.message || 'Le worker a été interrompu.'
      status.value = 'error'
      cancelling.value = false
    }

    worker.onmessage = (event: MessageEvent<Response>) => {
      if (worker !== currentWorker) return
      const m = event.data

      if (m.type === 'rows') {
        if (m.id === latestRows && m.queryId === queryId.value) {
          rows.value = m.rows
          return
        }
      }

      if (m.type === 'context') {
        if (m.id === latestContext) context.value = m.rows
        return
      }

      if (m.type === 'error') {
        if (m.id !== operation && m.id !== latestContext && m.id !== latestRows) {
          return
        }

        error.value = m.message

        if (m.id === operation) {
          status.value = 'error'
          count.value = 0
          rows.value = []
          cancelling.value = false
        }
        return
      }

      if (m.id !== operation) return

      if (m.type === 'progress') {
        percent.value = m.total ? Math.round((m.bytes / m.total) * 100) : 100
        lines.value = m.lines
        memory.value = m.memory

        if (m.phase === 'search') {
          count.value = m.matches
        }
      } else if (m.type === 'indexed') {
        lines.value = count.value = m.lines
        memory.value = m.memory
        percent.value = 100
        status.value = 'ready'
      } else if (m.type === 'searched') {
        count.value = m.count
        memory.value = m.memory
        partial.value = m.partial
        status.value = 'ready'
        cancelling.value = false

        if (!m.partial) {
          percent.value = 100
        }
      } else if (m.type === 'cancelled') {
        status.value = 'cancelled'
        lines.value = count.value = memory.value = 0
        cancelling.value = false
      }
    }

    post({ type: 'open', id: operation, file: next })
  }

  function search(query: Query) {
    if (status.value !== 'ready') {
      return
    }

    closeContext()
    status.value = 'search'
    error.value = ''
    partial.value = false
    count.value = 0
    percent.value = 0
    rows.value = []
    operation = ++sequence
    queryId.value = operation

    post({ type: 'search', id: operation, query })
  }

  function cancel() {
    if (status.value !== 'index' && status.value !== 'search') return
    cancelling.value = true

    post({ type: 'cancel', id: operation })
  }

  function readRows(start: number, size: number) {
    latestRows = ++sequence

    post({ type: 'rows', id: latestRows, queryId: queryId.value, start, count: size })
  }

  function showContext(line: number) {
    selected.value = line
    context.value = []
    latestContext = ++sequence

    post({ type: 'context', id: latestContext, line, radius: 5 })
  }

  function closeContext() {
    selected.value = undefined
    context.value = []
    latestContext = ++sequence
  }

  onBeforeUnmount(() => worker?.terminate())

  return {
    file,
    status,
    lines,
    count,
    percent,
    memory,
    queryId,
    error,
    partial,
    cancelling,
    rows,
    context,
    selected,
    open,
    search,
    cancel,
    readRows,
    showContext,
    closeContext,
  }
}
