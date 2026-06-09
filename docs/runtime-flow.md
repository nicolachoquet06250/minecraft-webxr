# Cycle de vie runtime

## Point d'entrée

Le runtime démarre dans `src/main.ts`. Le fichier est responsable de l'initialisation complète du jeu côté navigateur.

Les grandes étapes sont :

1. import des styles et modules ;
2. chargement du module WebAssembly ;
3. initialisation PWA/service worker ;
4. création du canvas Babylon ;
5. affichage du menu principal ;
6. démarrage effectif du jeu via `startGame()` ;
7. boucle de rendu Babylon.

## Chargement WebAssembly

Le chargement WASM est encapsulé dans `loadVoxelWasm()`.

```ts
async function loadVoxelWasm(): Promise<VoxelWasmModule>
```

Le chargement est mémorisé dans `globalThis.__minecraftVoxelWasmPromise` pour éviter plusieurs initialisations concurrentes.

En cas d'erreur, la promesse mémorisée est réinitialisée afin de permettre une nouvelle tentative.

## Initialisation PWA

Au démarrage, le code récupère les registrations Service Worker existantes.

Si plusieurs registrations sont détectées :

1. elles sont désenregistrées ;
2. les caches sont supprimés ;
3. la page est rechargée.

Ensuite, `registerSW()` est appelé avec :

- `immediate: true` ;
- reload automatique lors d'une mise à jour ;
- log lorsque l'application est prête hors ligne.

## Création du moteur Babylon

Le canvas est récupéré depuis le DOM :

```ts
const canvas = document.querySelector("#minecraft");
```

Puis le moteur est créé :

```ts
const engine = new Engine(minecraftCanvas, true);
```

La scène n'est créée qu'au lancement effectif du jeu dans `startGame()`.

## Menu principal

Le runtime appelle :

```ts
await showMainMenu({
  engine,
  canvas: minecraftCanvas,
  onPlay: (options) => {
    void startGame(options);
  },
});
```

Le menu principal contrôle donc le démarrage du jeu. Les options passées peuvent notamment demander une entrée directe en VR.

## Démarrage du jeu

`startGame()` est protégé par un booléen `gameStarted`. Une fois le jeu démarré, un second appel est ignoré.

Étapes réalisées :

1. création d'une `Scene` ;
2. définition de la couleur du ciel ;
3. initialisation de la lumière ;
4. application du matériau d'atlas procédural ;
5. chargement du WASM ;
6. récupération des dimensions de chunks depuis Rust ;
7. génération des chunks initiaux ;
8. génération des meshes Babylon ;
9. création du joueur ;
10. création de la caméra ;
11. initialisation de l'eau ;
12. initialisation des UI ;
13. initialisation des événements et contrôles ;
14. démarrage de la boucle de rendu.

## Génération initiale des chunks

Le chunk de spawn est calculé à partir de `SPAWN_X`, `SPAWN_Z` et des dimensions retournées par le WASM.

Le jeu génère un carré de chunks autour du spawn selon `INITIAL_CHUNK_RADIUS`.

```txt
rayon 3 => 7 x 7 chunks initiaux
```

Chaque chunk est généré par :

```ts
const blocks = generate_chunk(chunkX, chunkZ, SEED);
```

Puis converti en mesh via :

```ts
createChunkMesh(...)
```

Enfin, le chunk est ajouté dans `worldChunks`.

## Spawn joueur

Le spawn est recherché via `findDrySpawnPosition(...)`. L'objectif est d'éviter de placer le joueur dans l'eau.

Le joueur est ensuite créé avec :

```ts
const player = generatePlayer(spawn);
```

Des références de contexte sont ajoutées au joueur pour certains modules UI et mobile :

- `_worldChunks` ;
- `_sizeX` ;
- `_sizeY` ;
- `_sizeZ` ;
- `_material` ;
- `_droppedItems`.

Ces propriétés sont utilisées comme pont pragmatique entre les contrôles et les systèmes de gameplay.

## Initialisation UI et gameplay

Le runtime initialise :

- le pointeur central desktop/mobile ;
- la barre d'inventaire classique ;
- le label du bloc pointé ;
- les événements clavier/souris ;
- les contrôles mobiles ;
- l'overlay de craft ;
- les contrôles WebXR ;
- la barre d'inventaire VR ;
- les modèles 3D de poppies ;
- l'effet d'eau.

## Boucle de rendu

La boucle est enregistrée avec :

```ts
engine.runRenderLoop(() => {
  ...
  scene.render();
});
```

À chaque frame :

1. calcul du `deltaTime` ;
2. détection de l'état WebXR ;
3. récupération des rayons de contrôleurs VR ;
4. masquage du pointeur central si la VR est active ;
5. mise à jour du label du bloc pointé ;
6. synchronisation VR avant physique ;
7. gestion des actions VR de placement/destruction ;
8. calcul de la direction de déplacement desktop ;
9. mise à jour de la physique joueur ;
10. auto-jump ;
11. mise à jour des effets d'eau ;
12. synchronisation VR après physique ;
13. génération des chunks manquants autour du joueur ;
14. mise à jour de la destruction progressive ;
15. mise à jour des drops ;
16. rendu de la scène.

## Ordre important des opérations

L'ordre `syncBeforePhysics -> updatePlayerPhysics -> syncAfterPhysics` est important en VR.

- `syncBeforePhysics` lit les contrôleurs et applique le mouvement voulu.
- `updatePlayerPhysics` applique la physique globale.
- `syncAfterPhysics` recale la caméra XR sur la position physique du joueur.

## Auto-jump

Le runtime contient un auto-jump desktop/mobile qui :

1. vérifie que le joueur est au sol ;
2. vérifie qu'une direction de mouvement existe ;
3. détecte un bloc devant le joueur ;
4. vérifie qu'un espace existe au-dessus ;
5. applique une vélocité verticale.

En VR, un auto-jump spécifique existe dans `vr-mode.ts`.

## Gestion des rayons d'interaction

Deux types de rayons sont utilisés :

- **desktop/mobile** : raycast depuis le centre de l'écran ;
- **VR** : raycast depuis les contrôleurs.

Les fonctions de destruction et placement acceptent un `targetRay` optionnel. Si ce rayon est présent, il remplace le rayon caméra.

## Mise à jour des chunks autour du joueur

À chaque frame, `ensureChunksAroundPlayer(...)` vérifie les chunks autour de la position actuelle du joueur.

Si un chunk attendu n'existe pas :

1. il est généré via WASM ;
2. son mesh est créé ;
3. il est ajouté à `worldChunks`.

À l'heure actuelle, cette fonction ajoute les chunks manquants mais ne supprime pas les chunks lointains.

## Points d'extension

Pour ajouter un nouveau système runtime, il faut généralement :

1. créer un module dédié dans `src/` ;
2. l'initialiser dans `startGame()` ;
3. lui fournir les références nécessaires (`scene`, `player`, `worldChunks`, dimensions de chunks, matériaux, drops) ;
4. appeler sa méthode `update` dans la boucle de rendu si nécessaire.

## Anti-patterns à éviter

- Ajouter une logique lourde directement dans `main.ts`.
- Recréer des matériaux ou textures à chaque frame.
- Accéder au WASM depuis plusieurs endroits sans centraliser la logique.
- Modifier les dimensions des chunks côté Rust sans vérifier tout le code TypeScript dépendant.
- Ajouter des propriétés dynamiques au joueur sans les documenter.