# Blocs, items, inventaire et craft

## Vue d'ensemble

Le projet sépare clairement :

- les **blocs**, qui décrivent le monde ;
- les **items**, qui décrivent ce que le joueur manipule dans l'inventaire ;
- les **recettes de craft**, qui décrivent les transformations possibles ;
- les **UI**, qui permettent au joueur de visualiser et manipuler ces données.

Cette séparation permet d'ajouter un bloc, un item ou une recette sans mélanger la logique de rendu, d'inventaire et de génération procédurale.

## Identifiants de blocs

Les blocs sont identifiés par `BlockId`, défini dans `src/types.ts`.

Exemples de catégories :

- terrain : grass, dirt, stone, sand ;
- liquides : water, lava ;
- neige/glace ;
- minerais ;
- troncs ;
- feuilles ;
- planches ;
- blocs décoratifs ;
- végétation ;
- laines.

Important : `BlockId` est également défini côté Rust dans `wasm/src/lib.rs`. Les valeurs numériques doivent rester strictement synchronisées.

## Définitions de blocs

Les blocs sont regroupés dans `src/blocks/` :

```txt
src/blocks/
├── decorative-blocks.ts
├── index.ts
├── natural-blocks.ts
├── ore-blocks.ts
├── plant-blocks.ts
├── terrain-blocks.ts
├── tree-blocks.ts
├── types.ts
└── wool-blocks.ts
```

`src/blocks/index.ts` agrège toutes les définitions :

```ts
export const blockDefinitions: BlockDefinition[] = [
  ...terrainBlockDefinitions,
  ...naturalBlockDefinitions,
  ...oreBlockDefinitions,
  ...treeBlockDefinitions,
  ...decorativeBlockDefinitions,
  ...plantBlockDefinitions,
  ...woolBlockDefinitions,
];
```

## Structure d'une définition de bloc

Une définition de bloc peut contenir :

- `id` : identifiant `BlockId` ;
- `name` : nom anglais ;
- `frenchName` : nom français ;
- `color` : couleur fallback RGBA ;
- `solid` : indique si le bloc bloque le joueur ;
- `transparentForMeshing` : indique si les faces voisines doivent être visibles ;
- `visualHeight` : hauteur visuelle différente de 1 pour certains blocs ;
- `textures` : textures procédurales par face.

## Textures procédurales

Les textures de blocs sont décrites sous forme de matrices 16x16.

Une texture contient :

- une palette de couleurs ;
- une matrice de caractères ;
- chaque caractère pointe vers une couleur de la palette.

Exemple conceptuel :

```ts
const texture = {
  palette: {
    A: [0.42, 0.27, 0.16, 1],
    B: [0.50, 0.34, 0.20, 1],
  },
  matrix: [
    "ABBA...",
    "BAAB...",
  ],
};
```

Ces matrices sont converties en atlas de texture par `block-atlas.ts`.

## Textures par face

Un bloc peut utiliser :

- une texture identique sur toutes les faces ;
- une texture différente pour le dessus ;
- une texture différente pour le dessous ;
- une texture différente sur les côtés.

Le bloc `GrassBlock`, par exemple, utilise un dessus herbeux et des côtés mélangeant herbe et terre.

## Solidité et transparence

Deux propriétés sont importantes :

### `solid`

Indique si le joueur ou un drop entre en collision avec le bloc.

### `transparentForMeshing`

Indique si une face voisine doit être rendue.

Un bloc peut être non solide mais visible, par exemple certaines plantes.

Un bloc peut être transparent pour le meshing afin que les faces voisines restent visibles.

## Hauteur visuelle

Certains blocs n'occupent pas visuellement toute la hauteur d'un bloc complet.

C'est notamment utilisé pour l'eau :

- collision et logique de bloc restent basées sur la grille ;
- rendu visuel peut utiliser une hauteur inférieure à 1.

`textured-world.ts` lit `visualHeight` pour générer la surface d'eau à la bonne hauteur.

## Items

Les items sont définis dans `src/items/` :

```txt
src/items/
├── block-items.ts
├── index.ts
├── rendering.ts
├── tool-items.ts
└── types.ts
```

`src/items/index.ts` agrège :

- les items de blocs ;
- les outils.

Chaque item peut définir :

- un identifiant ;
- une icône ;
- une taille maximale de stack.

## Relation blocs/items

Un bloc peut être manipulé comme item dans l'inventaire, mais ce n'est pas automatique au sens métier.

Pour qu'un bloc soit utilisable proprement :

1. il doit avoir un `BlockId` ;
2. il doit avoir une définition de bloc ;
3. il doit avoir une définition d'item si l'inventaire doit l'afficher correctement ;
4. il doit avoir une icône ou un rendu d'icône.

## Inventaire joueur

L'inventaire est stocké directement dans `PlayerPhysics` :

```ts
type PlayerPhysics = {
  inventory: InventoryItem[];
  selectedSlot: number;
};
```

Un item d'inventaire a la forme :

```ts
type InventoryItem = {
  blockId: BlockId;
  count: number;
};
```

La barre d'inventaire affiche 9 slots.

## Ajout à l'inventaire

Lorsqu'un drop est ramassé, `addToInventory(...)` ajoute l'item au joueur.

La logique doit respecter :

- le regroupement en stack ;
- la taille maximale de stack ;
- la mise à jour de l'UI si `_updateInventoryUI` est présent sur le joueur.

## Drops

Quand un bloc est détruit :

1. le bloc est remplacé par `Air` ;
2. le chunk est reconstruit ;
3. un drop est créé dans le monde ;
4. le drop tombe sous l'effet de la gravité ;
5. le joueur peut le ramasser après un court délai.

Les drops sont stockés dans un tableau `DroppedItem[]`.

Un drop contient :

- son `blockId` ;
- son mesh ou `TransformNode` ;
- sa vélocité ;
- sa date de création.

## Cas spécifique des poppies

Les poppies utilisent un modèle 3D pour certains rendus.

Lorsqu'une poppy est droppée :

- le système crée un `TransformNode` ;
- attache le modèle 3D de la poppy ;
- applique l'animation/rotation de drop comme pour les autres blocs.

## Craft

Le craft est géré par trois zones :

- `src/crafts/` : données de recettes ;
- `src/crafting-ui.ts` : interface et drag & drop ;
- `src/items/` : rendu des items dans les slots.

## Interface de craft

L'overlay de craft est créé via Babylon GUI.

Caractéristiques :

- overlay plein écran ;
- backdrop bloquant les interactions derrière ;
- panneau central ;
- grille 3x3 ;
- slot de résultat ;
- barre d'inventaire 9 slots ;
- preview de drag.

L'overlay utilise un `zIndex` élevé pour passer au-dessus des autres UI.

## Ouverture et fermeture du craft

Desktop :

- `E` ouvre/ferme le craft ;
- `Escape` ferme le craft.

Mobile :

- le bouton `Craft` déclenche un événement clavier synthétique `KeyE`.

Quand le craft est ouvert :

- le pointeur est déverrouillé si nécessaire ;
- les mouvements sont bloqués ;
- les contrôles mobiles sont reset ;
- les interactions de destruction sont annulées.

## Drag & drop

L'interface gère :

- drag depuis l'inventaire ;
- drag depuis la grille de craft ;
- drag depuis le slot de résultat ;
- drop vers la grille ;
- drop vers l'inventaire.

Règles :

- clic gauche : déplace 1 item ;
- clic droit : déplace le stack complet ;
- résultat récupéré : les ingrédients sont consommés ;
- fermeture de l'overlay : les items restants dans la grille retournent à l'inventaire.

## Matching de recette

Les recettes sont décrites sous forme de patterns.

L'UI lit la grille actuelle, cherche une recette correspondante, puis affiche ou masque le résultat.

Une recette doit être ajoutée dans le module `src/crafts/` plutôt que directement dans `crafting-ui.ts`.

## Ajouter un bloc complet

Pour ajouter un bloc complet au projet :

1. ajouter le `BlockId` côté TypeScript ;
2. ajouter le même `BlockId` côté Rust si le bloc doit être généré naturellement ;
3. créer ou modifier une définition dans `src/blocks/` ;
4. définir solidité, transparence, couleur et textures ;
5. ajouter l'item correspondant dans `src/items/` ;
6. ajouter une icône si nécessaire ;
7. ajouter une recette de craft si nécessaire ;
8. vérifier le rendu dans le monde, l'inventaire, les drops et le craft.

## Ajouter une recette

Pour ajouter une recette :

1. choisir les ingrédients ;
2. définir le pattern dans `src/crafts/` ;
3. définir le résultat ;
4. vérifier que tous les ingrédients ont des items valides ;
5. tester le drag & drop desktop et mobile ;
6. vérifier la consommation des ingrédients.

## Points d'attention

- Ne pas mettre de logique de recette directement dans l'UI.
- Ne pas supposer qu'un bloc a automatiquement une icône.
- Garder les `BlockId` synchronisés entre Rust et TypeScript.
- Vérifier `solid` avant de permettre le placement dans le joueur.
- Vérifier `transparentForMeshing` pour éviter des faces manquantes ou inutiles.
- Pour les blocs non cubiques, documenter `visualHeight` ou le rendu spécifique.
