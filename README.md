# Magneto

Magneto est une application web en français qui permet d’explorer des fichiers de logs
(journaux d’événements). Ces fichiers retracent ce qui se passe dans une application :
informations, avertissements ou erreurs. Magneto aide à retrouver les lignes utiles sans
avoir à parcourir tout le fichier à la main.

**Vos fichiers restent dans votre navigateur.** Leur contenu n’est envoyé à aucun serveur :
la lecture et la recherche se font directement sur votre ordinateur.

## Fonctionnalités

- Ouvrir un fichier `.log`, `.txt` ou `.jsonl`, en le sélectionnant ou en le glissant dans la page.
- Rechercher plusieurs mots, sans distinction entre majuscules et minuscules.
- Filtrer les lignes par niveau : `DEBUG`, `INFO`, `WARN` ou `ERROR`.
- Consulter les lignes qui entourent un résultat pour comprendre son contexte.
- Suivre la progression de la préparation du fichier et des recherches, et les interrompre si besoin.

Les fichiers doivent être encodés en **UTF-8**, avec des fins de ligne Unix (LF) ou Windows (CRLF).

## Lancer le projet en local

### 1. Préparer les outils

Vous aurez besoin de :

- **Git**, pour récupérer le code du projet.
- **Node.js 24.21.0**, pour exécuter les outils de développement.
- **pnpm 12.3.4**, pour installer les bibliothèques utilisées par le projet.

Ces versions correspondent à la configuration du projet dans `package.json`.
L’application elle-même s’utilise ensuite dans un navigateur.

Après avoir installé Node.js et Git, ouvrez un terminal (Terminal sur macOS ou Linux,
PowerShell sur Windows). Vérifiez qu’ils sont disponibles :

```sh
node --version
git --version
```

Installez pnpm avec npm, l’outil fourni avec Node.js :

```sh
npm install --global pnpm@12.3.4
pnpm --version
```

Si une commande n’est pas reconnue après l’installation, fermez puis rouvrez le terminal.

### 2. Récupérer le projet

Dans le terminal, placez-vous dans le dossier où vous souhaitez conserver le projet, puis lancez :

```sh
git clone https://github.com/damien-hl/magneto.git
cd magneto
```

La première commande télécharge le code dans un dossier `magneto`. La seconde vous place dans
ce dossier. Toutes les commandes suivantes doivent être exécutées à cet endroit.

Si vous avez déjà récupéré le projet, ouvrez simplement un terminal dans son dossier.

### 3. Installer les dépendances

Les dépendances sont les bibliothèques dont le projet a besoin pour fonctionner.
Installez-les avec :

```sh
pnpm install
```

Cette étape nécessite une connexion Internet. Elle est à refaire si les dépendances du projet
changent, mais pas à chaque lancement.

### 4. Démarrer l’application

```sh
pnpm dev
```

Ouvrez l’adresse affichée dans le terminal, généralement `http://localhost:5173`.
Laissez le terminal ouvert pendant que vous utilisez Magneto. Pour arrêter le serveur local,
appuyez sur **Ctrl + C** dans ce terminal.

Pour relancer l’application plus tard, ouvrez un terminal dans le dossier `magneto` et exécutez
à nouveau `pnpm dev`.

## Utiliser Magneto

1. Glissez un fichier dans la zone d’ouverture, ou cliquez dessus pour le sélectionner.
2. Attendez la fin de l’indexation : cette préparation repère les lignes du fichier pour permettre
   les recherches.
3. Saisissez des mots à rechercher et, si nécessaire, sélectionnez un ou plusieurs niveaux.
4. Cliquez sur **Rechercher** pour appliquer les filtres.
5. Cliquez sur un résultat pour afficher les lignes autour de celui-ci.

Une recherche comme `connexion serveur` retrouve les lignes contenant **les deux mots**,
quelle que soit leur casse. Si vous sélectionnez `WARN` et `ERROR`, les résultats peuvent être
soit des avertissements, soit des erreurs. Sans niveau sélectionné, tous les niveaux sont inclus,
y compris les lignes dont le niveau n’a pas été reconnu.

Une recherche interrompue conserve les résultats déjà trouvés. Si vous interrompez l’indexation,
il faut la relancer avec **Réindexer le fichier** avant de rechercher.

## Développer et vérifier le projet

Magneto utilise **Vue 3**, **TypeScript** et **Vite**. Le serveur local actualise la page lorsque
vous modifiez le code.

| Commande             | Utilité                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`           | Lancer l’application en mode développement.                                  |
| `pnpm check`         | Vérifier le formatage, la qualité du code, les types et les tests unitaires. |
| `pnpm format`        | Appliquer automatiquement le formatage du projet.                            |
| `pnpm test:unit:run` | Exécuter les tests unitaires une fois.                                       |
| `pnpm build`         | Vérifier les types et générer le site prêt à être publié dans `dist/`.       |
| `pnpm preview`       | Prévisualiser localement le site généré, après `pnpm build`.                 |

Les tests de navigation simulent l’utilisation de l’application dans Chromium. Avant leur
première exécution, installez le navigateur de test :

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Ces tests ouvrent une fenêtre de navigateur par défaut. Dans l’intégration continue (`CI=1`),
ils s’exécutent sans fenêtre.

Pour mesurer les performances sur des fichiers de 100 Mo, 500 Mo et 1 Go, utilisez
`pnpm benchmark`. Le [protocole de mesure](benchmarks/README.md) détaille les prérequis et
l’interprétation des résultats.

### Organisation du code

```text
src/
├── main.ts          # Démarrage de l’application
├── App.vue          # Écran principal
├── styles.css       # Styles et thème communs
├── assets/          # Polices et images locales
└── features/logs/   # Lecture des fichiers, recherche et affichage des résultats
e2e/                # Tests de navigation
benchmarks/         # Mesures de performance
```

## Fonctionnement et limites

La préparation du fichier et la recherche s’exécutent dans un **Web Worker**, une tâche séparée
qui permet à l’interface de rester disponible pendant le traitement. Le fichier est lu
progressivement, par blocs de 1 Mio. Les résultats sont organisés en pages de 20 000 lignes,
et seules les lignes visibles sont affichées pour limiter le travail du navigateur.

Quelques limites à connaître :

- L’index et les résultats disposent d’un budget mémoire de **256 Mio**. Ce n’est pas une limite
  sur la taille du fichier ; le navigateur et les données temporaires utilisent aussi de la mémoire.
- L’aperçu d’une ligne est limité à 4 Kio dans les résultats et à 8 Kio dans le contexte.
  La recherche porte néanmoins sur la ligne entière.
- Le niveau retenu est le premier niveau reconnu dans les 8 premiers Kio de chaque ligne.
- Une recherche accepte au maximum 1 024 caractères et 32 termes distincts.
- L’encodage UTF-16 n’est pas pris en charge et une ligne de plus de 4 Gio est refusée.

## Déploiement

Magneto se publie comme un site statique : aucun serveur de traitement des logs n’est nécessaire.
La commande `pnpm build` génère les fichiers à publier dans `dist/`.

Pour un hébergement dans un sous-répertoire, comme `/magneto/` sur GitHub Pages, définissez
la variable d’environnement `VITE_BASE_URL` sur `/magneto/` avant la compilation afin que
les chemins des fichiers restent corrects.
