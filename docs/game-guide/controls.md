[⬅️ Precedent](./crafts.md) | [Sommaire](./README.md)

---

# Controles desktop, mobile et VR

Cette page decrit les controles disponibles dans Minecraft WebXR selon le type d'appareil utilise.

## Desktop

| Action | Controle |
|--------|----------|
| Regarder autour de soi | Souris, quand le pointeur est capture par le jeu |
| Avancer | `Z` ou `W` selon le clavier |
| Reculer | `S` |
| Aller a gauche | `Q` ou `A` selon le clavier |
| Aller a droite | `D` |
| Sauter | `Espace` |
| Casser le bloc vise | Clic gauche maintenu jusqu'a la fin de l'animation de fissure |
| Poser le bloc selectionne | Clic droit |
| Selectionner un slot rapide | Clic sur l'inventaire ou touche numerique si disponible |
| Ouvrir / fermer le craft | Touche de craft definie dans le jeu |
| Sortir de la capture souris | `Echap` |

## Mobile

Les controles mobiles sont affiches dans l'interface Babylon GUI uniquement en mode mobile.

| Action | Controle |
|--------|----------|
| Se deplacer en avant / arriere | Joystick gauche vertical |
| Regarder autour de soi | Joystick droit circulaire |
| Sauter | Bouton de saut a droite, aligne avec l'inventaire |
| Selectionner un slot | Toucher le slot dans l'inventaire |
| Casser ou poser un bloc | Boutons d'action tactiles si disponibles dans l'interface courante |
| Ouvrir le craft | Bouton de craft mobile |

Quand l'interface de craft est ouverte, elle passe au-dessus des controles mobiles et les controles de jeu sont desactives pour eviter les actions involontaires.

## VR / WebXR

Le mode VR est experimental et cible principalement les casques compatibles WebXR, comme Meta Quest.

| Action | Controle |
|--------|----------|
| Entrer en VR | Bouton `ouvrir en VR` / entree WebXR du navigateur |
| Se deplacer | Joystick gauche de la manette |
| Tourner le corps du joueur | Joystick droit de la manette |
| Regarder autour de soi | Mouvement naturel du casque |
| Selectionner l'inventaire | Raycast de manette vers l'interface |
| Valider une selection | Trigger de manette |

L'ancien pointeur central n'est pas utilise en VR. L'inventaire VR est pense pour suivre le corps du joueur plutot que les mouvements de tete.

## Inventaire et craft

| Action | Desktop | Mobile | VR |
|--------|---------|--------|----|
| Selectionner un slot | Clic souris | Toucher le slot | Raycast + trigger |
| Manipuler le craft | Souris | Touch | Non prioritaire dans l'etat actuel |
| Voir le bloc vise | Nom affiche sous l'inventaire | Nom affiche sous l'inventaire | Non affiche via pointeur central |

## Remarques

- Les controles exacts peuvent evoluer avec les branches de developpement.
- Le mode VR est en transition vers un menu 2D proche du mode desktop avant lancement de la session immersive.
- Les controles VR directs ont ete volontairement simplifies pour laisser place au nouveau flux de lancement VR.

---

[⬅️ Precedent](./crafts.md) | [Sommaire](./README.md)
