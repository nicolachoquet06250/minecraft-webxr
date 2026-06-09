# Contrôles desktop, mobile et VR

## Vue d'ensemble

Le projet prend en charge trois familles de contrôles :

- desktop : clavier, souris, pointer lock ;
- mobile : joysticks et boutons tactiles via Babylon GUI ;
- VR : WebXR, contrôleurs, rayons et boutons.

Toutes les entrées modifient le même état joueur `PlayerPhysics` et interagissent avec le même monde `WorldChunks`.

## Détection desktop/mobile/VR

### Desktop

Le mode desktop correspond au cas par défaut quand le navigateur n'est pas détecté comme mobile et que WebXR n'est pas actif.

### Mobile

La détection mobile se fait dans `mobile-controls.ts`.

Critères :

- user agent mobile ;
- écran tactile ou pointer coarse ;
- exclusion des casques VR autonomes.

L'objectif est d'éviter qu'un casque Quest, qui expose souvent un user agent Android, soit traité comme un téléphone.

### VR

La détection VR combine :

- user agent de casque connu ;
- mode debug forcé ;
- support `navigator.xr.isSessionSupported("immersive-vr")`.

Le mode debug peut être activé par :

- paramètre d'URL `force_vr` ;
- `localStorage.force_vr = "1"`.

## Desktop

### Déplacement

Touches supportées :

| Action | Touches |
|--------|---------|
| Avancer | `Z`, `W`, `ArrowUp` |
| Reculer | `S`, `ArrowDown` |
| Gauche | `Q`, `A`, `ArrowLeft` |
| Droite | `D`, `ArrowRight` |
| Sauter | `Space` |

Les touches actives sont stockées dans `pressedKeys`.

### Regarder

La souris modifie `player.yaw` et `player.pitch` uniquement quand le pointeur est verrouillé sur le canvas.

Le clic gauche peut demander le verrouillage du pointeur si celui-ci n'est pas encore actif.

### Détruire

Clic gauche maintenu :

1. verrouille le pointeur si nécessaire ;
2. démarre la destruction progressive ;
3. maintient la progression tant que la cible reste identique ;
4. annule la destruction au relâchement.

### Placer

Clic droit :

- empêche le menu contextuel ;
- place le bloc sélectionné si le pointeur est verrouillé ;
- consomme 1 item du stack sélectionné.

### Craft

- `E` : ouvre ou ferme l'overlay de craft ;
- `Escape` : ferme l'overlay.

Lorsque le craft est ouvert, les mouvements et la destruction sont bloqués.

## Mobile

Les contrôles mobiles sont créés avec Babylon GUI dans `initializeMobileControls(...)`.

Ils ne sont initialisés que si `isMobileMode()` retourne `true`.

### Joystick de déplacement

Le joystick gauche contrôle les déplacements.

Il peut activer :

- `KeyW` pour avancer ;
- `KeyS` pour reculer ;
- `KeyA` pour aller à gauche ;
- `KeyD` pour aller à droite.

Le joystick utilise une zone morte :

```ts
MOVE_DEAD_ZONE = 0.18
```

La logique conserve uniquement l'axe dominant :

- mouvement vertical => avancer/reculer ;
- mouvement horizontal => déplacement latéral.

### Joystick de regard

Le joystick droit modifie :

- `player.yaw` ;
- `player.pitch`.

Il utilise :

```ts
LOOK_DEAD_ZONE = 0.08
LOOK_SPEED = 2.6
```

La mise à jour se fait dans `scene.onBeforeRenderObservable` pour obtenir un mouvement progressif.

### Bouton de saut

Le bouton de saut ajoute `Space` à `pressedKeys` au pointer down, puis le retire au pointer up/out.

### Bouton de destruction

Le bouton de destruction appelle `startBlockBreaking(...)`.

Au relâchement ou à la sortie du pointeur :

- `cancelBlockBreaking()` est appelé ;
- l'état visuel du bouton est restauré.

### Bouton de placement

Le bouton de placement appelle `placeBlock(...)` avec le contexte monde stocké sur le joueur.

### Bouton craft

Le bouton `Craft` déclenche un événement clavier synthétique :

```ts
window.dispatchEvent(new KeyboardEvent("keydown", {
  code: "KeyE",
  key: "e",
  bubbles: true,
  cancelable: true,
}));
```

Cela permet de réutiliser la même logique d'ouverture/fermeture que sur desktop.

### Blocage pendant le craft

Si le craft est ouvert :

- les joysticks sont reset ;
- les boutons sont reset ;
- la destruction est annulée ;
- les événements tactiles de gameplay sont ignorés.

## VR WebXR

Le support VR est dans `vr-mode.ts`.

Il est expérimental et dépend du navigateur, du casque et de la disponibilité WebXR.

### Activation

Le jeu crée une expérience WebXR via :

```ts
scene.createDefaultXRExperienceAsync({
  floorMeshes: [],
});
```

L'entrée en VR utilise :

```ts
enterXRAsync("immersive-vr", "local-floor")
```

### Contrôleurs

Les contrôleurs sont suivis via :

- `onControllerAddedObservable` ;
- `onControllerRemovedObservable`.

Le code stocke séparément :

- `leftController` ;
- `rightController`.

### Déplacement VR

Le déplacement utilise le joystick ou touchpad du contrôleur gauche.

Les axes sont lus via :

- `xr-standard-thumbstick` ;
- ou fallback `xr-standard-touchpad`.

Règles :

- axe Y négatif => avancer ;
- axe Y positif => reculer ;
- axe X négatif => gauche ;
- axe X positif => droite.

La direction est calculée à partir du yaw de la caméra XR.

### Collision VR

Le déplacement VR applique une collision horizontale séparée par axe :

1. tentative de déplacement X ;
2. si collision, annulation de X ;
3. tentative de déplacement Z ;
4. si collision, annulation de Z.

Cela limite les blocages lors de déplacements contre des murs ou coins.

### Saut VR

Le saut VR utilise le bouton `A` du contrôleur droit.

Le code teste plusieurs noms de composants :

- `a-button` ;
- `xr-standard-button-a` ;
- `button-a` ;
- `a`.

Le saut est appliqué uniquement si le joueur est au sol.

### Rotation VR

La fonction `handleRightJoystick(...)` retourne actuellement `bodyYaw` sans modification.

L'orientation vient donc principalement du suivi naturel du casque.

Les événements de yaw du corps existent pour synchroniser l'inventaire VR.

### Rayons VR

Chaque contrôleur peut fournir un rayon via :

```ts
getControllerRay(handedness)
```

Le rayon est validé seulement si le pointeur du contrôleur est visible.

Le rayon a une longueur de :

```ts
CONTROLLER_RAY_LENGTH = 3
```

### Triggers VR

La pression du trigger est détectée via :

- `xr-standard-trigger` ;
- ou fallback `trigger`.

Le trigger est considéré pressé si :

- `pressed === true` ;
- ou `value > 0.65`.

### Interactions monde en VR

- Trigger droit + rayon droit => destruction du bloc ciblé.
- Trigger gauche + rayon gauche => placement d'un bloc.

Le système réutilise les fonctions standards de destruction et placement avec `targetRay`.

### Inventaire VR

L'inventaire VR est initialisé par :

```ts
initializeVRInventoryBar(scene, player, webXRControls)
```

Il est conçu pour :

- être attaché au corps du joueur ;
- suivre le yaw du corps ;
- ne pas suivre directement les mouvements de tête ;
- être sélectionnable avec les rayons de contrôleurs.

### Priorité inventaire VR vs monde

Dans la boucle principale :

1. on récupère les rayons bruts ;
2. on demande à l'inventaire si le rayon pointe dessus ;
3. si oui, le rayon est mis à `null` pour les interactions monde ;
4. sinon, le rayon peut casser ou placer un bloc.

Cela évite une interaction accidentelle avec le monde à travers l'inventaire.

### Pointeur central en VR

Le pointeur central est masqué quand la VR est active.

```ts
crosshairUi.rootContainer.isVisible = !isWebXRActive;
```

## Gestion du focus et des annulations

Le système annule les actions continues dans plusieurs cas :

- relâchement du clic ;
- perte de focus de la fenêtre ;
- sortie du pointer lock ;
- ouverture du craft ;
- changement de cible de destruction.

## Ajouter un nouveau contrôle

Pour ajouter un contrôle :

1. identifier le device concerné ;
2. brancher l'entrée dans le module correspondant ;
3. modifier `pressedKeys` uniquement si l'action correspond à un mouvement existant ;
4. appeler une fonction métier partagée pour les interactions monde ;
5. prévoir l'annulation quand une UI bloquante est ouverte ;
6. tester desktop, mobile et VR si l'action est transversale.

## Bonnes pratiques

- Ne pas dupliquer la logique métier par device.
- Utiliser `targetRay` pour factoriser desktop/VR.
- Toujours vérifier `isCraftingOverlayOpen()` avant une action gameplay.
- Toujours reset les états tactiles au pointer up/out.
- Ne pas supposer que tous les contrôleurs VR exposent les mêmes noms de composants.
- Ne pas traiter un casque Quest comme un mobile classique malgré son user agent Android.
