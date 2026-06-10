# 🎮 Système de Construction de Personnages - Support Masculin/Féminin

## ✨ Ce qui a été créé

### Architecture complète

```
src/
├── character-builder/              # Système générique
│   ├── types.ts                   # Types avec BodyType (masculine/feminine/custom)
│   ├── texture-builder.ts         # Création de textures
│   ├── mesh-builder.ts            # Construction de cuboïdes
│   ├── character-builder.ts       # Assemblage de personnages
│   ├── animator.ts                # Gestion des animations
│   ├── body-templates.ts          # 🆕 Templates masculin/féminin
│   ├── character-factory.ts       # 🆕 Helpers de création
│   ├── index.ts                   # Exports
│   ├── README.md                  # Documentation complète
│   └── BODY_TYPES.md             # 🆕 Détails sur les types
│
└── characters/                     # Personnages spécifiques
    ├── steve.ts                   # Helper Steve
    ├── steve-model.ts             # Modèle masculin (mis à jour)
    ├── steve-animations.ts        # Animations Steve
    ├── alex.ts                    # 🆕 Helper Alex
    ├── alex-model.ts              # 🆕 Modèle féminin
    ├── alex-animations.ts         # 🆕 Animations Alex
    ├── alex-textures.ts           # 🆕 Palette et textures Alex
    ├── examples.ts                # 🆕 5 exemples d'utilisation
    └── index.ts                   # Exports (mis à jour)

GENDER_SUPPORT.md                   # 🆕 Ce fichier récapitulatif
```

## 🎯 Fonctionnalités ajoutées

### 1. Types de corps (BodyType)

```typescript
type BodyType = "masculine" | "feminine" | "custom";
```

- **masculine** : Bras larges (4×12×4 px = 0.25 × 0.75 × 0.25)
- **feminine** : Bras fins (3×12×4 px = 0.1875 × 0.75 × 0.25)
- **custom** : Proportions entièrement personnalisées

### 2. Templates de corps

```typescript
import { masculineBodyTemplate, feminineBodyTemplate } from "./character-builder";

// Templates prédéfinis avec dimensions correctes
const masculineTemplate = getBodyTemplate("masculine");
const feminineTemplate = getBodyTemplate("feminine");
```

### 3. Factory pour création rapide

```typescript
import { createMasculineCharacter, createFeminineCharacter } from "./character-builder";

// Créer un personnage masculin personnalisé
const warrior = createMasculineCharacter("warrior", myPalette, myTextures);

// Créer un personnage féminin personnalisé
const mage = createFeminineCharacter("mage", myPalette, myTextures);
```

### 4. Alex - Personnage féminin complet

```typescript
import { createAlex } from "./characters";

const { mesh, animator } = createAlex(scene, new Vector3(0, 0, 0));
animator.play("walk");
```

## 📊 Différences techniques

### Dimensions des bras

| Type | Minecraft | Unités jeu | Position X |
|------|-----------|------------|------------|
| **Masculin** | 4×12×4 | 0.25 × 0.75 × 0.25 | ±0.375 |
| **Féminin** | 3×12×4 | 0.1875 × 0.75 × 0.25 | ±0.34375 |

### Textures

- **Steve (masculin)** : 4 colonnes pour les bras
- **Alex (féminin)** : 3 colonnes pour les bras

### Parties identiques

- Tête : 8×8×8 (identique)
- Torse : 8×12×4 (identique)
- Jambes : 4×12×4 (identique)

## 🚀 Exemples d'utilisation

### Exemple 1 : Steve et Alex côte à côte

```typescript
import { createSteve, createAlex } from "./characters";

const steve = createSteve(scene, new Vector3(-1, 0, 0));
steve.animator.play("walk");

const alex = createAlex(scene, new Vector3(1, 0, 0));
alex.animator.play("walk");
```

### Exemple 2 : Guerrier masculin personnalisé

```typescript
import { createMasculineCharacter, buildCharacter } from "./character-builder";

const warriorPalette = {
  A: [0.5, 0.0, 0.0, 1], // Rouge
  // ... autres couleurs
};

const warrior = createMasculineCharacter("warrior", warriorPalette, textures);
const mesh = buildCharacter(scene, warrior, position);
```

### Exemple 3 : Mage féminine personnalisée

```typescript
import { createFeminineCharacter, buildCharacter } from "./character-builder";

const magePalette = {
  A: [0.3, 0.1, 0.4, 1], // Violet
  // ... autres couleurs
};

const mage = createFeminineCharacter("mage", magePalette, textures);
const mesh = buildCharacter(scene, mage, position);
```

### Exemple 4 : Utilisation du template

```typescript
import { getBodyTemplate, createBodyPartFromTemplate } from "./character-builder";

const template = getBodyTemplate("feminine");
const bodyParts = template.map(part => 
  createBodyPartFromTemplate(part, myTextures[part.name])
);
```

### Exemple 5 : Personnage entièrement custom

```typescript
const customCharacter: CharacterModel = {
  name: "giant",
  bodyType: "custom",
  bodyParts: [
    {
      name: "head",
      dimensions: { width: 0.7, height: 0.7, depth: 0.7 }, // Grosse tête
      position: { x: 0, y: 2.0, z: 0 },
      textures: { /* ... */ },
    },
    // ... autres parties personnalisées
  ],
};
```

## 🎨 Palettes de couleurs

### Steve (masculin)
- Cheveux : Marron foncé
- T-shirt : Cyan
- Pantalon : Bleu
- Peau : Bronzée

### Alex (féminin)
- Cheveux : Roux
- Haut : Vert
- Pantalon : Marron
- Peau : Claire

## 📝 API complète

### Création de personnages

```typescript
// Personnages par défaut
createSteve(scene, position): { mesh, animator }
createAlex(scene, position): { mesh, animator }

// Création personnalisée
createMasculineCharacter(name, palette, textures): CharacterModel
createFeminineCharacter(name, palette, textures): CharacterModel
createCustomCharacter(options): CharacterModel

// Construction
buildCharacter(scene, model, position): Mesh

// Animation
new CharacterAnimator(mesh, scene)
animator.loadAnimations(animations)
animator.play(name, loop?, speed?)
animator.stop()
animator.getCurrentAnimation(): string | null
```

### Templates

```typescript
getBodyTemplate(bodyType: BodyType): BodyPartTemplate[]
createBodyPartFromTemplate(template, textures): BodyPartDefinition

// Templates prédéfinis
masculineBodyTemplate: BodyPartTemplate[]
feminineBodyTemplate: BodyPartTemplate[]
```

### Utilitaires

```typescript
getBodyPart(characterMesh, partName): Mesh | undefined
getAllBodyParts(characterMesh): Map<string, Mesh>
createTextureFromMatrix(scene, name, textureData, scale?): DynamicTexture
```

## ✅ Avantages du système

1. **Réalisme** - Proportions anatomiques différentes
2. **Flexibilité** - Créer facilement des variantes
3. **Réutilisabilité** - Templates partagés
4. **Simplicité** - API claire et intuitive
5. **Type-safe** - TypeScript pour tout
6. **Extensible** - Facile d'ajouter de nouveaux types
7. **Performant** - Réutilisation de code

## 📚 Documentation

- **README.md** - Guide complet du système
- **BODY_TYPES.md** - Détails sur les différences de corps
- **examples.ts** - 5 exemples pratiques
- **GENDER_SUPPORT.md** - Ce fichier récapitulatif

## 🎯 Cas d'usage

### Jeu multijoueur
Permettre aux joueurs de choisir entre Steve et Alex

### Personnalisation
Créer des skins masculins et féminins personnalisés

### NPCs
Peupler le monde avec des personnages variés

### Équipes
Différencier visuellement les équipes par le type de corps

## 🔧 Migration depuis l'ancien système

### Avant (Steve uniquement)
```typescript
import { createSteveCharacter } from "./steve-character";

const steve = createSteveCharacter(scene, position);
```

### Après (Steve avec nouveau système)
```typescript
import { createSteve } from "./characters";

const { mesh, animator } = createSteve(scene, position);
animator.play("walk");
```

### Nouveau : Alex
```typescript
import { createAlex } from "./characters";

const { mesh, animator } = createAlex(scene, position);
animator.play("walk");
```

## 🚀 Prochaines étapes possibles

1. **Variantes de taille**
   - Enfant (plus petit)
   - Géant (plus grand)
   
2. **Plus de types de corps**
   - Athlétique
   - Robuste
   - Élancé

3. **Bibliothèque de skins**
   - Skins prédéfinis
   - Import de skins Minecraft réels

4. **Éditeur de personnages**
   - Interface visuelle
   - Prévisualisation en temps réel

5. **Animations spécifiques**
   - Animations différentes par type
   - Émotes et gestes

## 💡 Notes importantes

- Les animations sont **identiques** pour les deux types
- Seules les **dimensions des bras** changent
- Les textures doivent avoir le **bon nombre de colonnes** (3 ou 4)
- Le système est **entièrement rétrocompatible**

## 🎉 Résumé

Le système de construction de personnages supporte maintenant **trois types de corps** :

1. **Masculin** (Steve) - Bras larges, style robuste
2. **Féminin** (Alex) - Bras fins, style élancé
3. **Custom** - Proportions entièrement personnalisées

Vous pouvez créer des personnages en utilisant :
- Les helpers `createSteve()` et `createAlex()`
- Les factories `createMasculineCharacter()` et `createFeminineCharacter()`
- La construction manuelle complète pour un contrôle total

Le tout avec une API claire, type-safe et extensible ! 🚀

---

## 🎮 Extensions : Physique et Export SVG

### Physique intégrée (avatar-physics.ts)

Les personnages créés avec `buildCharacter()` peuvent avoir une **physique intégrée** :

```typescript
// Créer avec physique
const { mesh, animator, physics } = createSteve(scene, pos, { physics: true });

// Mettre à jour chaque frame
physics.update({
  worldChunks,
  sizeX, sizeY, sizeZ,
  deltaTime,
});

// Caractéristiques :
// - Gravité appliquée continuellement
// - Collision avec le terrain (détection AABB)
// - Contrôle externe optionnel (mode réseau/IA)
// - isGrounded() pour savoir si au sol
// - Intégration avec collision joueur↔personnage
```

### Export SVG en perspective (svg-export.ts)

Générer des images SVG 2D en perspective 3D :

```typescript
// Export basique
const svg = createSteveSvg(scene, pos, { physics: false }, {
  width: 512,
  height: 512,
});

// Avec poses animées
const svg = createSteveSvg(scene, pos, undefined, {
  pose: {
    parts: {
      rightArm: { rotation: { x: -1.2 } },  // Lever le bras
      leftLeg: { rotation: { x: 0.5 } },    // Avancer la jambe
    },
  },
});

// Caractéristiques :
// - Rendu perspective 3D réaliste
// - Textures matricielles échantillonnées
// - Support complet des poses (rotation/position)
// - Paramètres de caméra configurables
// - Anti-coutures via cellOverlap
```

### Intégration dans le jeu

```typescript
// main.ts - Boucle de jeu

// Créer les personnages avec physique
const { mesh: alexMesh, physics: alexPhysics } = createAlex(
  scene,
  new Vector3(5, 0, 0),
  { physics: true }
);

// Chaque frame
scene.onAfterRenderObservable.add(() => {
  // Mettre à jour la physique
  alexPhysics?.update({
    worldChunks,
    sizeX, sizeY, sizeZ,
    deltaTime: engine.getDeltaTime() / 1000,
  });

  // Résoudre collisions joueur↔personnages
  resolvePlayerCharacterCollision(playerPhysics, alexPhysics);

  scene.render();
});
```

### Occlusion rayon personnage

Les personnages **bloquent** automatiquement la sélection/cassage de bloc :

```typescript
// Dans pointed-block-label.ts, block-breaking.ts, textured-world.ts
const characterHit = getCharacterHitDistance(scene, ray);
if (characterHit > 0 && characterHit < blockDistance) {
  // Rayon a frappé un personnage → pas de sélection
  return null;
}
```

---

## 📚 Documentation complète

- [docs/character-system.md](./docs/character-system.md) - Système complet de personnages
- [docs/avatar-physics.md](./docs/avatar-physics.md) - Physique intégrée
- [docs/character-svg-export.md](./docs/character-svg-export.md) - Export SVG
- [src/character-builder/README.md](./src/character-builder/README.md) - API détaillée
- [src/character-builder/BODY_TYPES.md](./src/character-builder/BODY_TYPES.md) - Types de corps

---

## ✅ État d'implémentation

| Feature | Status | Notes |
|---------|--------|-------|
| Types corps (masculin/féminin/custom) | ✅ | Complet |
| Création rapide (factories) | ✅ | createSteve, createAlex, etc. |
| Animations | ✅ | idle, walk, mine, jump |
| Textures matricielles | ✅ | Couleurs procédurales |
| **Physique intégrée** | ✅ | Gravité + collision |
| **Export SVG 2D** | ✅ | Perspective 3D + poses |
| **Occlusion rayon** | ✅ | Bloque sélection bloc |
| Multi-joueur réseau | 🚧 | Mode externalControl prêt |
| Éditeur visuel | 🚫 | Futur (UI non implémentée) |
