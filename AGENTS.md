# Indications pour travailler sur Magneto

## Maintenir ce document

- Compléter ce fichier au fil du travail lorsqu’une décision durable est prise sur la stack, les conventions ou les règles du projet.
- Consigner les décisions confirmées et les pratiques vérifiées dans le dépôt. Ne pas transformer une hypothèse ou une proposition en règle acquise.
- Corriger les indications devenues obsolètes plutôt qu’accumuler un historique de tâches. Garder le document concis et cohérent avec le README et la configuration.
- Les fichiers de configuration et `package.json` font référence pour les versions exactes et les commandes disponibles.

## Projet et contraintes

- Magneto est un explorateur de logs dont le traitement doit rester dans le navigateur, sans transfert des fichiers ni backend de traitement.
- L’interface est en français. Préserver la sémantique HTML, les libellés accessibles, la navigation au clavier et les styles de focus.
- L’indexation et la recherche s’exécutent dans un Web Worker, par blocs de 1 Mio ; les aperçus sont lus à la demande. Préserver ce traitement progressif et la limite de 256 Mio pour l’index et les résultats.
- L'index reste dans le worker : blocs de 65 536 entrées (offset Float64, longueur Uint32, niveau Uint8). Ne transmettre que les compteurs et aperçus demandés. Une indexation interrompue libère ses blocs ; ouvrir un fichier termine le worker précédent.
- La liste virtualisée affiche des pages de 20 000 résultats. Garder la hauteur utilisée par le virtualiseur cohérente avec celle des lignes, y compris avec une taille de texte personnalisée.
- Préserver les modifications existantes de l’utilisateur et limiter les changements au périmètre demandé.

## Stack et organisation

- Vue 3, TypeScript et Vite ; modules JavaScript au format ESM.
- Utiliser pnpm et conserver `pnpm-lock.yaml`. Le runtime Node est déclaré dans `package.json`.
- `src/main.ts` initialise l’application ; `src/App.vue` contient l’écran principal et ses styles `scoped`. `src/features/logs/` regroupe le worker, le composable et la liste virtualisée.
- `src/styles.css` contient les fondations globales : polices, variables de thème, valeurs par défaut, contrôles partagés, focus et reset.
- Les polices Inter et les images sont locales dans `src/assets/`. L’alias `@/` pointe vers `src/`.
- Tests unitaires avec Vitest, Vue Test Utils et jsdom, dans `src/**/*.spec.ts` ou `src/**/*.test.ts` ; tests de navigation avec Playwright et Chromium dans `e2e/`.
- GitHub Actions vérifie la qualité et les tests. GitHub Pages publie le site statique ; respecter `VITE_BASE_URL` pour les chemins déployés sous un sous-répertoire.

## Conventions de code

- Suivre Oxfmt et `.oxfmtrc.json` : indentation de deux espaces, guillemets simples, pas de points-virgules en JavaScript/TypeScript, virgules finales et largeur cible de 100 caractères. Laisser le formateur organiser les imports.
- Respecter Oxlint et le typage Vue/TypeScript : éviter `any`, ne pas laisser de promesses non gérées ni de `debugger` ou de traces `console` dans le code livré. Les avertissements de lint sont bloquants.
- Déclarer les props et événements Vue avec des types, conformément aux règles `defineProps` et `defineEmits` configurées.
- Tenir compte de `noUncheckedIndexedAccess` : un accès à un tableau ou à un dictionnaire peut retourner `undefined`.

## Conventions CSS

- Nommer toutes les variables en anglais, en kebab-case, selon `--element-propriete[-etat-ou-variante]` : `--page-background`, `--button-border-hover`, `--typography-family-mono`. L’état ou la variante facultative se place à la fin.
- Privilégier les `rem` pour les tailles de texte, espacements, dimensions et points de rupture. Ne pas fixer la taille racine afin de respecter les préférences du navigateur ; la conversion de référence est de 16 px pour 1 rem.
- Conserver les `px` pour les bordures, les contours de focus et la taille technique du champ de fichier invisible.
- Conserver les unités adaptées à leur fonction : `%` et `fr` pour les proportions et grilles, `vw` pour la typographie fluide, `em` pour les espacements liés à la police, `ms` pour les durées et valeurs sans unité pour les hauteurs de ligne.
- Les attributs intrinsèques des images et les coordonnées SVG restent sans unité ; définir la taille affichée en CSS.
- Conserver la séparation entre fondations globales et styles des composants. Suivre les classes existantes de type BEM pour les éléments et variantes, par exemple `.dropzone__icon` et `.notice--error`.

## Vérifications

- `pnpm dev` lance le serveur de développement.
- `pnpm check` vérifie le formatage, le lint, le typage et les tests unitaires.
- `pnpm build` vérifie le typage et construit la version de production.
- `pnpm test:e2e` lance les tests Playwright ; Chromium doit être installé.
- `pnpm benchmark` mesure la version de production sur 100 Mo, 500 Mo et 1 Go ; protocole dans `benchmarks/README.md`, fichiers et rapports locaux exclus de Git.
- Adapter les vérifications au changement : formatage pour la documentation seule, contrôles de qualité et compilation pour le code, tests de navigation pour les parcours concernés. Ajouter des tests de comportement utiles lors des changements fonctionnels.
- Ne pas modifier manuellement les fichiers générés dans `dist/`, les rapports de tests ou `node_modules/`.
