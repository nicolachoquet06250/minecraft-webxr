# Physique des Personnages (Avatar Physics)

## Vue d'ensemble

Le système de physique gère la gravité, les collisions et le mouvement des personnages NPCs (Steve, Alex) de manière **entièrement interne** au module `buildCharacter()`. Le système support deux modes :

1. **Mode simulé local** : Gravité + collision appliquées à chaque frame
2. **Mode distante** : Accepte position/vélocité de sources externes (réseau, IA, etc.)

## Architecture

### Module : `src/character-builder/avatar-physics.ts`

Export public :
- `CharacterPhysicsController` - Classe principale
- `resolvePlayerCharacterCollision()` - Collision joueur↔personnage

## Classes et Types

### `CharacterPhysicsController`

Contrôleur de physique pour un personnage individuel.

```typescript
class CharacterPhysicsController {
  constructor(mesh: Mesh, scene: Scene, options?: PhysicsOptions);

  // Mise à jour et simulation
  update(options: CharacterPhysicsUpdateOptions): void;

  // Contrôle du mouvement
  setExternalControl(enabled: boolean): void;
  setPosition(position: Vector3): void;
  setVelocity(velocity: Vector3): void;

  // Requêtes d'état
  isGrounded(): boolean;
  getPosition(): Vector3;
  getVelocity(): Vector3;
}
```

### `PhysicsOptions`

Configuration au moment de la création :

```typescript
interface PhysicsOptions {
  // Dimensions de collision (relativement à l'axe Y)
  radius?: number;           // 0.35 par défaut (rayon collision)
  height?: number;           // 1.8 par défaut (hauteur total)

  // Démarrage
  externalControl?: boolean; // false par défaut (simulé local)
}
```

### `CharacterPhysicsUpdateOptions`

Données à passer à chaque appel `update()` :

```typescript
interface CharacterPhysicsUpdateOptions {
  // Accès au monde 3D
  worldChunks: Map<string, Chunk>;  // Grille de chunks du monde
  sizeX: number;                    // Dimensions du monde
  sizeY: number;
  sizeZ: number;

  // Delta temps (en secondes)
  deltaTime: number;
}
```

## Gravité et Physique

### Gravité

La gravité est appliquée continuellement chaque frame :

```typescript
// Dans update()
const GRAVITY = 0.098;  // En unités/s²
velocity.y += -GRAVITY * deltaTime;
```

La valeur gravitationnelle produit une chute naturelle d'environ 0.5 unités par seconde.

### Collision

Le système utilise une **détection de collision par capsule/AABB** avec le terrain.

#### Résolution de collision

1. Test de collision aux 4 coins de la capsule (bas et haut)
2. Si collision détectée : **remontée jusqu'à surface valide**
3. Si au sol : **vélocité Y mise à 0**

```typescript
// Pseudocode
for each cornerPosition in [BL, BR, TL, TR]:
  if hasCollision(cornerPosition, radius):
    push mesh to valid position
    if onGround: velocity.y = 0
```

#### Impact sur le joueur

La fonction `resolvePlayerCharacterCollision()` gère l'interaction joueur↔personnage :

```typescript
function resolvePlayerCharacterCollision(
  playerController: PlayerPhysicsController,
  characterPhysics: CharacterPhysicsController
): void
```

Résout les cas où le joueur rentre en collision avec un personnage NPC.

## Modes de fonctionnement

### Mode 1 : Simulé Local (par défaut)

Le personnage est entièrement piloté par la gravité + collision locale.

```typescript
const { mesh, physics } = createSteve(scene, pos, {
  physics: true,
  externalControl: false,  // Simulé local
});

// Chaque frame
physics.update({
  worldChunks,
  sizeX, sizeY, sizeZ,
  deltaTime,
});

// Le personnage tombe naturellement, se pose sur le sol, etc.
```

**Cas d'usage** :
- Personnages amis statiques (NPCs)
- Animations autonomes
- Démos visuelles

### Mode 2 : Contrôle Externe

Le personnage accepte position + vélocité de sources externes (réseau, IA centralisée, etc.).

```typescript
const { mesh, physics } = createSteve(scene, pos, {
  physics: true,
  externalControl: true,  // Mode distante
});

// Le contrôleur accepte les valeurs externes
physics.setPosition(new Vector3(10, 5, 0));
physics.setVelocity(new Vector3(0.5, 0, 0));

// La gravité et collision ne s'appliquent PAS
// update() est optionnelle
```

**Cas d'usage** :
- Multi-joueur réseau (position du serveur)
- Personnages IA avec contrôleur centralisé
- Animations préprogrammées synchronisées

### Basculer les modes

```typescript
// Passer à mode distante
physics.setExternalControl(true);

// Revenir au mode simulé
physics.setExternalControl(false);
```

## Intégration avec le jeu

### Dans `main.ts` (boucle de jeu)

```typescript
// Créer les personnages
const { mesh: alexMesh, physics: alexPhysics } = createAlex(
  scene,
  new Vector3(5, 0, 0),
  { physics: true }
);

// Dans la boucle de rendu
engine.runRenderLoop(() => {
  // Mettre à jour la physique des personnages
  if (alexPhysics) {
    alexPhysics.update({
      worldChunks,
      sizeX: WORLD_SIZE_X,
      sizeY: WORLD_SIZE_Y,
      sizeZ: WORLD_SIZE_Z,
      deltaTime: engine.getDeltaTime() / 1000,
    });
  }

  // Résoudre collisions joueur↔personnages
  resolvePlayerCharacterCollision(playerPhysics, alexPhysics);

  // Synchroniser caméra joueur
  syncPlayerCamera();

  scene.render();
});
```

## Récupérer le contrôleur physique

Pour accéder à la physique d'un personnage construit avec `buildCharacter()` :

```typescript
import { getCharacterPhysics } from "src/character-builder";

const mesh = buildCharacter(scene, model, pos, { physics: true });

// Récupérer le contrôleur
const physics = getCharacterPhysics(mesh);
if (physics) {
  physics.update({ worldChunks, sizeX, sizeY, sizeZ, deltaTime });
}
```

## Performance

### Coûts

- **Par-personnage par-frame** : ~1-2ms (dépend de la complexité du terrain)
- **Requêtes collision** : ~0.5ms (4 tests aux coins)
- **Pas de mesh pooling** : Chaque personnage créé = une instance unique

### Optimisations possibles

```typescript
// Pré-calculer les collisions du terrain
const terrainOctree = new Octree(worldChunks);

// Appliquer une fréquence réduite
let updateCounter = 0;
if (updateCounter++ % 2 === 0) {
  physics.update(options); // Update 1 frame sur 2
}
```

## Limitations actuelles

1. **Pas de frottement** : Les personnages ne ralentissent pas horizontalement
2. **Pas d'escalade** : Les personnages ne montent pas automatiquement les escaliers
3. **Pas de pente** : Les personnages glissent sur les pentes
4. **Collision carrée** : Utilise AABB, pas de capsule réelle 3D
5. **Pas de saut** : Pas de code pour initier un saut

## Extensions futures

### Frottement

```typescript
// Ralentissement horizontal
velocity.x *= 0.95;
velocity.z *= 0.95;
```

### Escalade simple

```typescript
if (isSteppingUpTo(position, 0.5)) {
  position.y += 0.5; // Monter le marchepied
}
```

### Saut pour les NPCs

```typescript
if (shouldJump && isGrounded()) {
  velocity.y = JUMP_VELOCITY; // ~0.5 unités/s
}
```

### Pentes

```typescript
// Appliquer gravité au sol incliné
const groundAngle = computeTerrainNormal(position);
velocity.y -= Math.sin(groundAngle) * GRAVITY * deltaTime;
```

## Intégration avec la sélection de blocs

La physique des personnages n'interfère **pas** avec la sélection/cassage de blocs grâce à la fonction `getCharacterHitDistance()` :

```typescript
// Dans pointed-block-label.ts
const characterDistance = getCharacterHitDistance(scene, ray);
if (characterDistance > 0 && characterDistance < blockDistance) {
  // Rayon a frappé un personnage en premier
  return null; // Pas de bloc sélectionné
}
```

Cela crée une **occlusion naturelle** : impossible de casser un bloc à travers un personnage.

## Debugging

### État du personnage

```typescript
console.log("Position", physics.getPosition());
console.log("Vélocité", physics.getVelocity());
console.log("Au sol?", physics.isGrounded());
```

### Afficher la capsule de collision

```typescript
// Dessiner un cylindre de debug
const debugMesh = BABYLON.MeshBuilder.CreateCylinder(
  "debug",
  { height: physics.height, diameter: physics.radius * 2 },
  scene
);
debugMesh.position = physics.getPosition();
debugMesh.material = debugMaterial; // Semi-transparent
```

## Voir aussi

- [Character System](./character-system.md) - Architecture générale des personnages
- [Character SVG Export](./character-svg-export.md) - Export visuel (indépendant de la physique)
- `src/character-builder/avatar-physics.ts` - Code source
- `src/main.ts` - Intégration dans la boucle de jeu

---

[⬅️ Précédent](./rendering-and-effects.md) | [Sommaire](./README.md) | [Suivant ➡️](./gameplay-interactions.md)
