# Interactions de gameplay

## Vue d'ensemble

Les interactions de gameplay couvrent :

- déplacement du joueur ;
- collisions ;
- saut et auto-jump ;
- destruction progressive des blocs ;
- placement des blocs ;
- drops ;
- ramassage ;
- décroissance des feuilles ;
- label du bloc pointé ;
- interactions spécifiques VR.

La plupart des interactions reposent sur l'état partagé `PlayerPhysics`, `WorldChunks` et les dimensions de chunks retournées par le WASM.

## Joueur et physique

Le joueur est représenté par :

```ts
type PlayerPhysics = {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  inventory: InventoryItem[];
  selectedSlot: number;
};
```

Les dimensions physiques principales sont :

```ts
PLAYER_HEIGHT = 1.8
PLAYER_RADIUS = 0.32
EYE_HEIGHT = 1.62
```

La physique utilise aussi :

```ts
GRAVITY = -28
JUMP_VELOCITY = 9
MOVE_SPEED = 6
```

## Déplacement desktop/mobile

Les touches actives sont stockées dans :

```ts
pressedKeys: Set<string>
```

Le mouvement est calculé à partir de `player.yaw`.

Touches prises en charge :

- `Z` / `W` / `ArrowUp` : avancer ;
- `S` / `ArrowDown` : reculer ;
- `Q` / `A` / `ArrowLeft` : gauche ;
- `D` / `ArrowRight` : droite.

La direction est normalisée pour éviter qu'un déplacement diagonal soit plus rapide.

## Mouvement caméra

### Desktop

La souris modifie :

- `player.yaw` pour la rotation horizontale ;
- `player.pitch` pour la rotation verticale.

Le mouvement souris n'est pris en compte que si le pointeur est verrouillé sur le canvas.

Des protections existent contre les deltas souris anormaux :

- delta trop grand ignoré ;
- delta clampé ;
- pitch limité entre haut et bas.

### Mobile

Le joystick droit modifie `player.yaw` et `player.pitch` progressivement dans `scene.onBeforeRenderObservable`.

### VR

Le casque fournit l'orientation naturelle. Le corps du joueur est synchronisé avec la logique VR, mais l'orientation du regard vient principalement de la caméra XR.

## Collision joueur

Les collisions sont testées avec le monde voxel.

La fonction centrale est `hasCollisionAt(...)`, utilisée par :

- la physique joueur ;
- le déplacement VR ;
- la vérification de placement de bloc ;
- l'auto-jump.

La collision se base sur le rayon et la hauteur du joueur, pas sur un simple point.

## Saut

Le saut utilise `JUMP_VELOCITY`.

Desktop/mobile :

- `Space` déclenche le saut via la physique classique.

Mobile :

- le bouton de saut ajoute temporairement `Space` dans `pressedKeys`.

VR :

- le bouton `A` du contrôleur droit applique directement la vélocité verticale si le joueur est au sol.

## Auto-jump

Le runtime contient un auto-jump pour faciliter le franchissement de petits obstacles.

Principe :

1. le joueur doit être au sol ;
2. il doit tenter de se déplacer ;
3. le déplacement horizontal réel doit être bloqué ou très faible ;
4. un bloc est détecté devant ;
5. l'espace au-dessus est libre ;
6. une vélocité de saut est appliquée.

En VR, une variante plus simple existe dans `vr-mode.ts`.

## Rayons d'interaction

Les interactions avec les blocs utilisent un rayon.

### Desktop/mobile

Le rayon part des yeux du joueur et suit la direction du centre de l'écran.

### VR

Le rayon part du contrôleur gauche ou droit.

Les fonctions acceptent un `targetRay` optionnel. Cela permet d'utiliser les mêmes fonctions de placement/destruction pour desktop et VR.

## Portée d'interaction

La portée standard est de 3 blocs environ.

Dans `textured-world.ts` :

```ts
const BLOCK_INTERACTION_REACH = 3;
const BLOCK_INTERACTION_STEP = 0.1;
```

Dans `block-breaking.ts` :

```ts
const BREAKING_REACH = 3;
```

Le raycast voxel avance par pas de `0.1` bloc.

## Destruction de blocs

La destruction progressive est déclenchée par `startBlockBreaking(...)`.

Étapes :

1. recherche du bloc ciblé ;
2. lecture de la durée spécifique du bloc ;
3. création de l'overlay de fissures ;
4. progression du timer ;
5. changement de stage visuel ;
6. destruction effective lorsque la progression atteint 100%.

Durées actuellement définies :

| Bloc | Durée |
|------|-------|
| Dirt | 1000 ms |
| GrassBlock | 1000 ms |
| Sand | 500 ms |
| Stone | 3000 ms |

Un bloc sans durée définie est détruit immédiatement.

## Annulation de destruction

La destruction est annulée si :

- le joueur ne cible plus le même bloc ;
- le bloc change ;
- le clic est relâché ;
- le pointeur est déverrouillé ;
- le craft est ouvert ;
- la fenêtre perd le focus.

L'annulation supprime l'overlay et le shader actifs.

## Destruction effective

La destruction effective passe par `breakBlock(...)`.

Le système :

1. trouve le bloc ciblé ;
2. récupère son chunk ;
3. convertit les coordonnées monde vers coordonnées locales ;
4. remplace le bloc par `Air` ;
5. reconstruit le chunk et éventuellement ses voisins ;
6. crée un drop.

## Leaf decay

La destruction des troncs passe par `tree-decay.ts`.

Le système intercepte la destruction :

1. détecte si le bloc détruit est un tronc ;
2. détruit normalement le bloc ;
3. vérifie s'il reste un tronc autour ;
4. si aucun tronc n'est trouvé, programme la destruction progressive des feuilles proches.

## Paramètres de leaf decay

Les constantes sont :

```ts
LEAF_DECAY_INTERVAL_MS = 30_000
TREE_DECAY_LOG_SEARCH_RADIUS = 8
TREE_DECAY_LEAF_SEARCH_RADIUS = 8
```

Chaque feuille est programmée avec un délai progressif :

```ts
LEAF_DECAY_INTERVAL_MS * (index + 1)
```

Les feuilles sont triées par distance au tronc détruit.

## Placement de blocs

Le placement est géré par `placeBlock(...)`.

Étapes :

1. lire l'item sélectionné dans l'inventaire ;
2. vérifier que le bloc existe et n'est pas `Air` ;
3. trouver la dernière position remplaçable avant un bloc solide ;
4. vérifier que le bloc existant est `Air` ou `Water` ;
5. empêcher le placement d'un bloc solide dans le volume du joueur ;
6. écrire le bloc dans le chunk ;
7. reconstruire les chunks nécessaires ;
8. décrémenter le stack sélectionné ;
9. mettre à jour l'UI d'inventaire.

## Positions remplaçables

Une position est remplaçable si elle contient :

- `Air` ;
- `Water`.

Cela permet de placer un bloc dans l'air ou de remplacer visuellement l'eau.

## Chunks voisins

Quand un bloc est modifié sur le bord d'un chunk, le chunk voisin doit être reconstruit.

Exemples :

- `localX === 0` => voisin gauche ;
- `localX === sizeX - 1` => voisin droit ;
- `localZ === 0` => voisin arrière ;
- `localZ === sizeZ - 1` => voisin avant.

Sans reconstruction du voisin, certaines faces visibles resteraient absentes ou présentes à tort.

## Drops

Lorsqu'un bloc est détruit, un drop est créé avec :

- position au centre du bloc ;
- vélocité initiale aléatoire ;
- rotation aléatoire ;
- délai avant ramassage.

Les drops sont mis à jour à chaque frame.

## Physique des drops

Les drops :

- subissent la gravité ;
- se déplacent selon leur vélocité ;
- tournent autour de Y ;
- rebondissent légèrement sur un bloc solide ;
- amortissent leur vitesse horizontale.

Constantes :

```ts
DROP_PICKUP_DELAY_MS = 350
DROP_PICKUP_DISTANCE = 1.15
DROP_GROUND_DAMPING = 0.82
DROP_HORIZONTAL_DAMPING = 0.94
```

## Ramassage

Un drop est ramassé si :

- son délai de ramassage est écoulé ;
- sa distance au joueur est inférieure ou égale à `DROP_PICKUP_DISTANCE`.

Lors du ramassage :

1. l'item est ajouté à l'inventaire ;
2. l'UI est mise à jour ;
3. le mesh est supprimé ;
4. l'entrée est retirée du tableau `droppedItems`.

## Label du bloc pointé

Le label sous l'inventaire affiche le bloc ciblé en anglais/français.

Il utilise les définitions de blocs pour récupérer les noms.

En VR, il peut utiliser les rayons de contrôleurs plutôt que le centre de l'écran.

## Craft et interactions

Quand le craft est ouvert :

- les mouvements clavier sont nettoyés ;
- la destruction est annulée ;
- les contrôles mobiles sont reset ;
- le pointeur est libéré ;
- les événements pointer sont capturés par l'overlay.

Cela évite les interactions simultanées entre gameplay et interface.

## Interactions VR

En VR :

- trigger droit => destruction avec rayon droit ;
- trigger gauche => placement avec rayon gauche ;
- bouton A droit => saut ;
- joystick/touchpad gauche => déplacement ;
- inventaire VR peut capter les rayons, ce qui empêche l'interaction monde quand le rayon vise l'inventaire.

## Gestion des priorités d'interaction VR

Dans la boucle de rendu :

1. on récupère les rayons bruts des contrôleurs ;
2. on vérifie s'ils pointent l'inventaire VR ;
3. si oui, le rayon n'est pas transmis au monde ;
4. sinon, il peut casser ou placer un bloc.

Cela évite de casser un bloc derrière l'inventaire en voulant sélectionner un slot.

## Ajouter une interaction

Pour ajouter une nouvelle interaction :

1. déterminer la source d'entrée : clavier, souris, tactile, VR ou toutes ;
2. éviter de dupliquer la logique métier entre devices ;
3. créer une fonction métier acceptant un `targetRay` optionnel si l'interaction vise le monde ;
4. brancher chaque device sur cette fonction ;
5. vérifier les conflits avec le craft, l'inventaire et la VR.

## Points d'attention

- Toujours annuler la destruction si la cible change.
- Ne pas laisser les touches actives quand une UI bloquante s'ouvre.
- Ne pas placer de bloc solide dans le joueur.
- Rebuild les chunks voisins en bordure.
- Ne pas transmettre au monde un rayon VR déjà utilisé par l'inventaire.
- Garder les interactions monde indépendantes du device quand c'est possible.
