[⬅️ Précédent](./pwa-assets.md) | [Sommaire](./README.md) | [Suivant ➡️](./game-guide/README.md)

---

# Mods et plugins

> **Statut : expérimental**  
> Le système de mods est en cours d'intégration. Son format de manifest, son API client et son futur runtime serveur peuvent encore changer avant stabilisation.

## Objectif

Le système de mods permet à un serveur VoxiCraft de découvrir dynamiquement des extensions placées dans un dossier `mods/`, sans recompiler le binaire principal.

Un mod peut être :

- uniquement client, avec un fichier JavaScript chargé par le navigateur ;
- uniquement serveur, avec une entrée WebAssembly prévue pour une étape ultérieure ;
- hybride, avec une partie client et une partie serveur.

```mermaid
flowchart LR
  Server[Serveur Rust]
  Registry[Registre de mods]
  Manifest[mod.json]
  ClientApi[API /api/mods/manifest]
  ClientFiles[/mods/:id/client/...]
  Browser[Navigateur]
  ModJs[client/mod.js]

  Server --> Registry
  Registry --> Manifest
  Registry --> ClientApi --> Browser
  Registry --> ClientFiles --> Browser
  Browser --> ModJs
```

## Flag expérimental

La fonctionnalité doit être considérée comme expérimentale tant que les points suivants ne sont pas stabilisés :

- ABI du runtime serveur WebAssembly ;
- gestion des permissions côté client et serveur ;
- hot reload des mods ;
- sandbox JavaScript côté client ;
- versionnement du manifest ;
- compatibilité entre versions de VoxiCraft et versions de mods.

Dans la documentation et les interfaces, le système doit être présenté avec le libellé :

```txt
Expérimental
```

ou :

```txt
⚠️ Expérimental
```

## Structure d'un mod

Structure recommandée :

```txt
mods/
  example-mod/
    mod.json
    client/
      mod.js
      mod.d.ts
      assets/
    server/
      mod.wasm
```

La partie `client/assets` est optionnelle. Si elle est déclarée dans `mod.json` mais que le dossier n'existe pas encore, le mod reste valide. Les fichiers demandés sous ce dossier répondront simplement `404` tant qu'ils sont absents.

## Manifest `mod.json`

Exemple hybride :

```json
{
  "id": "example-mod",
  "name": "Example Mod",
  "version": "0.1.0",
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
      "game.events",
      "ui.notify"
    ]
  }
}
```

Champs principaux :

| Champ | Description |
|---|---|
| `id` | Identifiant unique du mod. Il ne doit pas contenir `/`, `\\` ou `..`. |
| `name` | Nom affichable du mod. |
| `version` | Version du mod. |
| `side` | `client`, `server` ou `both`. |
| `client.entry` | Fichier JavaScript client obligatoire pour les mods client. |
| `client.types` | Fichier `.d.ts` optionnel pour l'autocomplétion. |
| `client.assets` | Dossier optionnel d'assets publics du mod. |
| `server.entry` | Fichier WASM serveur prévu pour les mods serveur. |
| `permissions.client` | Permissions demandées côté navigateur. |
| `permissions.server` | Permissions demandées côté serveur. |

## Routes publiques

Les routes nécessaires au chargement des mods sont publiques. Elles ne doivent pas dépendre d'une session utilisateur, car les mods doivent fonctionner aussi en mode solo.

```txt
GET /api/mods/manifest
GET /mods/{mod_id}/client/mod.js
GET /mods/{mod_id}/client/mod.d.ts
GET /mods/{mod_id}/client/assets/...
```

Ces routes doivent rester accessibles sans authentification.

## Sécurité de l'exposition HTTP

Le serveur ne sert pas tout le dossier du mod. Il applique une allow-list basée sur le bloc `client` du manifest.

Autorisé :

```txt
client.entry
client.types
client.assets/*
```

Refusé :

```txt
mod.json
server/mod.wasm
../...
fichiers non déclarés hors client.assets
```

Par exemple :

```txt
/mods/example-mod/client/mod.js      -> autorisé si déclaré comme client.entry
/mods/example-mod/client/mod.d.ts    -> autorisé si déclaré comme client.types
/mods/example-mod/client/assets/a.png -> autorisé si sous client.assets
/mods/example-mod/mod.json           -> 404
/mods/example-mod/server/mod.wasm    -> 404
```

## Chargement côté client

Le navigateur récupère d'abord le manifest public :

```ts
const response = await fetch("/api/mods/manifest");
const manifest = await response.json();
```

Ensuite, chaque mod client est chargé via un import dynamique :

```ts
await import(/* @vite-ignore */ "/mods/example-mod/client/mod.js");
```

Le module JavaScript doit exporter une fonction `activate` :

```js
export async function activate(ctx) {
  ctx.ui.notify("Mod chargé");
}
```

Il peut aussi exporter `deactivate` pour nettoyer ses ressources :

```js
export async function deactivate(ctx) {
  ctx.ui.notify("Mod déchargé");
}
```

## Contexte client exposé

Le contexte client donne accès à une API contrôlée :

```ts
export type VoxiCraftClientModContext = {
  BABYLON: typeof import("@babylonjs/core")
  scene: Scene
  engine: Engine
  player: PlayerPhysics
  worldChunks: WorldChunks
  droppedItems: DroppedItem[]
  events: VoxiCraftClientEventBus
  ui: {
    notify(message: string): void
  }
  resolveAssetUrl(path: string): string
  addDisposable(disposable: { dispose(): void }): void
}
```

Le mod doit utiliser `addDisposable` pour enregistrer les meshes, observers ou ressources à libérer lors d'un déchargement.

## Configuration serveur

Par défaut, le serveur scanne :

```txt
mods/
```

Le chemin peut être modifié avec :

```bash
MODS_DIR=mods
```

Depuis la racine du dépôt :

```bash
MODS_DIR=mods cargo run --manifest-path server/Cargo.toml --features embed_front
```

Depuis le dossier `server/` :

```bash
MODS_DIR=../mods cargo run --features embed_front
```

## Tests rapides

Après démarrage du serveur :

```bash
curl -i http://localhost:8080/api/mods/manifest
curl -i http://localhost:8080/mods/example-client-mod/client/mod.js
curl -i http://localhost:8080/mods/example-client-mod/mod.json
```

Résultat attendu :

```txt
/api/mods/manifest                    -> 200 application/json
/mods/example-client-mod/client/mod.js -> 200 JavaScript
/mods/example-client-mod/mod.json      -> 404
```

## Limites actuelles

Le système est encore expérimental et ne fournit pas encore :

- de runtime serveur WASM chargé et exécuté ;
- de hot reload complet des mods ;
- d'interface d'administration pour activer/désactiver un mod ;
- de sandbox forte côté navigateur ;
- de marketplace ou gestionnaire de dépendances ;
- de compatibilité garantie du manifest entre versions.

## Prochaines étapes

- Ajouter le hot reload des manifests et fichiers client.
- Définir l'ABI serveur WebAssembly.
- Ajouter une UI de diagnostic des mods chargés.
- Ajouter un système de permissions réellement appliqué côté client et serveur.
- Ajouter des tests automatisés sur la résolution sécurisée des fichiers.

---

[⬅️ Précédent](./pwa-assets.md) | [Sommaire](./README.md) | [Suivant ➡️](./game-guide/README.md)
