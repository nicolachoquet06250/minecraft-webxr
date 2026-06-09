# Vue d'ensemble de l'architecture

## Architecture globale

Le projet est organisé autour de deux couches principales :

1. **TypeScript / Babylon.js**
   - initialise le canvas, le moteur Babylon et la scène ;
   - charge le module WebAssembly ;
   - construit les meshes visibles des chunks ;
   - gère la physique joueur, les entrées clavier/souris, tactiles et VR ;
   - affiche les UI Babylon GUI ;
   - gère les interactions avec les blocs et l'inventaire.

2. **Rust / WebAssembly**
   - génère les données brutes des chunks ;
   - calcule les hauteurs de terrain ;
   - choisit les biomes ;
   - place les couches souterraines, minerais, cavités, liquides, arbres et décorations.

Le rendu final est entièrement produit côté navigateur avec Babylon.js. Rust ne produit pas de mesh : il retourne une `Vec<u8>` contenant les identifiants de blocs du chunk.

## Flux simplifié

```txt
main.ts
  ├── charge le WASM
  ├── crée Engine + Scene
  ├── initialise lumière, caméra, joueur et UI
  ├── génère les chunks initiaux via wasm.generate_chunk(...)
  ├── convertit les chunks en meshes Babylon
  └── lance la boucle de rendu
        ├── lit les inputs
        ├── met à jour la physique
        ├── met à jour les interactions
        ├── génère les chunks manquants autour du joueur
        ├── met à jour les drops/effects
        └── scene.render()
```

## Modules principaux

### `src/main.ts`

Point d'entrée applicatif. Il :

- importe le WASM généré dans `src/assets/wasm` ;
- initialise le service worker PWA ;
- crée `Engine` et `Scene` ;
- charge la génération de chunks Rust ;
- construit les chunks initiaux ;
- crée le joueur, la caméra, l'inventaire, le craft, les contrôles mobile et VR ;
- exécute la boucle de rendu Babylon.

### `src/textured-world.ts`

Responsable du monde visible et interactif :

- création des meshes de chunks ;
- construction des buffers de géométrie ;
- ajout des faces texturées visibles ;
- gestion spécifique de l'eau ;
- placement et destruction des blocs ;
- drops, animation physique des drops et ramassage ;
- génération de chunks autour du joueur.

### `src/functions.ts`

Regroupe des fonctions utilitaires transverses :

- accès aux blocs dans les tableaux de chunks ;
- conversions coordonnées monde/locales ;
- détection des collisions ;
- initialisation caméra/lumières/joueur ;
- gestion de l'inventaire ;
- recherche de spawn hors eau.

### `src/types.ts`

Définit les types partagés :

- `PlayerPhysics` ;
- `InventoryItem` ;
- `VoxelWasmModule` ;
- `WorldChunk` / `WorldChunks` ;
- `BlockId` ;
- paramètres de création de chunks et de mise à jour physique.

### `src/constants.ts`

Centralise les constantes globales :

- dimensions du joueur ;
- gravité, vitesse de déplacement, saut ;
- sensibilité souris ;
- seed ;
- position de spawn ;
- rayon initial de chunks ;
- faces unitaires utilisées pour générer les meshes ;
- paramètres de leaf decay.

### `src/blocks/`

Définit les blocs sous forme déclarative :

- terrain ;
- blocs naturels ;
- minerais ;
- arbres ;
- plantes ;
- blocs décoratifs ;
- laines.

Chaque définition peut inclure :

- un identifiant `BlockId` ;
- un nom anglais/français ;
- une couleur fallback ;
- un état solide ou transparent ;
- une hauteur visuelle ;
- des textures procédurales par face.

### `src/items/`

Définit les items manipulables par l'inventaire et le craft :

- items représentant des blocs ;
- outils ;
- icônes ;
- taille maximale de stack.

### `src/crafts/`

Contient les recettes de craft. Les recettes sont séparées du code UI afin de pouvoir ajouter des patterns sans modifier le rendu de l'interface.

### `src/crafting-ui.ts`

Interface de craft en Babylon GUI :

- overlay plein écran ;
- grille 3x3 ;
- barre d'inventaire ;
- slot de résultat ;
- drag & drop souris/tactile ;
- consommation des ingrédients lorsque le résultat est récupéré.

### `src/inventory-ui.ts`

Gère les barres d'inventaire :

- version écran classique ;
- version VR attachée au corps du joueur ;
- affichage des icônes d'items ;
- sélection de slot.

### `src/mobile-controls.ts`

Contrôles tactiles :

- détection du mode mobile ;
- exclusion des casques VR autonomes de la détection mobile ;
- joystick de déplacement ;
- joystick de regard ;
- boutons saut, destruction, placement et craft.

### `src/vr-mode.ts`

Support WebXR expérimental :

- création de l'expérience WebXR ;
- entrée en session immersive VR ;
- lecture des contrôleurs ;
- récupération des rayons de contrôleur ;
- déplacement via contrôleur gauche ;
- saut via bouton A droit ;
- interactions via triggers.

### `wasm/src/lib.rs`

Crate Rust compilée en WebAssembly. Elle expose :

- `chunk_size_x()` ;
- `chunk_size_y()` ;
- `chunk_size_z()` ;
- `generate_chunk(chunk_x, chunk_z, seed)`.

## Données principales

### Monde

Le monde est stocké dans une `Map` TypeScript :

```ts
WorldChunks = Map<string, WorldChunk>
```

Chaque `WorldChunk` contient :

- `chunkX` ;
- `chunkZ` ;
- `blocks`, tableau linéaire `Uint8Array` ;
- `mesh`, mesh Babylon associé au chunk.

### Joueur

Le joueur est représenté par `PlayerPhysics` :

```ts
type PlayerPhysics = {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  inventory: InventoryItem[];
  selectedSlot: number;
};
```

Ce modèle est partagé entre desktop, mobile et VR.

### Blocs

Les blocs sont identifiés par l'énumération `BlockId`. Les identifiants doivent rester synchronisés entre :

- `src/types.ts` côté TypeScript ;
- `wasm/src/lib.rs` côté Rust.

Si un bloc est ajouté, il faut vérifier les deux côtés.

## Frontière TypeScript / WASM

Le WASM ne connaît pas Babylon.js. Il retourne uniquement une représentation compacte du chunk.

```txt
Rust generate_chunk(...)
  -> Vec<u8>
  -> TypeScript Uint8Array
  -> createChunkMesh(...)
  -> Mesh Babylon
```

Cette séparation permet de garder la génération procédurale indépendante du moteur de rendu.

## Risques techniques

### Synchronisation des `BlockId`

Le même ordre d'identifiants doit être conservé entre TypeScript et Rust. Une divergence provoque des blocs incorrects au rendu.

### Rebuild des chunks

Lorsqu'un bloc est placé ou détruit, le chunk concerné est reconstruit. Si le bloc est sur une bordure, les chunks voisins doivent aussi être reconstruits pour mettre à jour les faces visibles.

### WebXR

Le support VR dépend fortement :

- du navigateur ;
- du casque ;
- du support `navigator.xr` ;
- du mapping des composants de contrôleurs.

Le code contient plusieurs fallbacks pour gérer différents noms de composants WebXR.