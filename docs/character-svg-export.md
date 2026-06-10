# Export SVG en Perspective des Personnages

## Vue d'ensemble

Le système d'export SVG permet de générer des rendus 2D en perspective d'un personnage 3D (Steve, Alex) avec support complet des:
- **Textures matrices** (couleurs générées depuis les matrices de couleurs)
- **Poses dynamiques** (rotation/position des parties du corps avant export)
- **Perspective 3D** (yaw, pitch, distance de caméra configurables)
- **Anti-coutures** (recouvrement cellulaire pour éviter les rebords visibles)

## Architecture

### Module principal : `src/character-builder/svg-export.ts`

Exports publiques:
- `generateCharacterPerspectiveSvg(mesh, options)` - Rendu SVG depuis un mesh existant
- `buildCharacterPerspectiveSvg(scene, model, position, buildOptions, svgOptions)` - Construit et rend en SVG

Helpers spécialisés:
- `src/characters/steve.ts` : `createSteveSvg(...)`
- `src/characters/alex.ts` : `createAlexSvg(...)`

## Types et Options

### `CharacterSvgRenderOptions`

Paramètres de rendu SVG complets:

```ts
{
  // Dimensions et disposition
  width?: number;              // Défaut: 512
  height?: number;             // Défaut: 512
  padding?: number;            // Marge intérieure (px). Défaut: 20
  
  // Caméra de perspective
  fov?: number;                // Angle d'ouverture (0-π). Défaut: 0.9
  yaw?: number;                // Rotation horizontale (rad). Défaut: -π/4
  pitch?: number;              // Rotation verticale (rad). Défaut: 0.35
  distanceFactor?: number;     // Éloignement relatif. Défaut: 2.6
  
  // Rendu visuel
  background?: string | null;  // Couleur de fond (CSS). Défaut: "#f8fafc"
  stroke?: string;             // Couleur des traits. Défaut: "none"
  strokeWidth?: number;        // Épaisseur traits (px). Défaut: 0
  cellOverlap?: number;        // Recouvrement anti-couture (px). Défaut: 0.6
  
  // Occlusion (performance/qualité)
  occlusion?: boolean;         // Filtre raycast face->caméra. Défaut: false
  
  // Pose du personnage
  pose?: CharacterPoseOptions;
}
```

### `CharacterPoseOptions`

Paramètres de pose avant export:

```ts
{
  // Parties du corps avec rotation/position
  parts?: {
    [partName: string]: {
      rotation?: { x?: number; y?: number; z?: number };
      position?: { x?: number; y?: number; z?: number };
    };
  };
  
  // Raccourci pour rotation de tête
  headYaw?: number;            // Rotation sur Y (rad)
  headPartName?: string;       // Nom de la partie "tête". Défaut: "head"
}
```

### Noms de parties reconnus (pour Steve/Alex)

Bras/jambes:
- `rightArm` → bras droit
- `leftArm` → bras gauche
- `rightLeg` → jambe droite
- `leftLeg` → jambe gauche

Tête:
- `head` → tête (complète)

Corps:
- `torso` ou `body` → torse

> **Note**: Les noms de parties sont inversés côté pose (rightArm = leftArm réel) pour correspondre à l'intuition utilisateur.

## Exemples d'utilisation

### Rendu basique (pose neutre)

```ts
import { createSteveSvg } from "~/characters";

const svg = createSteveSvg(
  scene,
  new Vector3(0, 0, 0),
  { physics: false },
  {
    width: 512,
    height: 512,
  },
);

// Sauvegarder le SVG
const blob = new Blob([svg], { type: "image/svg+xml" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "steve.svg";
a.click();
```

### Rendu avec pose personnalisée (bras levé)

```ts
const svg = createSteveSvg(scene, pos, { physics: false }, {
  width: 640,
  height: 640,
  pose: {
    parts: {
      rightArm: {
        rotation: { x: -1.2 },  // Lever le bras
      },
      leftLeg: {
        rotation: { x: 0.5 },   // Avancer la jambe
      },
    },
  },
});
```

### Rendu avec perspective personnalisée

```ts
const svg = createAlexSvg(scene, pos, undefined, {
  width: 512,
  height: 512,
  yaw: -Math.PI / 3,       // Vue de gauche
  pitch: 0.5,              // Légèrement de haut
  distanceFactor: 3.0,     // Plus éloigné
  cellOverlap: 0.8,        // Anti-couture renforcé
  background: "#ffffff",   // Fond blanc
});
```

### Rendu avec occlusion (masque l'intérieur)

```ts
const svg = buildCharacterPerspectiveSvg(
  scene,
  steveModel,
  new Vector3(0, 0, 0),
  { physics: false },
  {
    occlusion: true,  // Active le filtrage raycast
  },
);
```

## Pipeline technique

### 1. Construction du personnage (si appelé via `buildCharacterPerspectiveSvg`)

```
buildCharacter() 
  → crée mesh racine + parties du corps (cuboïdes)
  → applique textures matrices (DynamicTexture)
  → ajoute SubMeshes (1 par face = 6 faces par cuboïde)
```

### 2. Application de la pose (si `pose` fournie)

```
applyPoseForSvg()
  → snapshot position/rotation initiales
  → cherche parties du corps dans bodyParts
  → applique rotation/position depuis CharacterPoseOptions
  → recompute world matrices
```

### 3. Extraction des faces 3D

```
for each sourceMesh:
  → récupère positions + UVs + indices
  → transforme en monde (worldMatrix)
  → regroupe par SubMesh (faces)
  → résout coins face (bilinéaire UV)
```

### 4. Culling et occlusion

```
for each face:
  → calcule normale (cross product)
  → oriente vers extérieur (ref: mesh center)
  
  if dot(normal, toCamera) <= 0:
    → culling dos-caméra ✓
  
  if occlusion && !raycast(camera → faceCenter):
    → face cachée par autre mesh → skip
```

### 5. Projection perspective

```
for each cellule de texture:
  → interpole position 3D (bilinéaire sur face)
  → projette en NDC (viewProjection matrix)
  → mappe en écran (viewport)
  
  → sample couleur texture (DynamicTexture)
  → applique éclairage (diffuse + ambient)
  
  → ajoute polygon 2D (avec recouvrement cellOverlap)
```

### 6. Tri et rendu SVG

```
sort(polygons, by: depth DESC)  // Painter algorithm
  → render SVG polygons
  → apply background
```

## Métadonnées texture

Les DynamicTextures créées par `createTextureFromMatrix()` incluent metadata:

```ts
texture.metadata = {
  matrixWidth: number,   // Dimensions grille (nombre de cellules)
  matrixHeight: number;
  pixelScale: number;    // Pixels par texel (généralement 16)
}
```

Cela permet au rendu SVG de connaître le mapping texture→grille automatiquement.

## Performance et limitations

### Performance

- **Cellules projetées**: `gridWidth × gridHeight` polygons par face
- **Meshes typiques**: 6 faces (cuboïdes) → ~100-400 cellules total
- **SVG généré**: 1-5 KB pour une pose neutre, 2-10 KB avec poses complexes

### Limitations

1. **Pas d'ombres dynamiques** : Éclairage simple (diffuse + ambient)
2. **Pas d'anti-aliasing interne** : `shape-rendering="crispEdges"` pour pixel-perfect
3. **Occlusion raycast basique** : Peut rater les coins (résolution caméra)
4. **Pas de transparence alpha** : Textures opaques uniquement

## Intégration avec le reste du système

### Physique des personnages (avatar-physics.ts)

L'export SVG est **indépendant** du contrôleur physique:
- Le mesh est créé `physics: false` par défaut
- La pose ne touche pas aux pivots (conserve structures animation)
- Les poses sont restaurées après export (pas d'effet de bord)

### Collision rayon-personnage (character-builder.ts)

Fonction `getCharacterHitDistance(scene, ray, maxDistance)`:
- Utilisée dans `pointed-block-label.ts`, `block-breaking.ts`, `textured-world.ts`
- Bloque la sélection/cassage de bloc si rayon intersecte personnage
- **Indépendant** du rendu SVG

## Debugging et extension

### Options futures possibles

```ts
// Mode debug (afficher grille UV en overlay)
debugUvGrid?: boolean;

// Preset poses prêtes à l'emploi
preset?: "idle" | "walk" | "wave" | "sleep";

// Ombrage custom
shadowIntensity?: number;
lightDirection?: Vector3;

// Sampling texture avancé (texture.metadata.sampleMode)
textureSampling?: "nearest" | "bilinear";
```

## Résumé des fichiers modifiés

| Fichier | Rôle |
|---------|------|
| `src/character-builder/svg-export.ts` | Core: rendu SVG + pose |
| `src/character-builder/texture-builder.ts` | Métadonnées texture matrix |
| `src/character-builder/character-builder.ts` | Hit-test rayon personnage |
| `src/characters/steve.ts` | Helper `createSteveSvg()` |
| `src/characters/alex.ts` | Helper `createAlexSvg()` |
| `src/pointed-block-label.ts` | Utilise occlusion personnage |
| `src/block-breaking.ts` | Utilise occlusion personnage |
| `src/textured-world.ts` | Utilise occlusion personnage |

## Voir aussi

- [Character System](./character-system.md) - Structure générales Steve/Alex
- [Avatar Physics](./README.md) - Gravité/collisions personnages

---

[⬅️ Précédent](./character-system.md) | [Sommaire](./README.md) | [Suivant ➡️](./pwa-assets.md)
