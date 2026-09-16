<script lang="ts" setup>
import { useVirtualizer } from '@tanstack/vue-virtual'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { Row } from '../types'

const PAGE = 20_000

const props = defineProps<{
  count: number
  rows: Row[]
  queryId: number
}>()

const emit = defineEmits<{
  range: [start: number, count: number]
  select: [line: number]
}>()

const scroller = useTemplateRef('scroller')

const rowHeight = ref(36)
watch(scroller, (element) => {
  if (element) {
    rowHeight.value = Number.parseFloat(getComputedStyle(element).fontSize) * 2.25
  }
})

const page = ref(0),
  destination = ref(1)

const pages = computed(() => Math.max(1, Math.ceil(props.count / PAGE)))
const pageSize = computed(() => Math.min(PAGE, Math.max(0, props.count - page.value * PAGE)))

const virtualizer = useVirtualizer(
  computed(() => ({
    count: pageSize.value,
    getScrollElement: () => scroller.value ?? null,
    estimateSize: () => rowHeight.value,
    overscan: 8,
  })),
)

watch(rowHeight, () => virtualizer.value.measure(), { flush: 'post' })

const items = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())
const byPosition = computed(() => new Map(props.rows.map((row) => [row.position, row])))

const range = computed(() => {
  const list = items.value
  return list.length ? [page.value * PAGE + list[0]!.index, list.length] : [0, 0]
})

watch(
  () => [range.value[0], range.value[1], props.queryId, props.count],
  () => {
    if (range.value[1]) {
      emit('range', range.value[0]!, range.value[1])
    }
  },
  { immediate: true, flush: 'post' },
)

watch(
  () => props.queryId,
  () => {
    destination.value = 1
    page.value = 0
    virtualizer.value.scrollToOffset(0)
  },
)

watch(pages, (n) => {
  if (page.value >= n) {
    page.value = n - 1
  }
})

const rowFor = (index: number) => byPosition.value.get(page.value * PAGE + index)

function move(next: number) {
  page.value = next
  virtualizer.value.scrollToOffset(0)
}

function jump() {
  const target = Math.min(props.count, Math.max(1, Math.floor(Number(destination.value) || 1))) - 1

  move(Math.max(0, Math.floor(target / PAGE)))

  requestAnimationFrame(() => {
    virtualizer.value.scrollToIndex(Math.max(0, target % PAGE), { align: 'start' })
  })
}
</script>

<template>
  <div class="list-toolbar">
    <span>Page {{ (page + 1).toLocaleString('fr') }} / {{ pages.toLocaleString('fr') }}</span>

    <button :disabled="page === 0" aria-label="Page précédente" @click="move(page - 1)">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256">
        <path
          fill="currentColor"
          d="M224 128a8 8 0 0 1-8 8H59.3l58.4 58.3a8.1 8.1 0 0 1 0 11.4a8.2 8.2 0 0 1-11.4 0l-72-72a8.1 8.1 0 0 1 0-11.4l72-72a8.1 8.1 0 0 1 11.4 11.4L59.3 120H216a8 8 0 0 1 8 8Z"
        />
      </svg>
    </button>

    <button :disabled="page + 1 >= pages" aria-label="Page suivante" @click="move(page + 1)">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256">
        <path
          fill="currentColor"
          d="m221.7 133.7l-72 72a8.2 8.2 0 0 1-11.4 0a8.1 8.1 0 0 1 0-11.4l58.4-58.3H40a8 8 0 0 1 0-16h156.7l-58.4-58.3a8.1 8.1 0 0 1 11.4-11.4l72 72a8.1 8.1 0 0 1 0 11.4Z"
        />
      </svg>
    </button>

    <form @submit.prevent="jump">
      <label>
        Résultat
        <input v-model="destination" type="number" id="line-input" min="1" :max="count || 1" />
      </label>
      <button :disabled="!count">Aller</button>
    </form>
  </div>

  <div class="columns">
    <span>Ligne</span><span>Niveau</span><span>Message · cliquer pour voir le contexte</span>
  </div>

  <div
    ref="scroller"
    aria-label="Résultats des logs"
    tabindex="0"
    class="log-scroll"
    :style="{ '--log-row-height': `${rowHeight}px` }"
  >
    <div v-if="!count" class="no-results">Aucune ligne à afficher.</div>

    <div :style="{ width: '100%', height: `${totalSize}px`, position: 'relative' }">
      <button
        v-for="item in items"
        :key="String(item.key)"
        :style="{ transform: `translateY(${item.start}px)` }"
        class="log-row"
        :disabled="!rowFor(item.index)"
        @click="emit('select', rowFor(item.index)!.line)"
      >
        <span class="line-number">
          {{ rowFor(item.index) ? (rowFor(item.index)!.line + 1).toLocaleString('fr') : '…' }}
        </span>
        <span
          class="level"
          :class="
            rowFor(item.index)?.level
              ? `level--${rowFor(item.index)!.level!.toLowerCase()}`
              : undefined
          "
        >
          {{ rowFor(item.index)?.level ?? '—' }}
        </span>
        <span class="log-text">
          {{ rowFor(item.index)?.text ?? 'Lecture locale…'
          }}<em v-if="rowFor(item.index)?.truncated"> […]</em>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Result navigation */
.list-toolbar {
  padding: 0.75rem var(--panel-padding);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  border-top: 1px solid var(--divider-border);
  background: #fbfcfa;

  font-size: var(--typography-size-body);
}

.list-toolbar svg {
  width: 0.875rem;
  height: 0.875rem;
}

.list-toolbar > span {
  margin-right: 0.5rem;
}

.list-toolbar form {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.list-toolbar input {
  margin-left: 0.375rem;
  padding: 0.5rem;
  width: 6.25rem;

  border: 1px solid var(--input-border);
  border-radius: 0.313rem;
}

/* Virtualized log list */
.columns,
.log-row {
  padding: 0 var(--panel-padding);
  display: grid;
  grid-template-columns: var(--log-grid-columns);
  align-items: center;
  gap: 0.75rem;
}

.columns {
  height: 2.125rem;

  background: #eef2ed;
  color: #758477;

  font-size: var(--typography-size-xs);
  letter-spacing: 0.05rem;
  text-transform: uppercase;
}

.log-scroll {
  height: 30rem;

  font-size: 1rem;
  overflow: auto;
  contain: strict;

  background: var(--surface-background);
}

.log-row {
  width: 100%;
  height: var(--log-row-height);

  position: absolute;
  top: 0;
  left: 0;
  border: 0;

  border-bottom: 1px solid #f0f3ed;
  border-radius: 0;

  font-family: var(--typography-family-mono);
  font-size: var(--typography-size-body);
  text-align: left;
}

.log-row:disabled {
  opacity: 1;
  color: #8f9c92;
}

.line-number {
  color: #89978d;

  font-size: var(--typography-size-sm);
}

.level {
  color: #8d988f;

  font-size: var(--typography-size-xs);
  font-weight: 700;
}

.level--error {
  color: var(--level-text-error);
}

.level--warn {
  color: var(--level-text-warn);
}

.level--info {
  color: var(--level-text-info);
}

.level--debug {
  color: var(--level-text-debug);
}

.log-text {
  overflow: hidden;

  white-space: pre;
  text-overflow: ellipsis;
}

.log-text em {
  color: #a3772c;
}

.no-results {
  padding: 4.375rem;

  color: #829083;

  font-size: var(--typography-size-md);
  text-align: center;
}

/* Mobile overrides */
@media (max-width: 47.5rem) {
  .list-toolbar {
    flex-wrap: wrap;
  }

  .list-toolbar form {
    margin-left: 0;
  }

  .columns,
  .log-row {
    padding: 0 0.75rem;
    gap: 0.5rem;
  }

  .log-scroll {
    height: 26.25rem;
  }
}
</style>
