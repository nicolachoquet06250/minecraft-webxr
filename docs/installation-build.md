# Installation, build et scripts

## Prérequis

Le projet nécessite :

- Node.js v24 ou supérieur ;
- npm ;
- Rust et Cargo ;
- `wasm-pack`.

Le build WebAssembly est exécuté via `wasm-pack`, appelé depuis les scripts npm.

## Installation locale

```bash
git clone https://github.com/nicolachoquet06250/minecraft-webxr.git
cd minecraft-webxr
npm install
```

## Lancement en développement

```bash
npm run dev
```

Ce script exécute :

```bash
npm run build:wasm && vite --host
```

Il compile donc d'abord la partie Rust/WebAssembly, puis lance le serveur Vite accessible sur le réseau local grâce à `--host`.

## Build de production

```bash
npm run build
```

Ce script exécute :

```bash
npm run build:wasm && tsc && vite build
```

Étapes :

1. compilation du WASM ;
2. vérification TypeScript via `tsc` ;
3. génération du build frontend Vite dans `dist/`.

## Build WASM seul

```bash
npm run build:wasm
```

Ce script exécute :

```bash
cargo install wasm-pack && cd wasm && cargo test && wasm-pack build --target web --out-dir ../src/assets/wasm
```

Détail :

1. installe `wasm-pack` si nécessaire ;
2. se place dans le dossier `wasm/` ;
3. lance les tests Cargo ;
4. compile le crate Rust vers une cible compatible navigateur ;
5. écrit les fichiers générés dans `src/assets/wasm`.

## Preview locale du build

```bash
npm run preview
```

Ce script lance `vite preview` pour tester localement le résultat de production.

## Dépendances frontend

Les dépendances principales sont :

- `@babylonjs/core` : moteur 3D ;
- `@babylonjs/gui` : interfaces 2D dans Babylon ;
- `@babylonjs/loaders` : chargement de modèles 3D ;
- `vite-plugin-pwa` : service worker et PWA ;
- `vite-plugin-mkcert` : certificat local pour les contextes nécessitant HTTPS ;
- `typescript` ;
- `@playwright/test`.

## Dépendances Rust

La partie Rust utilise notamment :

- `wasm-bindgen` pour exposer des fonctions Rust à JavaScript ;
- `noise` pour la génération procédurale basée sur du bruit de Perlin.

## Sortie WebAssembly

La sortie `wasm-pack` est écrite dans :

```txt
src/assets/wasm/
```

Le runtime TypeScript importe ensuite :

```ts
import init, * as wasmModule from "~/assets/wasm/voxel_wasm";
import voxelWasmUrl from "~/assets/wasm/voxel_wasm_bg.wasm?url";
```

Le fichier `.wasm` est donc traité comme asset Vite.

## HTTPS et WebXR

WebXR nécessite généralement un contexte sécurisé :

- HTTPS en production ;
- localhost accepté par certains navigateurs ;
- certificat local utile pour tester sur un casque ou un téléphone via le réseau.

`vite-plugin-mkcert` est présent pour faciliter ce type de configuration.

## PWA et cache

Le projet utilise un service worker généré par `vite-plugin-pwa`. Au démarrage, le code :

- vérifie les registrations existantes ;
- supprime les registrations multiples ;
- vide les caches si plusieurs services workers sont détectés ;
- recharge la page si une mise à jour est nécessaire.

Ce comportement évite certains problèmes classiques de PWA où l'application reste bloquée sur une ancienne version.

## Points d'attention

### `wasm-pack` installé à chaque build

Le script `build:wasm` contient :

```bash
cargo install wasm-pack
```

Cela garantit la présence de l'outil, mais peut ralentir le build. Sur une CI ou un environnement stable, il peut être préférable de préinstaller `wasm-pack`.

### Tests Rust bloquants

`cargo test` est exécuté avant `wasm-pack build`. Si un test Rust échoue, le build frontend ne démarre pas.

### Compatibilité navigateur

Le jeu dépend de fonctionnalités navigateur modernes :

- WebGL/WebGPU selon Babylon et environnement ;
- WebAssembly ;
- Pointer Lock API ;
- Service Worker ;
- WebXR pour la VR ;
- APIs tactiles pour mobile.

## Commandes utiles

```bash
# Installer les dépendances
npm install

# Développement
npm run dev

# Build complet
npm run build

# Build WASM seul
npm run build:wasm

# Preview production
npm run preview
```
