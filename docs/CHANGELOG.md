# Mise à jour de la Documentation - Juin 2026

## Résumé des changements

Cette mise à jour documente les dernières implémentations du projet Minecraft WebXR, notamment le système complet de construction de personnages avec support masculin/féminin.

## Nouveau fichier créé

### `character-system.md`

Documentation complète du système de personnages couvrant :

- **Architecture du système** : Modules `character-builder/` et `characters/`
- **Types de corps** : Masculin (Steve), Féminin (Alex), Custom
- **Différences anatomiques** : Dimensions des bras (larges vs fins)
- **Utilisation pratique** : Création de personnages par défaut et personnalisés
- **Système d'animation** : Animations idle, walk, mine, jump
- **Textures procédurales** : Matrices 16×16 avec palettes de couleurs
- **Palettes par défaut** : Steve (cyan/bleu) et Alex (vert/marron)
- **Intégration au jeu** : Connexion avec le joueur et la caméra
- **Futures évolutions** : Variations de taille, nouveaux types, bibliothèque de skins

## Fichiers mis à jour

### `README.md`

- Ajout du chapitre 8 : "Système de personnages (Steve, Alex, Custom)"
- Correction de la numérotation du sommaire

### `architecture.md`

- Ajout des modules `character-builder/` et `characters/` dans la table des modules principaux
- Description du rôle de chaque module

### `rendering-and-effects.md`

- Nouvelle section "Personnages 3D" expliquant :
  - Construction des personnages à partir de cuboïdes
  - Types de personnages (Steve, Alex, Custom)
  - Système d'animation avec Babylon.js
  - Diagramme de flux de construction

### `gameplay-interactions.md`

- Mise à jour des liens de navigation pour intégrer character-system.md

### Tous les fichiers de navigation

Correction complète de l'ordre de navigation pour suivre le sommaire :

1. `architecture.md` → installation-build.md
2. `installation-build.md` → runtime-flow.md
3. `runtime-flow.md` → world-generation.md
4. `world-generation.md` → blocks-items-crafting.md
5. `blocks-items-crafting.md` → rendering-and-effects.md
6. `rendering-and-effects.md` → gameplay-interactions.md
7. `gameplay-interactions.md` → character-system.md
8. `character-system.md` → pwa-assets.md
9. `pwa-assets.md` → (fin)

## Structure complète de la documentation

```
docs/
├── README.md                    # Sommaire et introduction
├── architecture.md              # Architecture globale
├── installation-build.md        # Installation et build
├── runtime-flow.md              # Cycle de vie
├── world-generation.md          # Génération du monde
├── blocks-items-crafting.md     # Blocs, items, craft
├── rendering-and-effects.md     # Rendu et effets
├── gameplay-interactions.md     # Interactions du jeu
├── character-system.md          # ✨ NOUVEAU : Système de personnages
├── pwa-assets.md                # PWA et assets
└── game-guide/                  # Guide non technique
    ├── README.md
    ├── blocks.md
    ├── items.md
    ├── crafts.md
    └── controls.md
```

## Fichiers de documentation source (hors docs/)

Les fichiers suivants à la racine du projet documentent les détails d'implémentation :

- `CHARACTER_SYSTEM_SUMMARY.md` - Résumé complet du système avec exemples
- `GENDER_SUPPORT.md` - Support masculin/féminin simplifié
- `src/character-builder/README.md` - Documentation technique du système générique
- `src/character-builder/BODY_TYPES.md` - Détails sur les types de corps
- `src/characters/examples.ts` - 5 exemples d'utilisation pratiques

## Nouveautés du système de personnages

### Fonctionnalités principales

1. **Trois types de corps**
   - Masculin : Bras larges (4×12×4 px = 0.25 × 0.75 × 0.25)
   - Féminin : Bras fins (3×12×4 px = 0.1875 × 0.75 × 0.25)
   - Custom : Proportions entièrement personnalisées

2. **Templates prédéfinis**
   - `getBodyTemplate("masculine")`
   - `getBodyTemplate("feminine")`
   - Helpers de création : `createMasculineCharacter()`, `createFeminineCharacter()`

3. **Personnages par défaut**
   - Steve : `createSteve(scene, position)`
   - Alex : `createAlex(scene, position)`
   - Retournent `{ mesh, animator }`

4. **Système d'animation unifié**
   - CharacterAnimator avec API simple
   - Animations : idle, walk, mine, jump
   - Identiques pour tous les types de corps

5. **Textures procédurales**
   - Matrices 16×16 avec palettes de couleurs
   - Création dynamique de textures
   - Palettes personnalisables

### Avantages

- ✅ Réalisme : Proportions anatomiques différentes
- ✅ Flexibilité : Créer facilement des variantes
- ✅ Réutilisabilité : Templates et factories partagés
- ✅ Simplicité : API claire et intuitive
- ✅ Type-safe : TypeScript complet
- ✅ Extensible : Facile d'ajouter de nouveaux types
- ✅ Performant : Réutilisation optimisée

## Exemples d'utilisation

### Créer Steve et Alex côte à côte

```typescript
import { createSteve, createAlex } from "./characters";

const steve = createSteve(scene, new Vector3(-1, 0, 0));
steve.animator.play("walk");

const alex = createAlex(scene, new Vector3(1, 0, 0));
alex.animator.play("walk");
```

### Créer un guerrier personnalisé

```typescript
import { createMasculineCharacter, buildCharacter } from "./character-builder";

const warrior = createMasculineCharacter("warrior", myPalette, myTextures);
const mesh = buildCharacter(scene, warrior, new Vector3(5, 0, 0));
```

### Créer une mage personnalisée

```typescript
import { createFeminineCharacter, buildCharacter } from "./character-builder";

const mage = createFeminineCharacter("mage", magePalette, mageTextures);
const mesh = buildCharacter(scene, mage, new Vector3(7, 0, 0));
```

## Navigation cohérente

Tous les fichiers de documentation ont maintenant une navigation cohérente avec :
- Lien "⬅️ Précédent" vers le chapitre précédent
- Lien "Sommaire" vers README.md
- Lien "Suivant ➡️" vers le chapitre suivant (sauf dernier chapitre)

Cela permet de lire la documentation de manière séquentielle ou de naviguer librement.

## Compatibilité

- ✅ Rétrocompatible avec l'ancien système steve-character.ts
- ✅ Les anciens imports de Steve continuent de fonctionner
- ✅ Ajout d'Alex sans casser le code existant
- ✅ API extensible pour futurs types de corps

## Prochaines évolutions possibles

1. **Variations de taille** : Enfants, géants
2. **Plus de types de corps** : Athlétique, robuste, élancé
3. **Bibliothèque de skins** : Skins prédéfinis, import de skins Minecraft réels
4. **Éditeur de personnages** : Interface visuelle avec prévisualisation
5. **Animations spécifiques** : Animations différentes par type, émotes

## Notes

- La documentation est en français pour correspondre au reste du projet
- Les diagrammes Mermaid sont utilisés pour la clarté visuelle
- Les exemples de code sont en TypeScript avec imports complets
- Les liens de navigation permettent une lecture fluide

---

**Date de mise à jour** : 10 juin 2026  
**Fichiers modifiés** : 10  
**Fichiers créés** : 2 (character-system.md + ce changelog)
