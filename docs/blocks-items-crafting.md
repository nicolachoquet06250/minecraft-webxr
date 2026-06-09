[⬅️ Précédent](./architecture.md) | [Sommaire](./README.md) | [Suivant ➡️](./gameplay-interactions.md)

---

# Blocs, items, inventaire et craft

## Vue d'ensemble

Le projet sépare les blocs, les items, les recettes de craft et les interfaces. Cette séparation permet d'ajouter du contenu sans mélanger rendu, inventaire et gameplay.

```mermaid
flowchart TD
  Blocks[src/blocks]
  Items[src/items]
  Crafts[src/crafts]
  Inventory[PlayerPhysics.inventory]
  InventoryUI[inventory-ui.ts]
  CraftUI[crafting-ui.ts]
  World[textured-world.ts]

  Blocks --> Items
  Blocks --> Crafts
  Items --> Inventory
  Crafts --> CraftUI
  Inventory --> InventoryUI
  InventoryUI --> World
  CraftUI --> Inventory
  World --> Items
```

## Blocs

Les blocs sont définis dans `src/blocks/` et agrégés dans `src/blocks/index.ts`.

Une définition contient notamment :

- un `BlockId` ;
- un nom anglais ;
- un nom français ;
- une couleur fallback ;
- un état solide ou transparent ;
- une hauteur visuelle optionnelle ;
- des textures procédurales par face.

```mermaid
classDiagram
  class BlockDefinition {
    BlockId id
    string name
    string frenchName
    RGBAColor color
    boolean solid
    boolean transparentForMeshing
    number visualHeight
    BlockTextures textures
  }

  class BlockTextureDefinition {
    palette
    matrix
  }

  BlockDefinition --> BlockTextureDefinition : textures par face
```

## Items

Les items sont définis dans `src/items/`. Tous les blocs sauf `Air` ont un item associé. Les blocs ont un stack maximum de 64, tandis que les outils peuvent définir une limite différente.

## Inventaire

L'inventaire est porté par le joueur via `PlayerPhysics`. Il stocke les stacks et le slot sélectionné. L'UI d'inventaire affiche les items et permet la sélection.

```mermaid
flowchart LR
  Player[PlayerPhysics]
  Inventory[Inventory stacks]
  Selected[Slot selectionne]
  UI[Inventaire Babylon GUI]
  Actions[Actions utilisateur]

  Player --> Inventory
  Player --> Selected
  Inventory --> UI
  Selected --> UI
  Actions --> UI --> Player
```

## Drops

Quand un bloc est cassé, un drop est créé dans le monde. Il tombe, rebondit légèrement, puis peut être ramassé automatiquement par le joueur après un court délai.

```mermaid
stateDiagram-v2
  [*] --> BlocPlace
  BlocPlace --> Breaking: clic maintenu
  Breaking --> DropCree: bloc casse
  DropCree --> Tombe: gravite
  Tombe --> Ramassable: delai ecoule
  Ramassable --> Inventaire: collision joueur
  Inventaire --> [*]
```

## Craft

Le craft utilise une grille 3x3, un slot de résultat et une barre d'inventaire. Les recettes sont déclarées dans `src/crafts/` sous forme de patterns.

```mermaid
flowchart TD
  Grid[Grille 3x3]
  Recipes[Recettes src/crafts]
  Match{Pattern reconnu}
  Result[Slot resultat]
  Consume[Consommation ingredients]
  Inventory[Retour inventaire]

  Grid --> Recipes --> Match
  Match -->|oui| Result
  Match -->|non| Grid
  Result --> Consume --> Inventory
```

## Règles actuelles

- Clic gauche dans le craft : déplacer 1 item.
- Clic droit : déplacer le stack complet.
- Récupérer le résultat consomme les ingrédients.
- Fermer le craft renvoie les ingrédients restants à l'inventaire.

## Ajout de contenu

Pour ajouter un bloc complet : ajouter le `BlockId`, la définition de bloc, l'item, les textures, éventuellement la génération Rust et les recettes.

```mermaid
flowchart LR
  Id[Ajouter BlockId]
  Def[Ajouter definition de bloc]
  Item[Ajouter item associe]
  Texture[Ajouter texture / matrice]
  Rust[Ajouter generation Rust si naturel]
  Craft[Ajouter recette si craftable]
  Docs[Mettre a jour documentation]

  Id --> Def --> Item --> Texture
  Texture --> Rust
  Texture --> Craft
  Rust --> Docs
  Craft --> Docs
```

---

[⬅️ Précédent](./architecture.md) | [Sommaire](./README.md) | [Suivant ➡️](./gameplay-interactions.md)
