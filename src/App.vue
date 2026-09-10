<template>
  <main>
    <header>
      <a href="/" aria-label="Magneto — Log Explorer" class="brand">
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
      type="file"
      accept=".log,.txt,.jsonl,text/plain"
      class="hidden"
      aria-label="Choisir un fichier de logs"
    />

    <button class="dropzone">
      <span class="file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256">
          <path
            fill="currentColor"
            d="M240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h48a8 8 0 0 1 0 16H32v64h192v-64h-48a8 8 0 0 1 0-16h48a16 16 0 0 1 16 16ZM85.7 77.7L120 43.3V128a8 8 0 0 0 16 0V43.3l34.3 34.4a8.2 8.2 0 0 0 11.4 0a8.1 8.1 0 0 0 0-11.4l-48-48a8.1 8.1 0 0 0-11.4 0l-48 48a8.1 8.1 0 0 0 11.4 11.4ZM200 168a12 12 0 1 0-12 12a12 12 0 0 0 12-12Z"
          />
        </svg>
      </span>

      <span>
        <strong>Ouvrir un fichier de logs</strong>
        <small>Glissez un fichier ici ou cliquez pour le sélectionner · UTF-8</small>
      </span>

      <span class="tag">100 % LOCAL</span>
    </button>

    <footer>
      <span>UTF-8 · LF / CRLF · aucun backend</span>
      <span>POC / index en mémoire, contenu sur disque</span>
    </footer>
  </main>
</template>
