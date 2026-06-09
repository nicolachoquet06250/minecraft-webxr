[⬅️ Précédent](./rendering-and-effects.md) | [Sommaire](./README.md) | [Suivant ➡️](./world-generation.md)

---

# Cycle de vie runtime

## Point d'entrée

Le runtime démarre dans `src/main.ts`. Il charge le WASM, initialise la PWA, crée Babylon, affiche le menu principal, puis démarre le jeu via `startGame()`.

```mermaid
flowchart TD
  Entry[Chargement de main.ts]
  PWA[Initialisation PWA]
  Menu[Affichage du menu principal]
  Start[startGame]
  Scene[Creation Engine + Scene]
  Wasm[Chargement WASM]
  Chunks[Generation chunks initiaux]
  Player[Initialisation joueur + camera]
  UI[Initialisation UI]
  Loop[Boucle de rendu]

  Entry --> PWA --> Menu --> Start
  Start --> Scene
  Start --> Wasm
  Scene --> Chunks
  Wasm --> Chunks
  Chunks --> Player --> UI --> Loop
```

## Chargement WebAssembly

`loadVoxelWasm()` initialise le module généré dans `src/assets/wasm`. La promesse est mémorisée pour éviter plusieurs initialisations concurrentes.

## Démarrage du jeu

`startGame()` crée la scène, applique le ciel, initialise lumière, matériau d'atlas, WASM, chunks initiaux, joueur, caméra, eau, UI, contrôles mobile, contrôles VR et boucle de rendu.

## Génération initiale

Les chunks autour du spawn sont générés via `generate_chunk(chunkX, chunkZ, SEED)`, puis convertis en meshes Babylon avec `createChunkMesh(...)`.

## Boucle de rendu

À chaque frame :

1. calcul du delta time ;
2. lecture des inputs desktop/mobile/VR ;
3. mise à jour du joueur ;
4. synchronisation WebXR ;
5. gestion placement/destruction ;
6. génération des chunks manquants ;
7. mise à jour des drops, effets d'eau et breaking ;
8. rendu de la scène.

```mermaid
flowchart LR
  Frame[Frame]
  Delta[Calcul delta time]
  Inputs[Lecture inputs]
  Player[Mise a jour joueur]
  XR[Synchronisation WebXR]
  Gameplay[Placement / destruction]
  Chunks[Generation chunks manquants]
  Effects[Drops, eau, breaking]
  Render[Rendu Babylon]

  Frame --> Delta --> Inputs --> Player --> XR --> Gameplay --> Chunks --> Effects --> Render --> Frame
```

## Rayons d'interaction

Desktop et mobile utilisent le centre de l'écran. La VR utilise les rayons des contrôleurs. Les fonctions de gameplay acceptent un `targetRay` optionnel pour partager la logique entre devices.

```mermaid
flowchart TD
  Device{Device actif}
  Desktop[Desktop]
  Mobile[Mobile]
  VR[VR]
  CenterRay[Rayon centre ecran]
  ControllerRay[Rayon de manette]
  Gameplay[Logique gameplay commune]

  Device --> Desktop --> CenterRay
  Device --> Mobile --> CenterRay
  Device --> VR --> ControllerRay
  CenterRay --> Gameplay
  ControllerRay --> Gameplay
```

## Points d'extension

Pour ajouter un système runtime : créer un module dédié, l'initialiser dans `startGame()`, lui fournir le contexte nécessaire, puis appeler sa méthode `update` dans la boucle si besoin.

---

[⬅️ Précédent](./rendering-and-effects.md) | [Sommaire](./README.md) | [Suivant ➡️](./world-generation.md)
