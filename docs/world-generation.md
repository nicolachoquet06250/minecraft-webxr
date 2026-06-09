# Génération procédurale du monde

## Responsabilité de la génération

La génération procédurale est réalisée dans `wasm/src/lib.rs`, côté Rust. Le TypeScript demande uniquement la génération d'un chunk via la fonction exportée :

```rust
#[wasm_bindgen]
pub fn generate_chunk(chunk_x: i32, chunk_z: i32, seed: u32) -> Vec<u8>
```

La fonction retourne un tableau linéaire d'octets où chaque octet correspond à un `BlockId`.

## Dimensions de chunk

Les dimensions sont définies côté Rust :

```rust
const CHUNK_SIZE_X: usize = 16;
const CHUNK_SIZE_Y: usize = 96;
const CHUNK_SIZE_Z: usize = 16;
```

Elles sont exposées à TypeScript via :

```rust
pub fn chunk_size_x() -> usize
pub fn chunk_size_y() -> usize
pub fn chunk_size_z() -> usize
```

Le runtime TypeScript ne doit donc pas hardcoder ces dimensions pour la génération courante.

## Indexation dans un chunk

Les blocs sont stockés dans un tableau linéaire.

```rust
fn block_index(x: usize, y: usize, z: usize) -> usize {
    x + CHUNK_SIZE_X * (z + CHUNK_SIZE_Z * y)
}
```

Cette formule doit être identique côté TypeScript lorsque l'on lit ou modifie un bloc dans un `Uint8Array`.

## Seeds de bruit

La génération utilise plusieurs bruits de Perlin dérivés du `seed` principal :

```rust
let terrain_noise = Perlin::new(seed);
let detail_noise = Perlin::new(seed.wrapping_add(1));
let cave_noise = Perlin::new(seed.wrapping_add(2));
let biome_noise = Perlin::new(seed.wrapping_add(3));
let ore_noise = Perlin::new(seed.wrapping_add(4));
let decoration_noise = Perlin::new(seed.wrapping_add(5));
```

Chaque bruit a un rôle distinct :

- `terrain_noise` : grandes variations du terrain ;
- `detail_noise` : détails plus fins ;
- `cave_noise` : cavités souterraines ;
- `biome_noise` : température/humidité et choix du biome ;
- `ore_noise` : distribution des minerais ;
- `decoration_noise` : herbes, fleurs, cactus, neige, etc.

## Biomes

Trois biomes sont actuellement définis :

```rust
pub enum BiomeId {
    Plains,
    Desert,
    Snowy,
}
```

Le biome est choisi à partir de deux valeurs de bruit :

- température ;
- humidité.

Règles actuelles :

- température élevée et humidité faible => désert ;
- température faible => biome enneigé ;
- sinon => plaines.

## Hauteur de terrain

La hauteur est calculée par `terrain_height(...)`.

La formule combine :

- une composante continentale basse fréquence ;
- une composante de collines ;
- une composante de détails ;
- un modificateur de hauteur dépendant du biome ;
- un modificateur d'intensité des collines dépendant du biome.

Le résultat est clampé entre :

- `8` ;
- `CHUNK_SIZE_Y - 2`.

## Niveau de la mer

Le niveau de la mer est actuellement fixé à :

```rust
let sea_level = 42;
```

Lorsque `world_y > height` :

- si `world_y <= sea_level`, le bloc devient `Water` ;
- dans un biome enneigé, il peut devenir `Ice` ;
- sinon, le bloc devient `Air`.

## Génération des couches

Pour chaque colonne `(x, z)` du chunk, la génération parcourt tous les `y`.

### Au-dessus de la surface

`generate_above_surface_block(...)` retourne :

- `Water` sous le niveau de la mer ;
- `Ice` dans un biome enneigé sous le niveau de la mer ;
- `Air` au-dessus.

### Bloc de surface

`generate_surface_block_at_height(...)` choisit :

- `GrassBlock` en plaines ;
- `Sand` en désert ;
- `Snow` en biome enneigé.

Sous l'eau, le bloc de surface est adapté :

- plaines => `Stone` ;
- désert => `Sand` ;
- snowy => `Clay`.

### Sous-surface

`generate_subsurface_block_at_height(...)` choisit les blocs proches de la surface :

- plaines => `Dirt` ;
- désert => `Sandstone` ;
- snowy => `Dirt`.

Sous l'eau, la sous-surface suit les règles spécifiques au biome.

### Profondeur

`generate_deep_block(...)` choisit les blocs profonds.

Sous `y < 18` :

- minerais rares comme diamant, redstone et or selon le bruit ;
- sinon `Deepslate`.

Au-dessus :

- charbon ;
- fer ;
- cuivre ;
- sinon `Stone`.

## Grottes

Les grottes sont générées par `is_cave(...)`.

Un bloc sous la surface peut être remplacé par de l'air si :

- la valeur de bruit dépasse le seuil ;
- le bloc est suffisamment sous la surface ;
- `world_y > 8`.

Cela évite de creuser trop près du bas du monde ou trop proche de la surface.

## Décorations de surface

Après la génération terrain, une décoration peut être placée en `height + 1` si la position est au-dessus du niveau de la mer.

Selon le biome :

### Plaines

- `TallGrass` ;
- `Dandelion` ;
- `Poppy` ;
- ou rien.

### Désert

- `Cactus` ;
- `DeadBush` ;
- ou rien.

### Snowy

- `SnowBlock` ;
- ou rien.

## Génération des arbres

La génération des arbres est effectuée en deuxième passe.

Le code scanne une zone plus large que le chunk pour prendre en compte les feuillages qui débordent sur les chunks voisins.

Principe :

1. calcul de la position monde du chunk ;
2. scan d'une zone étendue ;
3. alignement sur une grille de cellules ;
4. vérification du biome ;
5. vérification de la hauteur et du bloc de surface ;
6. test de bruit ;
7. appel à `generate_tree(...)`.

Les arbres sont actuellement générés en plaines, au-dessus du niveau de la mer, sur une surface compatible.

## Variantes d'arbres

`generate_tree(...)` choisit une variante via un RNG déterministe :

- tronc 1x1 ;
- tronc 2x1 ;
- tronc 2x2.

La hauteur du tronc varie de 4 à 6 blocs.

Le feuillage est généré autour du tronc avec un rayon variable selon la hauteur de couche.

## Synchronisation TypeScript / Rust

L'énumération `BlockId` existe dans :

- `wasm/src/lib.rs` ;
- `src/types.ts`.

Les valeurs numériques doivent rester synchronisées.

Si un bloc est ajouté côté Rust mais absent côté TypeScript :

- le rendu peut utiliser une texture fallback ;
- les interactions peuvent être incohérentes ;
- l'inventaire peut ne pas afficher correctement l'item.

Si un bloc est ajouté côté TypeScript mais absent côté Rust :

- il peut être placé ou utilisé en inventaire ;
- mais il ne sera pas généré naturellement par le monde.

## Génération côté runtime

Dans TypeScript, la génération est appelée à deux moments :

### Initialisation

Le runtime génère tous les chunks autour du spawn selon `INITIAL_CHUNK_RADIUS`.

### Pendant le jeu

`ensureChunksAroundPlayer(...)` génère les chunks manquants autour de la position courante du joueur.

## Limites actuelles

- Les chunks lointains ne sont pas encore déchargés.
- La génération est synchrone côté appel TypeScript une fois le WASM chargé.
- Les dimensions du monde vertical sont limitées à 96 blocs.
- Les biomes sont simples et au nombre de trois.
- Les structures sont limitées aux arbres et décorations simples.

## Ajouter un biome

Pour ajouter un biome :

1. ajouter une variante dans `BiomeId` côté Rust ;
2. modifier `get_biome(...)` ;
3. définir ses règles dans :
   - `terrain_height(...)` ;
   - `generate_above_surface_block(...)` ;
   - `generate_surface_block(...)` ;
   - `generate_subsurface_block(...)` ;
   - `surface_decoration_block(...)` ;
4. ajouter les blocs nécessaires dans `BlockId` côté Rust et TypeScript ;
5. ajouter les définitions de blocs et textures côté TypeScript.

## Ajouter un bloc généré naturellement

Pour ajouter un bloc au monde procédural :

1. ajouter le `BlockId` dans Rust ;
2. ajouter le même `BlockId` dans TypeScript avec la même valeur ;
3. créer la définition du bloc dans `src/blocks/` ;
4. créer l'item associé si le bloc doit être manipulable ;
5. modifier la génération Rust pour le placer ;
6. vérifier son rendu, sa solidité, sa transparence et sa hauteur visuelle.
