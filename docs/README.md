# Documentation technique - Minecraft WebXR

Cette documentation décrit l'architecture technique du projet, les principaux modules TypeScript, la partie Rust/WebAssembly, les systèmes de rendu, les interactions de gameplay et les contrôles par type de device.

## Sommaire

1. [Vue d'ensemble de l'architecture](./architecture.md)
2. [Installation, build et scripts](./installation-build.md)
3. [Cycle de vie runtime](./runtime-flow.md)
4. [Génération procédurale du monde](./world-generation.md)
5. [Blocs, items, inventaire et craft](./blocks-items-crafting.md)
6. [Rendu, meshes, atlas et effets visuels](./rendering-and-effects.md)
7. [Interactions de gameplay](./gameplay-interactions.md)
8. [Contrôles desktop, mobile et VR](./controls.md)
9. [PWA, assets et déploiement navigateur](./pwa-assets.md)

## Objectif du projet

Minecraft WebXR est un clone de Minecraft jouable dans le navigateur. Le projet combine :

- un frontend TypeScript basé sur Babylon.js ;
- une génération de monde écrite en Rust et compilée en WebAssembly ;
- des interfaces Babylon GUI pour l'inventaire, le craft, le menu et les contrôles mobiles ;
- un support expérimental WebXR pour les casques VR ;
- un mode PWA avec service worker et fonctionnement hors ligne.

## Organisation générale

```txt
.
├── public/                  # Assets statiques exposés tels quels par Vite
├── src/                     # Code TypeScript principal
│   ├── assets/wasm/          # Sortie générée par wasm-pack
│   ├── blocks/              # Définitions des blocs et textures procédurales
│   ├── crafts/              # Recettes de craft
│   ├── items/               # Définitions d'items et icônes d'inventaire
│   ├── main.ts              # Point d'entrée runtime du jeu
│   ├── textured-world.ts    # Meshes de chunks, placement, destruction, drops
│   ├── block-breaking.ts    # Destruction progressive avec overlay de fissures
│   ├── tree-decay.ts        # Décroissance automatique des feuilles
│   ├── mobile-controls.ts   # Contrôles tactiles
│   ├── vr-mode.ts           # Contrôles WebXR
│   └── inventory-ui.ts      # Inventaires desktop et VR
├── wasm/                    # Crate Rust compilée en WebAssembly
├── docs/                    # Documentation technique
├── package.json             # Scripts npm et dépendances frontend
└── README.md                # Présentation utilisateur du projet
```

## Principes structurants

- **Séparation du calcul lourd et du rendu** : la génération des chunks est faite côté Rust/WASM, tandis que Babylon.js construit les meshes et affiche la scène.
- **Définitions déclaratives** : les blocs, items, textures et recettes sont décrits dans des modules dédiés.
- **Chunking** : le monde est stocké par chunks 16x96x16 et les chunks autour du joueur sont générés progressivement.
- **Rendu mesh optimisé** : seules les faces visibles ou nécessaires sont ajoutées aux buffers.
- **Input multi-device** : desktop, mobile et VR partagent les mêmes états joueur et monde, mais utilisent des sources d'entrée différentes.
- **Interface Babylon GUI** : les UI importantes sont intégrées dans Babylon plutôt qu'en HTML/CSS classique.

## Convention de lecture

Les fichiers de cette documentation décrivent l'état actuel de l'implémentation sur la branche `staging`. Lorsqu'un système est expérimental, notamment WebXR, il est documenté comme tel.