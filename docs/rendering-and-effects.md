[⬅️ Précédent](./pwa-assets.md) | [Sommaire](./README.md) | [Suivant ➡️](./runtime-flow.md)

---

# Rendu, meshes, atlas et effets visuels

Le rendu est assuré par Babylon.js. Rust fournit les identifiants de blocs, puis TypeScript transforme ces données en géométrie affichable.

## Pipeline principal

```txt
Uint8Array de BlockId
  -> createChunkMesh(...)
  -> buffers positions/normals/indices/colors/uvs
  -> VertexData Babylon
  -> Mesh de chunk
```

```mermaid
flowchart LR
  Blocks[Uint8Array BlockId]
  Visibility[Calcul faces visibles]
  Buffers[Buffers\npositions normals indices uvs colors]
  VertexData[VertexData Babylon]
  Mesh[Mesh de chunk]
  Scene[Scene Babylon]

  Blocks --> Visibility --> Buffers --> VertexData --> Mesh --> Scene
```

## Chunks visibles

`createChunkMesh(...)` parcourt les blocs d'un chunk et génère uniquement la géométrie utile. Les faces internes entre blocs opaques ne sont pas créées.

```mermaid
flowchart TD
  Block[Bloc courant]
  Face[Face testee]
  Neighbor{Voisin opaque ?}
  Skip[Ignorer face]
  Add[Ajouter face aux buffers]

  Block --> Face --> Neighbor
  Neighbor -->|oui| Skip
  Neighbor -->|non| Add
```

## Textures

Les textures de blocs sont décrites dans les définitions TypeScript sous forme de matrices 16x16 avec palette de couleurs. Elles alimentent l'atlas utilisé par les meshes.

```mermaid
flowchart LR
  Matrix[Matrice 16x16]
  Palette[Palette RGBA]
  Texture[Texture procedurale]
  Atlas[Atlas de textures]
  UV[Coordonnees UV]
  Mesh[Mesh de chunk]

  Matrix --> Texture
  Palette --> Texture
  Texture --> Atlas --> UV --> Mesh
```

## Eau, drops et UI

L'eau est rendue avec une hauteur visuelle spécifique. Les drops réutilisent les textures des blocs. Les interfaces sont en Babylon GUI.

```mermaid
flowchart TD
  World[Monde]
  Water[Eau\nvisualHeight]
  Drops[Drops 3D]
  UI[Babylon GUI]
  Scene[Scene]

  World --> Water --> Scene
  World --> Drops --> Scene
  UI --> Scene
```

---

[⬅️ Précédent](./pwa-assets.md) | [Sommaire](./README.md) | [Suivant ➡️](./runtime-flow.md)
