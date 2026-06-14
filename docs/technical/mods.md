# Système de mods VoxiCraft

> **Statut : expérimental**  
> Cette page est conservée comme note technique détaillée. La page principale de documentation est disponible ici : [`../mods.md`](../mods.md).

## Objectif

Le serveur VoxiCraft reste un binaire stable, mais il peut découvrir des mods placés à côté de l'exécutable dans un répertoire `mods/`.

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

Le dossier `client/assets/` est optionnel. S'il est déclaré dans `mod.json` mais qu'il n'existe pas encore, le mod reste chargé. Les fichiers absents sous ce dossier répondront simplement `404`.

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

Le serveur Rust :

1. scanne le dossier `mods/` ;
2. lit chaque `mod.json` ;
3. valide les chemins déclarés ;
4. expose uniquement les métadonnées utiles au client ;
5. expose uniquement les fichiers déclarés dans le bloc `client` ;
6. prépare la découverte des entrées `server/mod.wasm` pour un futur runtime WASM.

Le fichier `server/src/mods.rs` contient le registre de mods. Il lit les manifests, filtre les mods côté client et résout les fichiers client servis par HTTP.

## Routes publiques

Les routes de chargement des mods sont publiques afin de fonctionner aussi en mode solo sans connexion utilisateur :

```txt
GET /api/mods/manifest
GET /mods/{mod_id}/client/mod.js
GET /mods/{mod_id}/client/mod.d.ts
GET /mods/{mod_id}/client/assets/...
```

## Sécurité HTTP

La route `/mods/{*path}` ne sert pas tout le dossier du mod.

Elle autorise uniquement :

```txt
client.entry
client.types
client.assets/*
```

Elle refuse notamment :

```txt
mod.json
server/mod.wasm
../...
fichiers non déclarés hors client.assets
```

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

## Limites expérimentales

- Le runtime serveur WASM n'est pas encore exécuté.
- Les permissions sont documentées mais pas encore entièrement appliquées.
- Le hot reload des mods reste à implémenter.
- L'API client peut encore changer.
- Le manifest n'est pas encore versionné.

## À faire ensuite

- Ajouter le hot reload via websocket.
- Ajouter le runtime serveur WASM avec ABI stable.
- Ajouter une UI de diagnostic des mods chargés.
- Ajouter des tests automatisés sur la résolution sécurisée des fichiers client.
