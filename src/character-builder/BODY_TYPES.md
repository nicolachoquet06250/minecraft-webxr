# Différences entre les Types de Corps

## Comparaison Steve (Masculin) vs Alex (Féminin)

### Dimensions des Bras

| Type | Largeur (X) | Hauteur (Y) | Profondeur (Z) | Unités Minecraft |
|------|-------------|-------------|----------------|-------------------|
| **Masculin (Steve)** | 0.25 | 0.75 | 0.25 | 4×12×4 |
| **Féminin (Alex)** | 0.1875 | 0.75 | 0.25 | 3×12×4 |

### Position des Bras

| Type | Bras droit (X) | Bras gauche (X) |
|------|----------------|-----------------|
| **Masculin (Steve)** | -0.375 | +0.375 |
| **Féminin (Alex)** | -0.34375 | +0.34375 |

### Différence Visuelle

```
Steve (Masculin)              Alex (Féminin)
     ████                          ████
     ████                          ████
   ████████                      ████████
   ████████                      ████████
  ██      ██                    ███    ███
  ██      ██                    ███    ███
  ██      ██                    ███    ███
  ██      ██                    ███    ███
  ██      ██                    ███    ███
  ██      ██                    ███    ███
   ████████                      ████████
    ██  ██                        ██  ██
```

### Textures des Bras

#### Steve (4 pixels de large)
```typescript
rightArm: {
  front: tx(4, 12, [...]),  // 4 colonnes
  back: tx(4, 12, [...]),
  // ...
}
```

#### Alex (3 pixels de large)
```typescript
rightArm: {
  front: tx(3, 12, [...]),  // 3 colonnes
  back: tx(3, 12, [...]),
  // ...
}
```

### Parties Identiques

Les parties suivantes ont les **mêmes dimensions** pour les deux types :

- **Tête** : 8×8×8 (0.5 × 0.5 × 0.5)
- **Torse** : 8×12×4 (0.5 × 0.75 × 0.25)
- **Jambes** : 4×12×4 (0.25 × 0.75 × 0.25)

### Animations

Les animations sont **identiques** pour les deux types. Les mêmes animations de marche, minage et idle fonctionnent pour Steve et Alex.

## Quand utiliser quel type ?

### Type Masculin (Steve)
- Personnages robustes, guerriers
- Style classique Minecraft
- Bras larges pour un look plus imposant

### Type Féminin (Alex)
- Personnages élancés
- Style plus fin et gracieux
- Bras fins pour un look plus délicat

### Type Custom
- Proportions entièrement personnalisées
- Créatures non-humanoïdes
- Personnages avec des dimensions uniques
