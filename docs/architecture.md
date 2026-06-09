[⬅️ Précédent](./README.md) | [Sommaire](./README.md) | [Suivant ➡️](./installation-build.md)

---

# Vue d'ensemble de l'architecture

## Architecture globale

Minecraft WebXR est organisé autour de deux couches principales.

### TypeScript / Babylon.js

Cette couche initialise le canvas, le moteur Babylon, la scène, les lumières, la caméra, le joueur, les interfaces et les contrôles. Elle transforme aussi les chunks générés par Rust/WASM en meshes Babylon visibles.

### Rust / WebAssembly

Cette couche génère les données brutes du monde sous forme de tableaux de `BlockId`. Elle calcule les hauteurs, biomes, couches de sous-sol, minerais, cavités, liquides, arbres et décorations.

## Flux général

```txt
main.ts
  -> charge le module WASM
  -> crée Engine + Scene
  -> génère les chunks initiaux
  -> construit les meshes Babylon
  -> initialise joueur + UI + contrôles
  -> lance la boucle de rendu
```

## Modules principaux

| Module | Rôle |
|--------|------|
| `src/main.ts` | Point d'entrée runtime, initialisation globale et boucle de rendu. |
| `src/textured-world.ts` | Création des chunks visibles, placement, destruction, drops et génération autour du joueur. |
| `src/functions.ts` | Fonctions utilitaires : accès blocs, collisions, inventaire, spawn, caméra. |
| `src/types.ts` | Types partagés : joueur, inventaire, chunks, blocs, WASM. |
| `src/constants.ts` | Constantes globales : joueur, gravité, vitesse, seed, faces, chunks. |
| `src/blocks/` | Définitions des blocs, noms, couleurs, solidité, textures et hauteur visuelle. |
| `src/items/` | Définitions des items et icônes d'inventaire. |
| `src/crafts/` | Recettes de craft sous forme de patterns 3x3. |
| `src/crafting-ui.ts` | Overlay de craft en Babylon GUI. |
| `src/inventory-ui.ts` | Inventaire classique et inventaire VR. |
| `src/mobile-controls.ts` | Contrôles tactiles mobile. |
| `src/vr-mode.ts` | Support WebXR, contrôleurs, rayons et déplacement VR. |
| `wasm/src/lib.rs` | Génération procédurale Rust compilée en WebAssembly. |

## Données principales

Le monde est stocké dans une `Map<string, WorldChunk>`. Chaque chunk contient ses coordonnées, son tableau de blocs et le mesh Babylon associé.

Le joueur est représenté par `PlayerPhysics` : position, vélocité, orientation, état au sol, inventaire et slot sélectionné.

## Frontière TypeScript / WASM

```txt
Rust generate_chunk(...)
  -> Vec<u8>
  -> Uint8Array côté TypeScript
  -> createChunkMesh(...)
  -> Mesh Babylon
```

Rust ne connaît pas Babylon.js. Il ne fait que produire des identifiants de blocs.

## Points critiques

- Les `BlockId` doivent rester synchronisés entre `src/types.ts` et `wasm/src/lib.rs`.
- Modifier un bloc en bordure de chunk impose de reconstruire le chunk voisin.
- WebXR dépend fortement du navigateur, du casque et du mapping des contrôleurs.
- Les interfaces importantes sont en Babylon GUI, pas en HTML/CSS classique.

---

[⬅️ Précédent](./README.md) | [Sommaire](./README.md) | [Suivant ➡️](./installation-build.md)
