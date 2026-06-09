# Rendu, meshes, atlas et effets visuels

## Vue d'ensemble

Le rendu est assuré par Babylon.js. La génération Rust fournit uniquement des identifiants de blocs, puis TypeScript transforme ces données en géométrie affichable.

Le pipeline de rendu principal est :

```txt
Uint8Array de BlockId
  -> createChunkMesh(...)
  -> buffers positions/normals/indices/colors/uvs
  -> VertexData Babylon
  -> Mesh de chunk
  -> StandardMaterial avec atlas procédural
```

## Création des chunks visibles

La fonction principale est :

```ts
createChunkMesh(params: CreateChunkMeshParams): Mesh
```

Elle parcourt tous les blocs du chunk :

```txt
for y
  for z
    for x
      lire block
      si Air => ignorer
      sinon => générer la géométrie utile
```

## Séparation solide / eau

`createChunkMesh(...)` utilise deux jeux de buffers :

- `solid` pour les blocs classiques ;
- `water` pour la surface de l'eau.

L'eau est ajoutée dans un mesh enfant du chunk principal.

## Face culling manuel

Pour les blocs classiques, une face est ajoutée uniquement si le voisin est transparent pour le meshing.

Cela évite de générer les faces internes invisibles entre deux blocs pleins.

Principe :

```txt
pour chaque face du bloc
  lire le voisin dans la direction de la normale
  si le voisin est transparent
    ajouter la face
```

Cette optimisation est essentielle pour limiter le nombre de triangles.

## Définition des faces

Les faces unitaires sont définies dans `src/constants.ts` via `FACES`.

Chaque face contient :

- une normale ;
- quatre vertices.

Ces faces sont réutilisées pour :

- les chunks ;
- les drops cubiques ;
- l'overlay de destruction.

## Buffers de mesh

Les buffers utilisés sont :

```ts
type MeshBuffers = {
  positions: number[];
  indices: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
};
```

Une fois remplis, ils sont convertis en `VertexData` Babylon :

```ts
const vertexData = new VertexData();
vertexData.positions = buffers.positions;
vertexData.indices = buffers.indices;
vertexData.normals = buffers.normals;
vertexData.colors = buffers.colors;
vertexData.uvs = buffers.uvs;
vertexData.applyToMesh(mesh);
```

## Atlas procédural

Les textures de blocs sont définies sous forme de matrices de couleurs 16x16.

`block-atlas.ts` construit un atlas utilisé par le matériau commun des blocs.

Chaque face demande ses UV via :

```ts
getBlockFaceTextureUv(block, faceName)
```

Si aucune texture n'est disponible, le rendu utilise un fallback.

## Couleurs de vertex

Les faces stockent aussi une couleur de vertex :

```ts
const color = getBlockFaceColor(block, face.normal);
```

Cela permet de conserver une couleur fallback et potentiellement des variations de teinte selon les faces.

## Rendu de l'eau

L'eau est traitée différemment des blocs solides.

Le code ne génère actuellement que la surface supérieure visible lorsque le bloc au-dessus est `Air`.

La hauteur visuelle est récupérée via :

```ts
getBlockDefinition(block)?.visualHeight ?? 1
```

Cela permet de rendre l'eau légèrement plus basse qu'un bloc complet.

## Effets d'eau

`water-effects.ts` ajoute une logique d'effet autour de l'eau.

Le runtime appelle :

```ts
waterEffect.update(deltaTime);
waterEffect.tryTriggerSplash(...);
```

Le système peut donc :

- animer un effet dans le temps ;
- détecter l'entrée du joueur dans l'eau ;
- déclencher un effet de plouf.

## Drops

Les drops cubiques utilisent la même logique de faces que les blocs, mais à une échelle réduite.

La taille est contrôlée par :

```ts
const DROP_SIZE = 0.3;
```

Chaque drop :

- reçoit les textures du bloc correspondant ;
- tombe avec une vélocité initiale ;
- tourne sur l'axe Y ;
- rebondit légèrement au sol ;
- est ramassable après un délai.

## Drops non cubiques

Certains drops peuvent utiliser un modèle 3D. C'est le cas des poppies.

Dans `dropBlock(...)` :

- si `blockId === BlockId.Poppy`, un modèle 3D est attaché au root du drop ;
- sinon, un petit cube texturé est généré.

## Modèles 3D

Les modèles 3D sont chargés avec Babylon.js Loaders.

Le code prévoit un système spécialisé pour les poppies, mais l'architecture peut évoluer vers un chargeur générique pour d'autres modèles.

## Overlay de destruction

La destruction progressive est gérée dans `block-breaking.ts`.

Quand le joueur commence à casser un bloc, le système crée :

- un mesh d'overlay autour du bloc ciblé ;
- un `ShaderMaterial` ;
- une texture dynamique contenant les étapes de fissures.

## Sprite de fissures

Les fissures sont représentées par 4 stages.

Le code génère une `DynamicTexture` horizontale :

```txt
[stage 0][stage 1][stage 2][stage 3]
```

Chaque stage est construit à partir de `BREAKING_SPRITE_MASKS`.

## Shader de destruction

Le shader lit :

- `progress` ;
- `stage` ;
- `breakingSprite`.

Le fragment shader sélectionne la bonne portion de sprite :

```glsl
vec2 spriteUV = vec2((vUV.x + stage) / tileCount, vUV.y);
```

Puis applique un alpha progressif.

## Durées de destruction

Les durées spécifiques sont définies dans :

```ts
export const BLOCK_BREAKING_TIMES_MS: Partial<Record<BlockId, number>> = {
  [BlockId.Dirt]: 1000,
  [BlockId.GrassBlock]: 1000,
  [BlockId.Sand]: 500,
  [BlockId.Stone]: 3000,
};
```

Si un bloc n'a pas de durée définie, il est détruit immédiatement.

## Label de bloc pointé

`pointed-block-label.ts` affiche le nom du bloc ciblé.

Le système utilise le raycast courant :

- centre écran en desktop/mobile ;
- rayons de contrôleurs en VR.

Le label affiche les noms anglais/français définis dans les blocs.

## Pointeur central

Le pointeur central est initialisé par `initializeCrosshair(scene)`.

Il est visible hors VR, puis masqué lorsque WebXR est actif :

```ts
crosshairUi.rootContainer.isVisible = !isWebXRActive;
```

## Inventaire et UI Babylon

Les interfaces ne sont pas construites en HTML/CSS, mais avec Babylon GUI :

- inventaire ;
- inventaire VR ;
- craft ;
- contrôles mobiles ;
- labels.

Cela permet de rester dans le contexte Babylon et de gérer plus facilement les interactions en VR ou en canvas plein écran.

## Performance

Les optimisations actuelles :

- face culling manuel ;
- atlas partagé ;
- matériau commun pour les blocs ;
- génération de chunks à la demande ;
- reconstruction seulement des chunks concernés après modification.

Limites actuelles :

- les chunks lointains ne sont pas supprimés ;
- la reconstruction complète d'un chunk peut coûter cher ;
- la génération des chunks manquants est déclenchée dans la boucle principale ;
- les drops sont mis à jour individuellement à chaque frame.

## Ajouter un effet visuel

Pour ajouter un effet visuel :

1. créer un module dédié ;
2. initialiser les ressources une seule fois ;
3. exposer une méthode `update(deltaTime)` si l'effet est animé ;
4. appeler cette méthode depuis `main.ts` ;
5. éviter de recréer textures, shaders ou matériaux à chaque frame.

## Ajouter une texture de bloc

Pour ajouter ou modifier une texture :

1. éditer la définition dans `src/blocks/` ;
2. définir la palette RGBA ;
3. écrire une matrice 16x16 ;
4. assigner la texture aux bonnes faces ;
5. vérifier le rendu dans le monde ;
6. vérifier le rendu dans l'inventaire ;
7. vérifier le rendu des drops.

## Points d'attention

- Ne pas générer les faces internes inutiles.
- Ne pas recréer l'atlas à chaque frame.
- Maintenir la cohérence des UV par face.
- Penser aux chunks voisins lors d'une modification en bordure.
- Les blocs transparents ou partiellement hauts doivent être testés avec les blocs voisins.
