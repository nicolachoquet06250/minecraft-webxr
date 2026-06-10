# Toggle Design - Options Menu

## Design Carré Style Minecraft

Les toggles dans le menu Options utilisent maintenant un design de switch carré inspiré de l'interface Minecraft, avec :

### Caractéristiques visuelles :

- **Dimension** : 60x28 pixels
- **Style carré** : Pas de border-radius, aspect pixelisé
- **Curseur** : Carré de 22x22 pixels qui glisse horizontalement
- **Texture** : Motif rayé repeating-linear-gradient pour l'effet Minecraft

### États :

#### OFF (Désactivé)
- **Fond** : Gris foncé (#6b6b6b → #5a5a5a)
- **Curseur** : Position gauche, gris moyen (#8a8a8a → #777)
- **Bordures** : Ombres internes pour effet enfoncé

#### ON (Activé)
- **Fond** : Vert (#4caf50 → #43a047)
- **Curseur** : Position droite, vert clair (#66bb6a → #4caf50)
- **Transition** : Animation fluide cubic-bezier(0.4, 0, 0.2, 1)

### Effets interactifs :

- **Hover** : Ombres plus prononcées sur le curseur
- **Active** : Légère réduction d'échelle (scale 0.96)
- **Transition** : 250ms pour le mouvement du curseur

### Accessibilité :

- `role="switch"` pour les lecteurs d'écran
- `aria-checked` indique l'état
- `aria-label` en français ("Activé"/"Désactivé")

### Usage :

Les toggles sont utilisés pour toutes les options booléennes :
- Plein écran
- Éclairage lissé
- Nuages
- Afficher FPS
- Afficher coordonnées

Le design est cohérent sur tous les modes (Desktop, Mobile, VR).
