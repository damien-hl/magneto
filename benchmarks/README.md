# Benchmark du moteur

## Exécution

Prérequis : dépendances du projet, Chromium Playwright installé et commande `ps`
(macOS ou Linux). Prévoir environ 1,6 Go de disque pour les fichiers par défaut.

```sh
pnpm exec playwright install chromium
pnpm benchmark
```

La commande compile la version de production, démarre une prévisualisation locale sur
le port 4173 et effectue trois essais par taille : 100 Mo, 500 Mo et 1 Go, en unités
décimales (1 Mo = 1 000 000 octets). Chromium est redémarré pour chaque essai.
Les fichiers et le rapport JSON sont dans `benchmarks/local/`, ignoré par Git.

Pour un essai rapide ou un fichier dépassant 1 Go :

```sh
BENCH_SIZES=100 BENCH_REPEATS=1 pnpm benchmark
BENCH_SIZES=1200 BENCH_REPEATS=3 pnpm benchmark
```

Le générateur écrit sur disque par blocs de 1 Mio, sans construire une chaîne de
plusieurs centaines de Mo. Chaque ligne fait exactement 256 octets, avec un
horodatage, INFO, des caractères UTF-8 multioctets et une fin CRLF. Le contenu est
déterministe ; le nombre de lignes attendu est vérifié à chaque essai. Les fichiers
sont sélectionnés par leur chemin dans le véritable écran Magneto. Aucun contenu
de log n'est transmis à un serveur.

## Mesures et interprétation

- `elapsedMs` : du message d'ouverture au message de fin d'indexation, sur l'horloge
  du thread principal. Inclut le démarrage du worker, les lectures et les échanges.
  Exclut la génération et la sélection du fichier.
- `linesPerSecond` : nombre de lignes indexées divisé par cette durée.
- `indexBytes` : taille exacte des blocs alloués par le moteur, réserves inutilisées
  comprises. L'index utilise 13 octets par ligne (offset Float64, longueur Uint32,
  niveau Uint8), alloués par blocs de 65 536 lignes. L'identité des résultats ne
  nécessite pas de second tableau. Le budget commun reste de 256 Mio.
- `browserRssBaselineBytes`, `browserRssPeakBytes`, `browserRssDeltaBytes` :
  somme des RSS du processus Chromium et de ses descendants, échantillonnée environ
  toutes les 100 ms, de la sélection du fichier à la réception du résultat.
  Inclut notamment worker, rendu, buffers et allocations natives ; exclut le
  générateur Node. Les pages partagées peuvent être comptées plusieurs fois et les
  pics entre deux mesures peuvent être manqués. Ce n'est ni le tas JavaScript seul,
  ni une mesure précise de la mémoire propre au moteur.
- `idleFrameGapP95Ms` : référence au repos, sur environ 500 ms avant la sélection.
  `frameGapP95Ms` et `frameGapMaxMs` : intervalles entre callbacks
  `requestAnimationFrame` pendant l'indexation, avec le dernier intervalle partiel.
  `frames` compte les callbacks. Une hausse par rapport au repos signale une
  dégradation de la fluidité.
- `longTasks` et `longTaskTotalMs` : nombre et durée cumulée des tâches de plus
  de 50 ms sur le thread principal pendant l'indexation (PerformanceObserver).
  Ces indicateurs de réactivité ne remplacent pas une mesure de latence d'entrée
  sur un appareil physique.

Comparer les médianes de plusieurs essais sur la même machine, au repos et sans
autres tests simultanés. La génération vient de remplir le cache disque :
ces essais mesurent des lectures avec cache potentiellement chaud, pas un disque
froid. Le rapport contient matériel, système et versions Node/Chromium. Ne pas
interpréter les résultats comme des seuils universels ou comme une preuve de gain
par rapport à une version antérieure non mesurée.

Les lignes courtes augmentent le poids de l'index à taille de fichier égale.
Ce corpus fixe sert de référence reproductible ; les cas limites (lignes vides,
sans LF final, lignes de plusieurs Mio, coupures UTF-8 et annulation) sont couverts
séparément par les tests unitaires.

## Mesure de référence

Exécution du 16 septembre 2026 : Apple M1 Max, 32 Gio de RAM, macOS Darwin 25.6.0
arm64, Node 24.21.0 et Chromium 153.0.8010.12 sans fenêtre. Médianes de trois essais,
sur le corpus décrit ci-dessus. Résultats indicatifs d'une session de développement ;
la machine n'était pas dédiée au benchmark.

| Fichier | Indexation | Lignes/s | Index alloué | Pic RSS Chromium | Hausse RSS | Intervalle image p95 |
| ------- | ---------- | -------- | ------------ | ---------------- | ---------- | -------------------- |
| 100 Mo  | 0.74 s     | 527,586  | 4.88 Mio     | 396.4 Mio        | 90.3 Mio   | 16.8 ms              |
| 500 Mo  | 3.80 s     | 514,454  | 24.38 Mio    | 399.1 Mio        | 92.9 Mio   | 16.7 ms              |
| 1000 Mo | 7.48 s     | 522,310  | 48.75 Mio    | 422.7 Mio        | 116.6 Mio  | 16.7 ms              |

Le p95 au repos est de 16,7–16,8 ms ; aucun intervalle pendant l'indexation ne dépasse
16,9 ms et aucune tâche principale de plus de 50 ms n'a été détectée sur ces neuf essais.
Les RSS incluent l'ensemble des processus Chromium selon les limites expliquées plus haut.
Les [neuf mesures brutes](reference.json) permettent de consulter la dispersion et les
valeurs de départ. Il n'y a pas de comparaison avant/après sur cette machine.
