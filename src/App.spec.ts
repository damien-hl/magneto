import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import type { Request, Response } from './features/logs/types'

import App from './App.vue'

class LocalWorker {
  static instances: LocalWorker[] = []

  onmessage?: (event: MessageEvent<Response>) => void
  onerror?: (event: ErrorEvent) => void
  onmessageerror?: () => void
  postMessage = vi.fn<(message: Request) => void>()
  terminate = vi.fn<() => void>()

  constructor() {
    LocalWorker.instances.push(this)
  }

  send(message: Response) {
    this.onmessage?.({ data: message } as MessageEvent<Response>)
  }

  get openId() {
    return this.postMessage.mock.calls[0]![0].id
  }
}

const wrappers: ReturnType<typeof mount>[] = []

function render() {
  const wrapper = mount(App, { global: { stubs: { LogList: true } } })

  wrappers.push(wrapper)

  return wrapper
}

async function choose(wrapper: ReturnType<typeof render>) {
  const input = wrapper.get('input[type="file"]')

  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File(['INFO test'], 'test.log')],
  })

  await input.trigger('change')

  return LocalWorker.instances.at(-1)!
}

async function ready(worker: LocalWorker, wrapper: ReturnType<typeof render>) {
  worker.send({ type: 'indexed', id: worker.openId, lines: 3, memory: 100 })
  await wrapper.vm.$nextTick()
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn<() => void>()
  LocalWorker.instances = []
  vi.stubGlobal('Worker', LocalWorker)
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('explorateur', () => {
  it('attend un fichier avant de créer le worker', () => {
    const wrapper = render()

    expect(wrapper.text()).toContain('Magneto')
    expect(wrapper.find('.workspace').exists()).toBe(false)
    expect(LocalWorker.instances).toHaveLength(0)
  })

  it('transmet les filtres sélectionnés et ferme le contexte', async () => {
    const wrapper = render()
    const worker = await choose(wrapper)
    await ready(worker, wrapper)

    await wrapper.get('input[value="ERROR"]').setValue(true)
    await wrapper.get('input[type="search"]').setValue('timeout')
    await wrapper.get('form').trigger('submit')

    expect(worker.postMessage).toHaveBeenLastCalledWith({
      type: 'search',
      id: expect.any(Number),
      query: { text: 'timeout', levels: ['ERROR'] },
    })

    const search = worker.postMessage.mock.calls.at(-1)![0]

    worker.send({ type: 'searched', id: search.id, count: 1, memory: 100, partial: false })
    await wrapper.vm.$nextTick()

    wrapper.getComponent({ name: 'LogList' }).vm.$emit('select', 1)
    await wrapper.vm.$nextTick()

    const context = worker.postMessage.mock.calls.at(-1)![0]

    expect(wrapper.find('.context').exists()).toBe(true)

    await wrapper.get('.context button').trigger('click')

    worker.send({ type: 'context', id: context.id, rows: [] })

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.context').exists()).toBe(false)
  })

  it('ignore les événements d’un fichier remplacé et termine le worker au démontage', async () => {
    const wrapper = render()
    const oldWorker = await choose(wrapper)

    await ready(oldWorker, wrapper)

    const worker = await choose(wrapper)

    expect(oldWorker.terminate).toHaveBeenCalledOnce()

    oldWorker.onerror?.({ message: 'Erreur obsolète' } as ErrorEvent)

    await ready(worker, wrapper)

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    wrapper.unmount()

    expect(worker.terminate).toHaveBeenCalledOnce()

    wrappers.splice(wrappers.indexOf(wrapper), 1)
  })

  it('permet de relancer une indexation annulée', async () => {
    const wrapper = render()
    const worker = await choose(wrapper)

    await wrapper.get('.progress-area button').trigger('click')

    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'cancel', id: worker.openId })
    expect(wrapper.get('.progress-area button').attributes('disabled')).toBeDefined()

    worker.send({ type: 'cancelled', id: worker.openId, phase: 'index' })

    await wrapper.vm.$nextTick()
    await wrapper.get('.reset button').trigger('click')

    expect(LocalWorker.instances).toHaveLength(2)
    expect(wrapper.text()).toContain('Indexation…')
  })

  it('libère le worker et les compteurs après une erreur de communication', async () => {
    const wrapper = render()
    const worker = await choose(wrapper)

    worker.send({
      type: 'progress',
      id: worker.openId,
      phase: 'index',
      bytes: 5,
      total: 10,
      lines: 2,
      matches: 0,
      memory: 851968,
    })

    worker.onmessageerror?.()
    await wrapper.vm.$nextTick()

    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(wrapper.get('[role="alert"]').text()).toContain('réponse du worker')

    worker.send({ type: 'indexed', id: worker.openId, lines: 3, memory: 100 })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Prêt à explorer')

    await wrapper.get('.reset button').trigger('click')
    await ready(LocalWorker.instances.at(-1)!, wrapper)

    expect(wrapper.text()).toContain('Prêt à explorer')
  })

  it('libère le worker si la transmission du fichier échoue', async () => {
    // Simulate a synchronous structured-clone failure at the worker boundary.
    vi.stubGlobal(
      'Worker',
      class extends LocalWorker {
        override postMessage = vi.fn<(message: Request) => void>(() => {
          throw new Error('Copie impossible')
        })
      },
    )

    const wrapper = render()
    await choose(wrapper)

    expect(LocalWorker.instances.at(-1)!.terminate).toHaveBeenCalledOnce()
    expect(wrapper.get('[role="alert"]').text()).toBe('Copie impossible')
  })

  it('affiche une erreur si le worker ne peut pas démarrer', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('Worker indisponible')
        }
      },
    )

    const wrapper = render()
    await choose(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toBe('Worker indisponible')
  })
})
