# Index de la Documentation Minecraft WebXR

## 📚 Documentation Technique

### Documentation principale (lecture séquentielle recommandée)

1. **[README.md](./README.md)** - Sommaire et introduction générale
2. **[architecture.md](./architecture.md)** - Vue d'ensemble de l'architecture
3. **[installation-build.md](./installation-build.md)** - Installation et scripts de build
4. **[runtime-flow.md](./runtime-flow.md)** - Cycle de vie et flux d'exécution
5. **[world-generation.md](./world-generation.md)** - Génération procédurale du monde
6. **[blocks-items-crafting.md](./blocks-items-crafting.md)** - Blocs, items, inventaire et craft
7. **[rendering-and-effects.md](./rendering-and-effects.md)** - Rendu, meshes et effets visuels
8. **[gameplay-interactions.md](./gameplay-interactions.md)** - Interactions et contrôles
9. **[character-system.md](./character-system.md)** - ✨ Système de personnages (Steve, Alex, Custom)
10. **[pwa-assets.md](./pwa-assets.md)** - PWA, assets et déploiement

### Documentation de mise à jour

- **[CHANGELOG.md](./CHANGELOG.md)** - Historique des mises à jour de la documentation
- **[INDEX.md](./INDEX.md)** - Ce fichier (index complet)

## 🎮 Guide du Jeu (Non technique)

Documentation destinée aux joueurs dans le dossier `game-guide/` :

- **[game-guide/README.md](./game-guide/README.md)** - Introduction au jeu
- **[game-guide/controls.md](./game-guide/controls.md)** - Contrôles desktop, mobile et VR
- **[game-guide/blocks.md](./game-guide/blocks.md)** - Liste des blocs disponibles
- **[game-guide/items.md](./game-guide/items.md)** - Liste des items et outils
- **[game-guide/crafts.md](./game-guide/crafts.md)** - Recettes de craft

## 📊 Ressources Visuelles

### Visuels de blocs (`blocks/visuels/`)

- Textures SVG et PNG des blocs (bois, terre, herbe, pierre, eau, etc.)
- Textures de la crafting table (6 faces)
- Fleurs et éléments décoratifs

### Visuels d'items (`items/visuels/`)

- Icônes PNG des items et outils
- Exemples : pickaxe-grass-dirt.png

## 🔧 Documentation Source (Hors docs/)

### Racine du projet

- **`CHARACTER_SYSTEM_SUMMARY.md`** - Résumé complet du système de personnages avec exemples
- **`GENDER_SUPPORT.md`** - Documentation du support masculin/féminin
- **`README.md`** - README principal du projet (vue utilisateur)

### Module character-builder

- **`src/character-builder/README.md`** - Documentation technique du système générique
- **`src/character-builder/BODY_TYPES.md`** - Détails sur les différences de corps
- **`src/characters/examples.ts`** - 5 exemples d'utilisation pratiques

## 📖 Parcours de Lecture Recommandés

### Pour les développeurs découvrant le projet

1. [README.md](./README.md) - Vue d'ensemble
2. [architecture.md](./architecture.md) - Comprendre l'organisation
3. [installation-build.md](./installation-build.md) - Setup de l'environnement
4. [blocks-items-crafting.md](./blocks-items-crafting.md) - Comprendre les données
5. [character-system.md](./character-system.md) - Système de personnages
6. [gameplay-interactions.md](./gameplay-interactions.md) - Interactions

### Pour contribuer au système de personnages

1. [character-system.md](./character-system.md) - Vue d'ensemble du système
2. `../CHARACTER_SYSTEM_SUMMARY.md` - Documentation complète
3. `../src/character-builder/README.md` - Détails techniques
4. `../src/character-builder/BODY_TYPES.md` - Différences anatomiques
5. `../src/characters/examples.ts` - Exemples de code

### Pour ajouter du contenu (blocs, items, crafts)

1. [blocks-items-crafting.md](./blocks-items-crafting.md) - Comprendre le système
2. [world-generation.md](./world-generation.md) - Génération procédurale
3. [rendering-and-effects.md](./rendering-and-effects.md) - Rendu des textures

### Pour les joueurs

1. [game-guide/README.md](./game-guide/README.md) - Introduction
2. [game-guide/controls.md](./game-guide/controls.md) - Apprendre les contrôles
3. [game-guide/blocks.md](./game-guide/blocks.md) - Découvrir les blocs
4. [game-guide/crafts.md](./game-guide/crafts.md) - Recettes de craft

## 🎯 Accès Rapide par Thème

### Architecture & Setup
- [architecture.md](./architecture.md)
- [installation-build.md](./installation-build.md)
- [runtime-flow.md](./runtime-flow.md)

### Contenu du Jeu
- [blocks-items-crafting.md](./blocks-items-crafting.md)
- [world-generation.md](./world-generation.md)
- [character-system.md](./character-system.md)

### Rendu & Interactions
- [rendering-and-effects.md](./rendering-and-effects.md)
- [gameplay-interactions.md](./gameplay-interactions.md)

### Déploiement
- [pwa-assets.md](./pwa-assets.md)

### Guide Joueur
- [game-guide/](./game-guide/)

## 🆕 Dernières Mises à Jour

### Juin 2026 - Système de Personnages

**Fichiers créés :**
- `character-system.md` - Documentation complète du système (10.4 KB)
- `CHANGELOG.md` - Historique des changements (7.4 KB)
- `INDEX.md` - Cet index (ce fichier)

**Fichiers mis à jour :**
- `README.md` - Ajout du chapitre système de personnages
- `architecture.md` - Ajout des modules character-builder et characters
- `rendering-and-effects.md` - Section personnages 3D
- `gameplay-interactions.md` - Liens de navigation mis à jour
- Tous les fichiers : Navigation cohérente restaurée

**Nouveautés documentées :**
- ✨ Système de construction de personnages générique
- ✨ Support de trois types de corps (masculin, féminin, custom)
- ✨ Personnages Steve et Alex avec animations
- ✨ Textures procédurales avec palettes de couleurs
- ✨ API de création simplifiée avec helpers et factories

Voir [CHANGELOG.md](./CHANGELOG.md) pour les détails complets.

## 🔗 Liens Externes

- **Projet GitHub** : nicolachoquet06250/minecraft-webxr
- **Babylon.js** : https://www.babylonjs.com/
- **Rust/WASM** : https://rustwasm.github.io/

## 📝 Conventions de Documentation

- **Langue** : Français (documentation technique et guide joueur)
- **Format** : Markdown avec diagrammes Mermaid
- **Navigation** : Liens "Précédent/Sommaire/Suivant" en haut et bas de page
- **Code** : Exemples en TypeScript avec imports complets
- **Visuels** : Diagrammes Mermaid pour la clarté

## 💡 Contribuer à la Documentation

Pour mettre à jour la documentation :

1. Modifier les fichiers `.md` appropriés
2. Mettre à jour `CHANGELOG.md` avec vos changements
3. Vérifier que les liens de navigation sont cohérents
4. Ajouter des diagrammes Mermaid si nécessaire
5. Maintenir la langue française

---

**Index mis à jour le** : 10 juin 2026  
**Total de fichiers documentés** : 21 fichiers markdown + ressources visuelles  
**Navigation** : Tous les fichiers sont interconnectés
