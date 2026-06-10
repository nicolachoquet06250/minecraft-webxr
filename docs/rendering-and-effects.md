[⬅️ Précédent](./blocks-items-crafting.md) | [Sommaire](./README.md) | [Suivant ➡️](./avatar-physics.md)

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

## Personnages 3D

Le jeu utilise un système de personnages cubiques avec textures procédurales. Les personnages sont construits à partir de parties du corps (tête, torse, bras, jambes) assemblées en mesh unique.

```mermaid
flowchart LR
  Template[Template de corps]
  Parts[Parties du corps]
  Textures[Textures procédurales]
  Mesh[Mesh personnage]
  Animator[Animations]
  Scene[Scene]
  
  Template --> Parts
  Textures --> Parts
  Parts --> Mesh
  Mesh --> Animator
  Mesh --> Scene
```

### Construction des personnages

Les personnages sont construits à partir de cuboïdes texturés :

```txt
Matrices de couleurs 16x16
  + Palette RGBA
  -> Textures dynamiques
  -> Cuboïdes pour chaque partie
  -> Assemblage en mesh unique
```

### Types de personnages

- **Steve** : Modèle masculin avec bras larges (4×12×4 px)
- **Alex** : Modèle féminin avec bras fins (3×12×4 px)
- **Custom** : Modèle personnalisé avec proportions définies

### Animations des personnages

Les animations sont réalisées avec Babylon.js Animation Groups :

- **idle** : Position debout neutre
- **walk** : Marche avec balancement des bras
- **mine** : Animation de minage
- **jump** : Saut

Les animations sont identiques pour tous les types de corps. Seules les dimensions des parties changent.

---

[⬅️ Précédent](./blocks-items-crafting.md) | [Sommaire](./README.md) | [Suivant ➡️](./gameplay-interactions.md)
