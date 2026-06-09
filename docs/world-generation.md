[⬅️ Précédent](./runtime-flow.md) | [Sommaire](./README.md)

---

# Génération procédurale du monde

## Responsabilité

La génération procédurale est réalisée dans `wasm/src/lib.rs`, côté Rust. TypeScript demande un chunk via `generate_chunk(chunk_x, chunk_z, seed)` et reçoit un tableau d'identifiants de blocs.

```mermaid
sequenceDiagram
  participant TS as TypeScript
  participant WASM as Rust/WASM
  participant Noise as Bruits Perlin
  participant Chunk as Tableau BlockId

  TS->>WASM: generate_chunk(chunk_x, chunk_z, SEED)
  WASM->>Noise: echantillonne terrain, biome, minerais, decorations
  Noise-->>WASM: valeurs procedurales
  WASM->>Chunk: remplit 16 x 96 x 16 blocs
  Chunk-->>TS: Uint8Array
```

## Dimensions

Les chunks font actuellement `16 x 96 x 16`. Les dimensions sont exposées à TypeScript via `chunk_size_x()`, `chunk_size_y()` et `chunk_size_z()`.

## Bruits utilisés

La génération utilise plusieurs bruits de Perlin dérivés du seed : terrain, détails, reliefs internes, biomes, minerais et décorations.

```mermaid
flowchart TD
  Seed[SEED]
  Terrain[Bruit terrain]
  Details[Bruit details]
  Biome[Bruit temperature / humidite]
  Ores[Bruit minerais]
  Decor[Bruit decorations]
  Height[Hauteur finale]
  Blocks[Choix des BlockId]

  Seed --> Terrain --> Height
  Seed --> Details --> Height
  Seed --> Biome --> Blocks
  Seed --> Ores --> Blocks
  Seed --> Decor --> Blocks
  Height --> Blocks
```

## Biomes

Trois biomes existent actuellement : plaines, désert et snowy. Le choix dépend de valeurs de température et d'humidité.

```mermaid
flowchart LR
  Temp[Temperature]
  Humidity[Humidite]
  Choice{Selection biome}
  Plains[Plaines]
  Desert[Desert]
  Snowy[Snowy]

  Temp --> Choice
  Humidity --> Choice
  Choice --> Plains
  Choice --> Desert
  Choice --> Snowy
```

## Terrain

La hauteur combine continents, collines, détails et modificateurs de biome. Le niveau de la mer est fixé à `42`.

## Couches

- Au-dessus de la surface : air, eau ou glace.
- Surface : herbe, sable ou neige selon le biome.
- Sous-surface : terre, sandstone ou variantes sous-marines.
- Profondeur : pierre, deepslate et minerais.

```mermaid
flowchart TD
  Y[Y courant]
  Sea[Niveau mer 42]
  Surface[Hauteur surface]
  Above{Y > surface}
  AtSurface{Y = surface}
  NearSurface{Sous-surface}
  Deep{Profondeur}
  AirWaterIce[Air / eau / glace]
  Top[Herbe / sable / neige]
  Dirt[Terre / sandstone / argile]
  Stone[Pierre / deepslate / minerais]

  Y --> Above
  Surface --> Above
  Sea --> AirWaterIce
  Above --> AirWaterIce
  Above --> AtSurface
  AtSurface --> Top
  AtSurface --> NearSurface
  NearSurface --> Dirt
  NearSurface --> Deep
  Deep --> Stone
```

## Décorations

Les plaines peuvent générer hautes herbes, pissenlits et coquelicots. Le désert peut générer cactus et buissons morts. Les biomes enneigés peuvent générer des blocs de neige.

## Arbres

Les arbres sont générés en deuxième passe pour gérer le feuillage qui déborde entre chunks. Les arbres naturels actuels utilisent des troncs et feuilles de chêne.

```mermaid
flowchart LR
  Base[Chunk terrain de base]
  Pass2[Deuxieme passe arbres]
  Trunks[Placement troncs]
  Leaves[Placement feuilles]
  Overflow[Debordement possible vers chunks voisins]

  Base --> Pass2 --> Trunks --> Leaves --> Overflow
```

## Synchronisation

`BlockId` doit rester aligné entre Rust et TypeScript. Toute nouvelle valeur doit être ajoutée des deux côtés si elle est générée par le monde.

---

[⬅️ Précédent](./runtime-flow.md) | [Sommaire](./README.md)
