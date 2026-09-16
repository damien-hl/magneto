<script lang="ts" setup>
import { computed, ref, useTemplateRef } from 'vue'

import type { Level } from './features/logs/types'

import LogList from './features/logs/components/LogList.vue'
import { useLogExplorer } from './features/logs/composables/useLogExplorer'
import { LEVELS } from './features/logs/constants'

const baseUrl = import.meta.env.BASE_URL

const picker = useTemplateRef('picker')

const text = ref(''),
  levels = ref<Level[]>([]),
  dragging = ref(false)

const {
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
} = useLogExplorer()

const busy = computed(() => status.value === 'index' || status.value === 'search')

const bytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} Gio` : `${(n / 1024 ** 2).toFixed(2)} Mio`

function choose(next?: File) {
  if (next) {
    text.value = ''
    levels.value = []
    open(next)
  }
}

function input(event: Event) {
  const el = event.target as HTMLInputElement
  choose(el.files?.[0])
  el.value = ''
}

function drop(event: DragEvent) {
  dragging.value = false
  choose(event.dataTransfer?.files[0])
}

function run() {
  search({ text: text.value, levels: [...levels.value] })
}
</script>

<template>
  <main
    class="app"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="drop"
  >
    <header class="app-header">
      <a :href="baseUrl" aria-label="Magneto — Log Explorer" class="brand">
        <span class="brand__logo">
          <img width="28" height="28" src="@/assets/images/logo-512x512.png" alt="" />
        </span>

        <span class="brand__name">Magneto</span>
        <span class="brand__product">Log Explorer</span>
      </a>
      <span class="privacy"><i></i> Vos fichiers restent dans ce navigateur</span>
    </header>

    <section class="intro">
      <div class="eyebrow">EXPLORER, SANS TRANSFÉRER</div>
      <h1>Volumétrie de logs importante.<br /><span>Traçabilité maximale.</span></h1>
      <p>Indexation progressive, recherche locale et lecture à la demande.</p>
    </section>

    <input
      ref="picker"
      type="file"
      accept=".log,.txt,.jsonl,text/plain"
      class="file-input"
      tabindex="-1"
      aria-label="Choisir un fichier de logs"
      @change="input"
    />

    <button class="dropzone" :class="{ dragging }" @click="picker?.click()">
      <span class="dropzone__icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256">
          <path
            fill="currentColor"
            d="M240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h48a8 8 0 0 1 0 16H32v64h192v-64h-48a8 8 0 0 1 0-16h48a16 16 0 0 1 16 16ZM85.7 77.7L120 43.3V128a8 8 0 0 0 16 0V43.3l34.3 34.4a8.2 8.2 0 0 0 11.4 0a8.1 8.1 0 0 0 0-11.4l-48-48a8.1 8.1 0 0 0-11.4 0l-48 48a8.1 8.1 0 0 0 11.4 11.4ZM200 168a12 12 0 1 0-12 12a12 12 0 0 0 12-12Z"
          />
        </svg>
      </span>

      <span>
        <strong>{{ file?.name ?? 'Ouvrir un fichier de logs' }}</strong>
        <small>
          {{
            file
              ? `${bytes(file.size)} · cliquer ou déposer un autre fichier`
              : 'Glissez un fichier ici ou cliquez pour le sélectionner · UTF-8'
          }}
        </small>
      </span>

      <span class="dropzone__tag">100 % LOCAL</span>
    </button>

    <div v-if="file" class="workspace">
      <div class="stats">
        <div>
          <small>LIGNES INDEXÉES</small><strong>{{ lines.toLocaleString('fr') }}</strong>
        </div>
        <div>
          <small>RÉSULTATS{{ status === 'search' || partial ? ' PARTIELS' : '' }}</small>
          <strong>{{ count.toLocaleString('fr') }}</strong>
        </div>
        <div>
          <small>INDEX + RÉSULTATS</small><strong>{{ bytes(memory) }}</strong>
        </div>
        <div class="status-pill">
          {{
            busy
              ? status === 'index'
                ? 'Indexation…'
                : 'Recherche…'
              : status === 'ready'
                ? 'Prêt à explorer'
                : status === 'cancelled'
                  ? 'Indexation annulée'
                  : 'Erreur'
          }}
        </div>
      </div>

      <div v-if="busy" role="status" class="progress-area">
        <div>
          <span>
            {{
              cancelling
                ? 'Annulation en cours…'
                : `${status === 'index' ? 'Indexation' : 'Recherche'} · ${percent} %`
            }}
          </span>
          <button :disabled="cancelling" @click="cancel">Annuler</button>
        </div>
        <progress :value="percent" max="100"></progress>
      </div>

      <div>
        <p v-if="error" role="alert" class="notice notice--error">{{ error }}</p>

        <p v-if="partial" class="notice">
          Recherche annulée : {{ count.toLocaleString('fr') }} résultats partiels conservés.
          Relancez la recherche pour un résultat complet.
        </p>
      </div>

      <div v-if="status === 'cancelled' || status === 'error'" class="reset">
        <button @click="choose(file)">Réindexer le fichier</button>
      </div>

      <form class="search-form" @submit.prevent="run">
        <label class="search-form__label">
          Recherche
          <input
            v-model="text"
            type="search"
            id="search-input"
            maxlength="1024"
            placeholder="Ex. timeout payment → les deux termes sur la même ligne"
            :disabled="status !== 'ready'"
          />
        </label>

        <button :disabled="status !== 'ready'" class="search-form__submit">Rechercher</button>

        <fieldset :disabled="status !== 'ready'" class="level-filters">
          <legend>Niveaux</legend>
          <label v-for="level in LEVELS" :key="level">
            <input v-model="levels" type="checkbox" :value="level" />
            {{ level }}
          </label>
          <span>Aucun coché = tous, y compris les niveaux inconnus</span>
        </fieldset>

        <p class="search-form__hint">
          Termes séparés par des espaces · tous requis · casse ignorée · niveaux combinés par OU.
          Validez pour appliquer.
        </p>
      </form>

      <LogList
        v-if="status === 'ready' || status === 'search'"
        :count="count"
        :rows="rows"
        :query-id="queryId"
        @range="readRows"
        @select="showContext"
      />

      <section v-if="selected !== undefined" aria-label="Contexte de la ligne" class="context">
        <div class="context__heading">
          <h2>Autour de la ligne {{ (selected + 1).toLocaleString('fr') }}</h2>
          <button @click="closeContext">Fermer</button>
        </div>

        <p>5 lignes avant et après, sans filtres · aperçu limité à 8 Kio par ligne</p>

        <div v-if="!context.length" class="context__reading">Lecture…</div>

        <div
          v-for="row in context"
          :key="row.line"
          class="context-row"
          :class="{ 'context-row--selected': row.line === selected }"
        >
          <span>{{ row.line + 1 }}</span>
          <pre>{{ row.text }}{{ row.truncated ? ' […] aperçu tronqué' : '' }}</pre>
        </div>
      </section>
    </div>

    <footer class="app-footer">
      <span>UTF-8 · LF / CRLF · aucun backend</span>
      <span>POC / index en mémoire, contenu sur disque</span>
    </footer>
  </main>
</template>

<style scoped>
/* Page layout and header */
.app {
  --page-width-max: 90rem;
  --page-padding-inline: 2.5rem;
  --panel-padding: 1.5rem;
  --log-grid-columns: 5.9375rem 5.3125rem minmax(0, 1fr);

  margin: auto;
  padding: 0 var(--page-padding-inline);
  max-width: var(--page-width-max);
}

.app-header {
  height: 5.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: 1px solid #d7dfd8;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;

  border-radius: 0.5rem;
  color: inherit;

  font-size: 1.5rem;
  white-space: nowrap;
  text-decoration: none;
}

.brand__logo {
  padding: 0.3rem;
  width: 2.25rem;
  height: 2.25rem;
  display: grid;
  place-items: center;
}

.brand__logo img {
  width: 100%;
  height: 100%;
}

.brand__name {
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand__product {
  color: var(--page-text-muted);

  font-size: var(--typography-size-md);
  font-weight: 500;
}

.brand__product::before {
  margin-right: 0.625rem;

  content: '/';
}

.privacy {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  font-size: var(--typography-size-body);

  color: #48665d;
}

.privacy i {
  width: 0.4375rem;
  height: 0.4375rem;

  background: #368468;
  border-radius: 50%;
}

/* Introduction */
.intro {
  padding: 2.75rem 0 1.875rem;
}

.intro p {
  color: var(--page-text-muted);

  font-size: var(--typography-size-md);
}

.eyebrow {
  color: #467a68;

  font-size: var(--typography-size-sm);
  letter-spacing: 0.125rem;
  font-weight: 700;
}

h1 {
  margin: 1rem 0;

  font-size: clamp(2.125rem, 4vw, 3.25rem);
  line-height: 1.12;
  letter-spacing: -0.125rem;
}

h1 span {
  color: #6b8178;
}

/* File picker */
.file-input {
  width: 1px;
  height: 1px;

  position: absolute;

  opacity: 0;

  pointer-events: none;
}

/* Dropzone */
.dropzone {
  padding: 1.5rem;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1.25rem;

  border: 1px dashed #95b5a5;
  background: var(--input-background);

  text-align: left;
}

.dropzone.dragging {
  background: #d9eee1;
  border-color: #246e56;
}

.dropzone strong {
  display: block;

  font-size: 0.938rem;
  overflow-wrap: anywhere;
}

.dropzone small {
  margin-top: 0.375rem;
  display: block;

  color: #718077;

  font-size: var(--typography-size-body);
}

.dropzone__icon {
  padding-top: 0.313rem;
  width: 3rem;
  height: 3rem;
  display: inline-flex;
  justify-content: center;

  border-radius: 0.625rem;
  background: #e5eee7;
}

.dropzone__icon svg {
  width: 1.75rem;
  height: 1.75rem;
}

.dropzone__tag {
  margin-left: auto;

  color: #48715e;

  font-size: var(--typography-size-xs);
  letter-spacing: 0.0625rem;
  white-space: nowrap;
}

/* Workspace */
.workspace {
  margin-top: 1.5rem;

  border: 1px solid var(--panel-border);
  border-radius: 0.625rem;
  background: var(--surface-background);

  overflow: hidden;
}

.stats {
  padding: var(--panel-padding);
  display: flex;
  align-items: center;
  gap: 3.5rem;

  border-bottom: 1px solid var(--divider-border);
}

.stats small {
  display: block;

  font-size: var(--typography-size-xs);
  letter-spacing: 0.0625rem;
}

.stats strong {
  margin-top: 0.375rem;
  display: block;

  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
}

.status-pill {
  padding: 0.5rem 0.75rem;
  margin-left: auto;

  border-radius: 1.25rem;
  background: #eef5ee;

  font-size: var(--typography-size-body);
  white-space: nowrap;
}

.progress-area {
  padding: 1rem var(--panel-padding);

  background: #f7faf6;
}

.progress-area > div {
  display: flex;
  justify-content: space-between;
  align-items: center;

  font-size: var(--typography-size-notice);
}

.progress-area button {
  font-size: var(--typography-size-body);
}

progress {
  width: 100%;
  height: 0.4375rem;
  accent-color: #33755c;
}

.notice {
  padding: 0.875rem var(--panel-padding);

  background: #fff5d9;

  font-size: var(--typography-size-notice);
}

.notice--error {
  background: #ffefed;
  color: #963c3c;
}

.reset {
  padding: 0 var(--panel-padding);

  font-size: var(--typography-size-body);
}

/* Search and level filters */
.search-form {
  padding: var(--panel-padding);
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.search-form__label {
  flex: 1;

  font-size: 0.875rem;
  font-weight: 600;
}

.search-form__label input {
  margin-top: 0.5rem;
  padding: 0.75rem;
  width: 100%;
  height: 2.75rem;
  display: block;

  border: 1px solid var(--input-border);
  border-radius: 0.5rem;
  background: var(--input-background);
  color: #233e32;
}

.search-form__submit {
  padding: 0.75rem 1.375rem;
  margin-top: 1.5rem;
  height: 2.75rem;
  align-self: flex-start;

  border-color: var(--button-background-primary);
  background: var(--button-background-primary);
  color: var(--surface-background);

  font-size: var(--typography-size-notice);
}

.search-form__submit:hover:enabled {
  background: var(--button-background-primary-hover);
  color: var(--surface-background);
}

.level-filters {
  border: 0;
  padding: 0;
  margin: 0.375rem 0 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 1.125rem;

  font-size: var(--typography-size-body);
}

.level-filters legend {
  margin-right: 1.25rem;
  float: left;

  color: #6e8074;
}

.level-filters label {
  display: flex;
  align-items: center;
  gap: 0.313rem;
}

.level-filters span {
  color: #748479;

  font-size: var(--typography-size-sm);
}

input[type='checkbox'] {
  accent-color: #236348;
}

.search-form__hint {
  margin: 0;
  width: 100%;

  color: #718277;

  font-size: var(--typography-size-sm);
}

/* Line context */
.context {
  padding: 1.25rem var(--panel-padding);

  border-top: 1px solid var(--panel-border);
  background: #f9fbf7;
}

.context__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.context h2 {
  margin: 0;

  font-size: 1rem;
}

.context button {
  font-size: var(--typography-size-body);
}

.context p {
  color: #748276;

  font-size: var(--typography-size-body);
}

.context__reading {
  font-size: var(--typography-size-notice);
}

.context-row {
  padding: 0.313rem 0.625rem;
  display: flex;
  gap: 1.25rem;

  border-left: 3px solid transparent;

  font-size: var(--typography-size-body);
}

.context-row > span {
  padding-top: 0.1875rem;
  min-width: 3.75rem;

  color: #8a968a;
}

.context-row--selected {
  border-color: #46815c;
  background: #e7f1e3;
}

.context pre {
  margin: 0;
  min-width: 0;

  white-space: pre-wrap;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* Footer */
.app-footer {
  padding: var(--panel-padding) 0 1.875rem;
  display: flex;
  justify-content: space-between;

  color: #869087;

  font-size: var(--typography-size-sm);
}

/* Mobile overrides */
@media (max-width: 47.5rem) {
  .app {
    --page-padding-inline: 1rem;
    --log-grid-columns: 3.875rem 3.4375rem minmax(0, 1fr);
  }

  .privacy,
  .dropzone__tag {
    display: none;
  }

  .intro {
    padding-top: 1.75rem;
  }

  .stats {
    gap: 1.375rem;
    flex-wrap: wrap;
  }

  .stats strong {
    font-size: 1.188rem;
  }

  .status-pill {
    margin-left: 0;
  }

  .search-form__submit {
    padding: 0.75rem;
  }

  .level-filters {
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .level-filters span {
    width: 100%;
  }

  .app-footer {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}
</style>
