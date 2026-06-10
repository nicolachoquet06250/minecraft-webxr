# Support Masculin/Féminin - Résumé

## 🎮 Nouveautés ajoutées

### 1. Types de corps
- **Masculin** : Bras larges (type Steve)
- **Féminin** : Bras fins (type Alex)
- **Custom** : Proportions personnalisées

### 2. Fichiers créés

#### System Core
```
character-builder/
├── body-templates.ts       # Templates masculin/féminin
├── character-factory.ts    # Helpers de création
└── BODY_TYPES.md          # Documentation des différences
```

#### Personnages
```
characters/
├── alex.ts                 # Créateur d'Alex
├── alex-model.ts          # Modèle féminin
├── alex-animations.ts     # Animations Alex
├── alex-textures.ts       # Palette et textures
└── examples.ts            # 5 exemples d'utilisation
```

### 3. API simplifiée

```typescript
// Utiliser les personnages par défaut
import { createSteve, createAlex } from "./characters";

const steve = createSteve(scene, position);
const alex = createAlex(scene, position);

// Créer des variantes
import { createMasculineCharacter, createFeminineCharacter } from "./character-builder";

const warrior = createMasculineCharacter("warrior", palette, textures);
const mage = createFeminineCharacter("mage", palette, textures);
```

## 📊 Différences clés

| Aspect | Masculin (Steve) | Féminin (Alex) |
|--------|------------------|----------------|
| Largeur bras | 0.25 (4px) | 0.1875 (3px) |
| Position bras | ±0.375 | ±0.34375 |
| Autres parties | Identiques | Identiques |

## 🚀 Utilisation rapide

### Créer Steve
```typescript
const { mesh, animator } = createSteve(scene, new Vector3(0, 0, 0));
animator.play("walk");
```

### Créer Alex
```typescript
const { mesh, animator } = createAlex(scene, new Vector3(2, 0, 0));
animator.play("mine");
```

### Créer un personnage personnalisé masculin
```typescript
const warrior = createMasculineCharacter("warrior", myPalette, myTextures);
const mesh = buildCharacter(scene, warrior, position);
```

### Créer un personnage personnalisé féminin
```typescript
const mage = createFeminineCharacter("mage", myPalette, myTextures);
const mesh = buildCharacter(scene, mage, position);
```

## ✨ Avantages

1. **Réalisme** - Proportions différentes pour masculin/féminin
2. **Flexibilité** - Créer facilement des variantes
3. **Réutilisabilité** - Templates partagés
4. **Simplicité** - API claire et intuitive
5. **Type-safe** - TypeScript pour tout

## 📚 Documentation complète

- `README.md` - Guide complet du système
- `BODY_TYPES.md` - Détails sur les types de corps
- `examples.ts` - 5 exemples pratiques
- [docs/character-system.md](./docs/character-system.md) - Système complet
- [docs/avatar-physics.md](./docs/avatar-physics.md) - Physique intégrée
- [docs/character-svg-export.md](./docs/character-svg-export.md) - Export SVG

## 🎯 Extensions récentes

### Physique intégrée (avatar-physics.ts)

```typescript
// Les personnages ont maintenant une physique interne
const { mesh, animator, physics } = createSteve(scene, pos, { physics: true });

// Gravité + collision avec le monde
physics.update({
  worldChunks,
  sizeX, sizeY, sizeZ,
  deltaTime,
});

// Support multi-joueur (mode distant)
physics.setExternalControl(true);
physics.setPosition(remotePosition);
physics.setVelocity(remoteVelocity);
```

**Caractéristiques** :
- Gravité réaliste (GRAVITY = 0.098)
- Collision AABB avec terrain
- Toggle local/distant
- Occlusion automatique (bloque sélection bloc)

### Export SVG 2D (svg-export.ts)

```typescript
// Générer des images SVG en perspective 3D
const svg = createSteveSvg(scene, pos, { physics: false }, {
  width: 512,
  height: 512,
  pose: {
    parts: {
      rightArm: { rotation: { x: -1.2 } },  // Lever
      headYaw: Math.PI / 4,                  // Tourner tête
    },
  },
});

// Sauvegarder
downloadSvg(svg, "steve.svg");
```

**Caractéristiques** :
- Perspective 3D réaliste
- Poses dynamiques (rotation/position)
- Textures matricielles avec échantillonnage
- Anti-coutures intelligentes
- Paramètres de caméra configurables

### Occlusion rayon personnage

```typescript
// Sélection de bloc bloquée par personnage
const charDist = getCharacterHitDistance(scene, ray);
if (charDist > 0 && charDist < blockDist) {
  return null;  // Pas de sélection
}
```

Fonctionne dans :
- `pointed-block-label.ts` - Labellisation blocs
- `block-breaking.ts` - Destruction de blocs
- `textured-world.ts` - Placement de blocs

## 🎯 Prochaines étapes possibles

1. Ajouter plus de types de corps (enfant, géant, etc.)
2. Créer une bibliothèque de palettes prédéfinies
3. Ajouter des animations spécifiques par type
4. Créer un éditeur visuel de personnages
5. Support de skins Minecraft réels
6. **Multi-joueur réseau** (utiliser mode externalControl)
7. **Systèmes d'IA** pour personnages autonomes
8. **Animation en temps réel** basée sur poses
