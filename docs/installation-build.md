[⬅️ Précédent](./architecture.md) | [Sommaire](./README.md) | [Suivant ➡️](./runtime-flow.md)

---

# Installation, build et scripts

## Prérequis

Le projet nécessite Node.js, npm, Rust, Cargo et `wasm-pack`.

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

Ce script compile d'abord le WASM puis lance Vite avec `--host`.

## Build de production

```bash
npm run build
```

Étapes : compilation WASM, vérification TypeScript, puis build Vite.

## Build WASM seul

```bash
npm run build:wasm
```

Le script installe `wasm-pack` si besoin, lance les tests Cargo, puis écrit la sortie dans `src/assets/wasm`.

## Preview production

```bash
npm run preview
```

## Dépendances principales

- Babylon.js pour le rendu 3D et les interfaces GUI.
- Vite pour le build navigateur.
- `vite-plugin-pwa` pour la PWA.
- Rust, `wasm-bindgen` et `noise` pour la génération procédurale.

## Points d'attention

- WebXR et les Service Workers demandent un contexte sécurisé.
- Le fichier `.wasm` doit être servi avec le bon MIME type en production.
- Le cache PWA peut conserver d'anciennes versions si le Service Worker n'est pas nettoyé.

---

[⬅️ Précédent](./architecture.md) | [Sommaire](./README.md) | [Suivant ➡️](./runtime-flow.md)
