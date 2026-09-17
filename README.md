# Magneto — Explorateur de logs

Explorateur local de fichiers `.log`, `.txt` et `.jsonl` en UTF-8 (LF ou CRLF).
Le contenu reste dans le navigateur : aucun transfert ni backend de traitement.

Ouvrez ou déposez un fichier, puis recherchez des termes et/ou sélectionnez des niveaux.
Les termes sont tous requis et insensibles à la casse ; les niveaux DEBUG, INFO, WARN et ERROR
sont combinés par OU. Sans niveau sélectionné, les lignes de niveau inconnu sont aussi incluses.
Validez avec « Rechercher » pour appliquer les filtres. Cliquez sur une ligne pour lire son contexte.

L’indexation et la recherche tournent dans un Web Worker, par blocs de 1 Mio. Les résultats
sont virtualisés par pages de 20 000 lignes. L’annulation d’une recherche conserve les résultats
partiels ; une indexation annulée doit être relancée.
L'index contient uniquement les offsets en octets, longueurs et niveaux dans des tableaux
typés, conservés dans le worker. Seuls la progression et les aperçus demandés reviennent
au thread principal. Chaque indexation réutilise un préfixe de 8 Kio et un décodeur UTF-8.
Une annulation ou une erreur libère l'index partiel ; ouvrir un autre fichier termine
le worker précédent, y compris ses lectures en cours.

## Limites

- Budget de 256 Mio pour l’index et les résultats (hors mémoire du navigateur et buffers temporaires).
- Aperçu limité à 4 Kio par ligne, ou 8 Kio dans le contexte ; recherche sur la ligne entière.
- Détection du premier niveau reconnu dans les 8 premiers Kio de chaque ligne.
- Requête limitée à 1 024 caractères et 32 termes distincts.
- UTF-16 non pris en charge ; une ligne de plus de 4 Gio est refusée.

## Développement

Utiliser pnpm et le runtime Node déclarés dans `package.json`.

- `pnpm install` : installer les dépendances.
- `pnpm dev` : lancer le serveur local.
- `pnpm check` : formatage, lint, typage et tests unitaires.
- `pnpm build` : construire le site statique.
- `pnpm benchmark` : mesurer 100 Mo, 500 Mo et 1 Go dans Chromium (trois essais par taille).
  Voir le [protocole et les limites des mesures](benchmarks/README.md).
- `pnpm exec playwright install chromium` : installer le navigateur de test.
- `pnpm test:e2e` : vérifier les parcours dans Chromium (`CI=1` pour le mode sans fenêtre).

Pour un déploiement sous un sous-répertoire, définir `VITE_BASE_URL` lors de la compilation,
par exemple `/magneto/` pour GitHub Pages.
