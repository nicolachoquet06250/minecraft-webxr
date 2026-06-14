# Système de mods VoxiCraft

Cette page décrit la première architecture cible du système de mods/plugins VoxiCraft.

## Objectif

Le serveur VoxiCraft doit rester un binaire stable, mais il doit pouvoir découvrir des mods placés à côté de l'exécutable dans un répertoire `mods/`.

Un mod peut contenir :

- une partie serveur en WebAssembly : `server/mod.wasm` ;
- une partie client en JavaScript : `client/mod.js` ;
- un fichier de types pour l'autocomplétion : `client/mod.d.ts` ;
- des assets client : `client/assets/`.

## Structure d'un mod

```txt
mods/
  example-mod/
    mod.json
    server/
      mod.wasm
    client/
      mod.js
      mod.d.ts
      assets/
```

## Manifest

```json
{
  "id": "example-mod",
  "name": "Example Mod",
  "version": "1.0.0",
  "side": "both",
  "server": {
    "runtime": "wasm",
    "entry": "server/mod.wasm"
  },
  "client": {
    "runtime": "javascript",
    "entry": "client/mod.js",
    "types": "client/mod.d.ts",
    "assets": "client/assets"
  },
  "permissions": {
    "server": [
      "world.read",
      "world.write"
    ],
    "client": [
      "babylon.scene",
      "game.player.read",
      "ui.notify"
    ]
  }
}
```

## Partie serveur

Le serveur Rust doit :

1. scanner le dossier `mods/` ;
2. lire chaque `mod.json` ;
3. valider les chemins déclarés ;
4. exposer uniquement les métadonnées utiles au client ;
5. charger plus tard les entrées `server/mod.wasm` via un runtime WASM.

Le fichier `server/src/mods.rs` contient la première version du registre de mods. Il sait déjà lire les manifests, filtrer les mods côté client et résoudre les fichiers client servis par HTTP.

## Partie client

Le front charge les mods via un import dynamique :

```ts
await import(/* @vite-ignore */ "/mods/example-mod/client/mod.js")
```

Le mod doit exporter au minimum une fonction `activate` :

```js
export async function activate(ctx) {
  ctx.ui.notify("Mod chargé")

  const mesh = ctx.BABYLON.MeshBuilder.CreateBox(
    "example-mod-box",
    { size: 1 },
    ctx.scene,
  )

  ctx.addDisposable(mesh)
}
```

Il peut aussi exporter `deactivate` pour nettoyer ses ressources :

```js
export async function deactivate(ctx) {
  ctx.ui.notify("Mod déchargé")
}
```

## API client initiale

Le contexte client expose une API volontairement contrôlée :

```ts
export type VoxiCraftClientModContext = {
  BABYLON: typeof import("@babylonjs/core")
  manifest: VoxiCraftClientModManifest
  scene: Scene
  engine: Engine
  player: PlayerPhysics
  worldChunks: WorldChunks
  droppedItems: DroppedItem[]
  wasm: VoxelWasmModule
  events: VoxiCraftClientEventBus
  ui: {
    notify(message: string): void
  }
  resolveAssetUrl(path: string): string
  addDisposable(disposable: { dispose(): void }): void
}
```

## À faire ensuite

- Brancher `server/src/mods.rs` dans `server/src/main.rs`.
- Ajouter les routes :
  - `GET /api/mods/manifest` ;
  - `GET /mods/{mod_id}/...`.
- Brancher `ClientModManager` dans `src/main.ts` après l'initialisation du monde.
- Ajouter le hot reload via websocket.
- Ajouter le runtime serveur WASM (`wasmtime` ou équivalent) avec ABI stable.
