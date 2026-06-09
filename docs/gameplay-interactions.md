[⬅️ Précédent](./rendering-and-effects.md) | [Sommaire](./README.md) | [Suivant ➡️](./character-system.md)

---

# Interactions de gameplay

Cette page documente les interactions du jeu Minecraft WebXR.

## Vue d'ensemble

Les interactions partent d'une source d'entrée différente selon le device, mais elles convergent vers la même logique de ciblage et de modification du monde.

```mermaid
flowchart TD
  Desktop[Desktop\nsouris + clavier]
  Mobile[Mobile\njoysticks + touch]
  VR[VR\nmanettes + casque]
  Ray[Rayon d'interaction]
  Target[Bloc cible]
  Action{Action}
  Break[Casser bloc]
  Place[Poser bloc]
  Select[Selection inventaire]
  World[Mettre a jour monde]
  UI[Mettre a jour UI]

  Desktop --> Ray
  Mobile --> Ray
  VR --> Ray
  Ray --> Target --> Action
  Action --> Break --> World
  Action --> Place --> World
  Action --> Select --> UI
```

## Ciblage de bloc

Le jeu determine le bloc vise a partir d'un rayon. En desktop et mobile, ce rayon part du centre de l'ecran. En VR, il peut venir d'une manette.

```mermaid
sequenceDiagram
  participant Input as Source input
  participant Ray as Raycast
  participant World as Monde / chunks
  participant UI as UI

  Input->>Ray: construire rayon
  Ray->>World: chercher premier bloc touche
  World-->>Ray: bloc cible + face
  Ray-->>UI: nom du bloc vise
```

## Casser un bloc

La casse utilise une progression de breaking. Le bloc n'est retire qu'a la fin du temps de casse defini pour son type.

```mermaid
stateDiagram-v2
  [*] --> AucunBloc
  AucunBloc --> BlocVise: rayon touche un bloc
  BlocVise --> Breaking: clic maintenu
  Breaking --> BlocVise: clic relache avant fin
  Breaking --> BlocCasse: progression complete
  BlocCasse --> DropCree
  DropCree --> [*]
```

## Poser un bloc

Le placement utilise le slot selectionne, la face visee et les tests de collision pour eviter de poser un bloc dans le joueur ou dans un espace invalide.

```mermaid
flowchart TD
  Slot[Slot selectionne]
  Face[Face du bloc vise]
  Candidate[Position candidate]
  Collision{Collision joueur ?}
  Valid{Bloc placable ?}
  Place[Ajouter bloc au monde]
  Rebuild[Reconstruire chunk]

  Slot --> Candidate
  Face --> Candidate
  Candidate --> Collision
  Collision -->|oui| Valid
  Collision -->|non| Valid
  Valid -->|non| Candidate
  Valid -->|oui| Place --> Rebuild
```

## Inventaire et UI

L'inventaire conserve l'etat gameplay, tandis que Babylon GUI sert uniquement de representation interactive.

```mermaid
flowchart LR
  Inventory[Etat inventaire joueur]
  GUI[Slots Babylon GUI]
  Input[Clic / touch / trigger]
  Selected[Slot selectionne]
  Gameplay[Action gameplay]

  Inventory --> GUI
  Input --> GUI --> Selected --> Gameplay
  Gameplay --> Inventory
```

---

[⬅️ Précédent](./rendering-and-effects.md) | [Sommaire](./README.md) | [Suivant ➡️](./character-system.md)
