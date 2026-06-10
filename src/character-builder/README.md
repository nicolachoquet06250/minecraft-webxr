# Système de Construction de Personnages

## Vue d'ensemble

Ce système générique permet de créer des personnages cubiques de style Minecraft avec des textures définies par des matrices de couleurs. Le système gère **deux types de corps** : masculin (bras larges) et féminin (bras fins), inspirés de Steve et Alex.

## Architecture

### Modules principaux

1. **types.ts** - Définit toutes les interfaces TypeScript
2. **texture-builder.ts** - Crée des textures dynamiques à partir de matrices de couleurs
3. **mesh-builder.ts** - Construit des cuboïdes avec des textures sur 6 faces
4. **character-builder.ts** - Assemble les parties du corps en un personnage complet
5. **animator.ts** - Gère les animations du personnage
6. **body-templates.ts** - Templates pour corps masculins et féminins
7. **character-factory.ts** - Helpers pour créer des personnages personnalisés

## Types de Corps

### Masculin (Type Steve)
- **Bras larges** : 4x12x4 unités (0.25 x 0.75 x 0.25)
- Proportions standard
- Position des bras : ±0.375 du centre

### Féminin (Type Alex)
- **Bras fins** : 3x12x4 unités (0.1875 x 0.75 x 0.25)
- Bras plus rapprochés du torse
- Position des bras : ±0.34375 du centre

### Custom
- Permet de définir des proportions entièrement personnalisées
- Nécessite de définir toutes les parties manuellement

## Utilisation

### 1. Utiliser Steve ou Alex

```typescript
import { createSteve, createAlex } from "./characters";
import { Vector3 } from "@babylonjs/core";

// Créer Steve (masculin)
const { mesh: steveMesh, animator: steveAnimator } = createSteve(
  scene,
  new Vector3(0, 0, 0)
);
steveAnimator.play("walk");

// Créer Alex (féminin)
const { mesh: alexMesh, animator: alexAnimator } = createAlex(
  scene,
  new Vector3(2, 0, 0)
);
alexAnimator.play("idle");
```

### 2. Créer un personnage personnalisé (méthode simple)

```typescript
import { createMasculineCharacter, createFeminineCharacter } from "./character-builder";

// Personnage masculin personnalisé
const monPersonnageMasculin = createMasculineCharacter(
  "guerrier",
  maPalette,
  mesTextures
);

// Personnage féminin personnalisé
const monPersonnageFeminin = createFeminineCharacter(
  "mage",
  maPalette,
  mesTextures
);
```

```typescript
import type { CharacterAnimations } from "./character-builder";

const animations: CharacterAnimations = {
  walk: {
    name: "walk",
    fps: 30,
    duration: 0.6,
    loop: true,
    animations: [
      {
        name: "rightArmSwing",
        targetPart: "rightArm",
        property: "rotation.x",
        keyframes: [
          { frame: 0, value: -0.5 },
          { frame: 9, value: 0.5 },
          { frame: 18, value: -0.5 },
        ],
      },
      // ... autres animations
    ],
  },
};
```

### 4. Utiliser l'animator

```typescript
import { CharacterAnimator } from "./character-builder/animator";

const animator = new CharacterAnimator(characterMesh, scene);
animator.loadAnimations(animations);
animator.play("walk");

// Contrôle direct des parties du corps (multi-joueurs / avatars)
animator.setPartRotation("rightArm", { x: -0.4 });
animator.setPartPosition("torso", { y: 1.02 });

// Liaison caméra -> tête (yaw uniquement)
animator.setHeadYaw(camera.rotation.y);

// Construire avec physique activée (par défaut)
const withPhysics = buildCharacter(scene, model, new Vector3(0, 10, 0));

// Construire sans physique locale (avatar piloté en externe / serveur)
const externalAvatar = buildCharacter(scene, model, new Vector3(0, 10, 0), {
  physics: { externalControl: true },
});
```

## Exemple complet : Steve et Alex

Steve et Alex ont été créés avec ce système :

### Steve (Masculin)
- `src/characters/steve-model.ts` - Définition du modèle masculin
- `src/characters/steve-animations.ts` - Définition des animations
- `src/characters/steve.ts` - Fonction helper

### Alex (Féminin)
- `src/characters/alex-textures.ts` - Palette et textures spécifiques
- `src/characters/alex-model.ts` - Définition du modèle féminin
- `src/characters/alex-animations.ts` - Définition des animations
- `src/characters/alex.ts` - Fonction helper

```typescript
import { createSteve, createAlex } from "./characters";
import { Vector3 } from "@babylonjs/core";

// Steve
const { mesh: steve, animator: steveAnim } = createSteve(scene, new Vector3(0, 0, 0));
steveAnim.play("walk");

// Alex
const { mesh: alex, animator: alexAnim } = createAlex(scene, new Vector3(2, 0, 0));
alexAnim.play("walk");
```

## Concepts clés

### Palette de couleurs

Les palettes définissent les couleurs utilisées dans les matrices de texture :

```typescript
const palette = {
  A: [0.12, 0.07, 0.03, 1], // RGBA normalisé (0-1)
  B: [0.19, 0.10, 0.04, 1],
  // ...
};
```

### Matrices de texture

Les matrices sont des tableaux de chaînes où chaque caractère correspond à une couleur :

```typescript
matrix: [
  "AAAABBBB",
  "AAABBBBC",
  // ...
]
```

### Pivots

Les pivots définissent le point de rotation d'une partie du corps. Par exemple, un bras a son pivot à l'épaule :

```typescript
pivot: { x: 0, y: 0.375, z: 0 }
```

### Hiérarchie

Les parties du corps peuvent avoir un parent. Par défaut, toutes sont attachées au mesh racine.

## Avantages du système

1. **Réutilisabilité** - Le même code peut créer différents personnages
2. **Déclaratif** - Les personnages sont définis par des données, pas du code
3. **Support multi-genres** - Templates pour masculin et féminin
4. **Extensible** - Facile d'ajouter de nouvelles parties ou animations
5. **Type-safe** - TypeScript assure la cohérence des données
6. **Maintenable** - Séparation claire entre modèle, textures et animations

## Créer un nouveau personnage

### Personnage basé sur un type existant

Pour créer une variante de Steve ou Alex :

1. Créer une nouvelle palette de couleurs
2. Définir les matrices de texture pour chaque partie
3. Utiliser `createMasculineCharacter()` ou `createFeminineCharacter()`
4. Réutiliser les animations existantes ou en créer de nouvelles

Exemple :

```typescript
// mon-guerrier.ts
import { createMasculineCharacter, buildCharacter, CharacterAnimator } from "../character-builder";
import { steveAnimations } from "./steve-animations"; // Réutilisation

const guerrierPalette = {
  A: [0.5, 0.0, 0.0, 1], // Rouge
  B: [0.8, 0.2, 0.0, 1], // Orange
  // ...
};

const guerrierTextures = {
  head: { front: ..., back: ..., /* etc */ },
  torso: { /* ... */ },
  rightArm: { /* ... */ },
  leftArm: { /* ... */ },
  rightLeg: { /* ... */ },
  leftLeg: { /* ... */ },
};

const guerrierModel = createMasculineCharacter(
  "guerrier",
  guerrierPalette,
  guerrierTextures
);

export function createGuerrier(scene, position) {
  const mesh = buildCharacter(scene, guerrierModel, position);
  const animator = new CharacterAnimator(mesh, scene);
  animator.loadAnimations(steveAnimations); // Réutilise les animations de Steve
  return { mesh, animator };
}
```

### Personnage avec proportions personnalisées

Pour des proportions uniques :

1. Définir manuellement toutes les parties du corps
2. Utiliser `bodyType: "custom"`
3. Spécifier dimensions, positions et pivots

```typescript
const monPersonnageUnique: CharacterModel = {
  name: "unique",
  bodyType: "custom",
  bodyParts: [
    {
      name: "head",
      dimensions: { width: 0.6, height: 0.6, depth: 0.6 }, // Grosse tête !
      position: { x: 0, y: 1.7, z: 0 },
      textures: { /* ... */ },
    },
    // ... définir toutes les autres parties
  ],
};
```

## Physique des Personnages

Le système supporte une physique intégrée pour les personnages avec :
- **Gravité** : Application continue de l'accélération gravitationnelle
- **Collision** : Détection de collision avec le terrain et les blocs
- **Contrôle externe** : Toggle pour activer/désactiver la simulation locale

### Utilisation

```typescript
import { createSteve } from "./characters";

// Créer Steve avec physique intégrée
const { mesh, animator, physics } = createSteve(
  scene,
  new Vector3(0, 0, 0),
  { physics: true }  // Active la physique
);

// Dans la boucle de jeu
scene.onAfterRenderObservable.add(() => {
  if (physics) {
    physics.update({
      worldChunks,
      sizeX: WORLD_SIZE_X,
      sizeY: WORLD_SIZE_Y,
      sizeZ: WORLD_SIZE_Z,
      deltaTime: engine.getDeltaTime() / 1000,
    });
  }
});
```

### API

```typescript
interface CharacterPhysicsController {
  // Appliquer gravité et collisions
  update(options: {
    worldChunks: Map<string, Chunk>;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    deltaTime: number;
  }): void;

  // Basculer simulation locale/distante
  setExternalControl(enabled: boolean): void;

  // Positionner directement (mode distant)
  teleport(position: Vector3): void;
  setVelocity(velocity: Vector3): void;

  // Obtenir état
  isGrounded(): boolean;
}
```

### Configuration

```typescript
{
  // Par défaut la physique est active
  physics?: false | {
    externalControl?: boolean;  // défaut: false
    gravityEnabled?: boolean;   // défaut: true
    collisionsEnabled?: boolean; // défaut: true
    collisionRadius?: number;
    collisionHeight?: number;
  }
}
```

### Comportement par défaut et mode serveur

- Sans option, la physique est active (`physics` non fourni).
- Pour désactiver totalement la simulation locale: `physics: false`.
- Pour un pilotage réseau/serveur, utiliser `physics: { externalControl: true }`, puis pousser la pose depuis l'extérieur (`teleport`, `setVelocity`).

### Désactiver la physique

```typescript
// Créer sans physique
const { mesh, animator } = createSteve(scene, pos, { physics: false });

// Ou personnaliser complètement
const steve = buildCharacter(scene, steveModel, pos, {
  physics: false,
});

// Pilotage serveur (pas de gravité/collision locale)
const remoteSteve = buildCharacter(scene, steveModel, pos, {
  physics: { externalControl: true },
});
```

## Export SVG en Perspective

Le système peut exporter les personnages sous forme d'images SVG 2D avec support complet des poses et perspectives 3D.

### Utilisation basique

```typescript
import { createSteveSvg } from "./characters";

// Générer un SVG simple
const svg = createSteveSvg(
  scene,
  new Vector3(0, 0, 0),
  { physics: false },
  {
    width: 512,
    height: 512,
  }
);

// Sauvegarder le SVG
const blob = new Blob([svg], { type: "image/svg+xml" });
const url = URL.createObjectURL(blob);
downloadFile(url, "steve.svg");
```

### Avec poses personnalisées

```typescript
const svg = createSteveSvg(scene, pos, {}, {
  width: 512,
  height: 512,
  pose: {
    parts: {
      rightArm: { rotation: { x: -1.2 } },  // Lever
      leftLeg: { rotation: { x: 0.5 } },    // Avancer
    },
  },
});
```

### Options avancées

```typescript
interface CharacterSvgRenderOptions {
  // Dimensions
  width?: number;           // 512 par défaut
  height?: number;          // 512 par défaut
  padding?: number;         // 20 par défaut

  // Caméra
  fov?: number;             // 0.9 par défaut (angle d'ouverture)
  yaw?: number;             // -π/4 par défaut (rotation H)
  pitch?: number;           // 0.35 par défaut (rotation V)
  distanceFactor?: number;  // 2.6 par défaut (éloignement)

  // Rendu
  background?: string;      // "#f8fafc" par défaut
  stroke?: string;          // "none" par défaut
  strokeWidth?: number;     // 0 par défaut
  cellOverlap?: number;     // 0.6 par défaut (anti-couture)

  // Performance
  occlusion?: boolean;      // false par défaut (raycast)

  // Animation
  pose?: CharacterPoseOptions;
}
```

### Parties du corps manipulables

```typescript
pose: {
  parts: {
    "rightArm": { rotation: {...}, position: {...} },
    "leftArm": { rotation: {...}, position: {...} },
    "rightLeg": { rotation: {...}, position: {...} },
    "leftLeg": { rotation: {...}, position: {...} },
    "head": { rotation: {...}, position: {...} },
    "torso": { rotation: {...}, position: {...} },
  },
  headYaw?: number;  // Raccourci pour tête
}
```

### Notes techniques

- Les poses sont **restaurées automatiquement** après export (pas d'effet de bord)
- Le rendu utilise la **perspective 3D réaliste** avec matrices de projection
- Les textures sont **échantillonnées en temps réel** depuis les DynamicTextures
- Les **pivots des mailles restent inchangés** (poses non-destructives)

Pour la documentation complète, voir [character-svg-export.md](../../docs/character-svg-export.md).
