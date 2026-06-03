#[cfg(test)]
mod tests {
    use crate::*;
    use noise::Perlin;

    #[test]
    fn chunk_dimensions_are_valid() {
        assert_eq!(chunk_size_x(), 16);
        assert_eq!(chunk_size_y(), 96);
        assert_eq!(chunk_size_z(), 16);
    }

    #[test]
    fn generated_chunk_has_expected_size() {
        let chunk = generate_chunk(0, 0, 12345);

        assert_eq!(
            chunk.len(),
            CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z
        );
    }

    #[test]
    fn generated_chunk_is_deterministic_for_same_seed_and_position() {
        let chunk_a = generate_chunk(0, 0, 12345);
        let chunk_b = generate_chunk(0, 0, 12345);

        assert_eq!(chunk_a, chunk_b);
    }

    #[test]
    fn generated_chunk_changes_with_different_seed() {
        let chunk_a = generate_chunk(0, 0, 12345);
        let chunk_b = generate_chunk(0, 0, 54321);

        assert_ne!(chunk_a, chunk_b);
    }

    #[test]
    fn generated_chunk_changes_with_different_chunk_coordinates() {
        let chunk_a = generate_chunk(0, 0, 12345);
        let chunk_b = generate_chunk(1, 0, 12345);
        let chunk_c = generate_chunk(0, 1, 12345);

        assert_ne!(chunk_a, chunk_b);
        assert_ne!(chunk_a, chunk_c);
    }

    #[test]
    fn generated_chunk_contains_valid_block_ids_only() {
        let chunk = generate_chunk(0, 0, 12345);

        for block in chunk {
            assert!(
                block <= BlockId::BlackWool as u8,
                "Invalid block id found: {}",
                block
            );
        }
    }

    #[test]
    fn generated_chunk_contains_some_solid_blocks() {
        let chunk = generate_chunk(0, 0, 12345);

        let solid_blocks_count = chunk
            .iter()
            .filter(|&&block| {
                block != BlockId::Air as u8
                    && block != BlockId::Water as u8
                    && block != BlockId::Lava as u8
            })
            .count();

        assert!(
            solid_blocks_count > 0,
            "The generated chunk should contain at least some solid blocks"
        );
    }

    #[test]
    fn generated_chunk_contains_some_air_blocks() {
        let chunk = generate_chunk(0, 0, 12345);

        let air_blocks_count = chunk
            .iter()
            .filter(|&&block| block == BlockId::Air as u8)
            .count();

        assert!(
            air_blocks_count > 0,
            "The generated chunk should contain at least some air blocks"
        );
    }

    #[test]
    fn generated_chunk_contains_surface_blocks_somewhere() {
        let mut surface_count = 0;

        for chunk_x in -2..=2 {
            for chunk_z in -2..=2 {
                let chunk = generate_chunk(chunk_x, chunk_z, 12345);

                surface_count += chunk
                    .iter()
                    .filter(|&&block| {
                        block == BlockId::GrassBlock as u8
                            || block == BlockId::Sand as u8
                            || block == BlockId::Snow as u8
                    })
                    .count();
            }
        }

        assert!(
            surface_count > 0,
            "Generated chunks should contain biome surface blocks"
        );
    }

    #[test]
    fn block_index_is_correct_for_origin() {
        assert_eq!(block_index(0, 0, 0), 0);
    }

    #[test]
    fn block_index_is_correct_for_x_axis() {
        assert_eq!(block_index(1, 0, 0), 1);
        assert_eq!(block_index(15, 0, 0), 15);
    }

    #[test]
    fn block_index_is_correct_for_z_axis() {
        assert_eq!(block_index(0, 0, 1), CHUNK_SIZE_X);
        assert_eq!(block_index(0, 0, 15), CHUNK_SIZE_X * 15);
    }

    #[test]
    fn block_index_is_correct_for_y_axis() {
        assert_eq!(
            block_index(0, 1, 0),
            CHUNK_SIZE_X * CHUNK_SIZE_Z
        );

        assert_eq!(
            block_index(0, 95, 0),
            CHUNK_SIZE_X * CHUNK_SIZE_Z * 95
        );
    }

    #[test]
    fn block_index_is_correct_for_last_block() {
        let last_index = block_index(
            CHUNK_SIZE_X - 1,
            CHUNK_SIZE_Y - 1,
            CHUNK_SIZE_Z - 1,
        );

        assert_eq!(
            last_index,
            CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z - 1
        );
    }

    #[test]
    fn biome_generation_is_deterministic() {
        let biome_noise = Perlin::new(12348);

        let biome_a = get_biome(128, -256, &biome_noise);
        let biome_b = get_biome(128, -256, &biome_noise);

        assert_eq!(biome_a, biome_b);
    }

    #[test]
    fn biome_generation_returns_known_biomes() {
        let biome_noise = Perlin::new(12348);

        for x in (-1024..=1024).step_by(64) {
            for z in (-1024..=1024).step_by(64) {
                let biome = get_biome(x, z, &biome_noise);

                assert!(
                    matches!(
                        biome,
                        BiomeId::Plains | BiomeId::Desert | BiomeId::Snowy
                    ),
                    "Unknown biome generated"
                );
            }
        }
    }

    #[test]
    fn terrain_height_is_inside_chunk_bounds_for_all_biomes() {
        let terrain_noise = Perlin::new(12345);
        let detail_noise = Perlin::new(12346);

        let biomes = [
            BiomeId::Plains,
            BiomeId::Desert,
            BiomeId::Snowy,
        ];

        for biome in biomes {
            for x in (-256..=256).step_by(16) {
                for z in (-256..=256).step_by(16) {
                    let height = terrain_height(
                        x,
                        z,
                        biome,
                        &terrain_noise,
                        &detail_noise,
                    );

                    assert!(
                        height >= 8,
                        "Terrain height should not be lower than 8, got {}",
                        height
                    );

                    assert!(
                        height <= CHUNK_SIZE_Y as i32 - 2,
                        "Terrain height should not exceed chunk height, got {}",
                        height
                    );
                }
            }
        }
    }

    #[test]
    fn terrain_height_is_deterministic() {
        let terrain_noise = Perlin::new(12345);
        let detail_noise = Perlin::new(12346);

        let height_a = terrain_height(
            42,
            -17,
            BiomeId::Plains,
            &terrain_noise,
            &detail_noise,
        );

        let height_b = terrain_height(
            42,
            -17,
            BiomeId::Plains,
            &terrain_noise,
            &detail_noise,
        );

        assert_eq!(height_a, height_b);
    }

    #[test]
    fn surface_block_matches_biome() {
        assert_eq!(
            generate_surface_block(BiomeId::Plains),
            BlockId::GrassBlock
        );

        assert_eq!(
            generate_surface_block(BiomeId::Desert),
            BlockId::Sand
        );

        assert_eq!(
            generate_surface_block(BiomeId::Snowy),
            BlockId::Snow
        );
    }

    #[test]
    fn subsurface_block_matches_biome() {
        assert_eq!(
            generate_subsurface_block(BiomeId::Plains),
            BlockId::Dirt
        );

        assert_eq!(
            generate_subsurface_block(BiomeId::Desert),
            BlockId::Sandstone
        );

        assert_eq!(
            generate_subsurface_block(BiomeId::Snowy),
            BlockId::Dirt
        );
    }

    #[test]
    fn above_surface_block_generates_water_below_sea_level() {
        assert_eq!(
            generate_above_surface_block(40, 42, BiomeId::Plains),
            BlockId::Water
        );

        assert_eq!(
            generate_above_surface_block(42, 42, BiomeId::Desert),
            BlockId::Water
        );
    }

    #[test]
    fn above_surface_block_generates_ice_in_snowy_biome_below_sea_level() {
        assert_eq!(
            generate_above_surface_block(40, 42, BiomeId::Snowy),
            BlockId::Ice
        );

        assert_eq!(
            generate_above_surface_block(42, 42, BiomeId::Snowy),
            BlockId::Ice
        );
    }

    #[test]
    fn above_surface_block_generates_air_above_sea_level() {
        assert_eq!(
            generate_above_surface_block(43, 42, BiomeId::Plains),
            BlockId::Air
        );

        assert_eq!(
            generate_above_surface_block(80, 42, BiomeId::Snowy),
            BlockId::Air
        );
    }

    #[test]
    fn underground_block_generates_surface_at_exact_height() {
        let ore_noise = Perlin::new(12349);

        assert_eq!(
            generate_underground_block(
                0,
                50,
                0,
                50,
                42,
                BiomeId::Plains,
                &ore_noise,
            ),
            BlockId::GrassBlock
        );

        assert_eq!(
            generate_underground_block(
                0,
                50,
                0,
                50,
                42,
                BiomeId::Desert,
                &ore_noise,
            ),
            BlockId::Sand
        );

        assert_eq!(
            generate_underground_block(
                0,
                50,
                0,
                50,
                42,
                BiomeId::Snowy,
                &ore_noise,
            ),
            BlockId::Snow
        );
    }

    #[test]
    fn underground_block_generates_snow_block_below_snowy_surface() {
        let ore_noise = Perlin::new(12349);

        let block = generate_underground_block(
            0,
            49,
            0,
            50,
            42,
            BiomeId::Snowy,
            &ore_noise,
        );

        assert_eq!(block, BlockId::SnowBlock);
    }

    #[test]
    fn underground_block_generates_subsurface_blocks_near_surface() {
        let ore_noise = Perlin::new(12349);

        assert_eq!(
            generate_underground_block(
                0,
                48,
                0,
                50,
                42,
                BiomeId::Plains,
                &ore_noise,
            ),
            BlockId::Dirt
        );

        assert_eq!(
            generate_underground_block(
                0,
                48,
                0,
                50,
                42,
                BiomeId::Desert,
                &ore_noise,
            ),
            BlockId::Sandstone
        );
    }

    #[test]
    fn deep_block_generation_returns_valid_blocks_above_deepslate_layer() {
        let ore_noise = Perlin::new(12349);

        for x in -16..=16 {
            for z in -16..=16 {
                let block = generate_deep_block(x, 32, z, &ore_noise);

                assert!(
                    matches!(
                        block,
                        BlockId::Stone
                            | BlockId::CoalOre
                            | BlockId::IronOre
                            | BlockId::CopperOre
                    ),
                    "Unexpected deep block above deepslate layer: {:?}",
                    block
                );
            }
        }
    }

    #[test]
    fn deep_block_generation_returns_valid_blocks_in_deepslate_layer() {
        let ore_noise = Perlin::new(12349);

        for x in -16..=16 {
            for z in -16..=16 {
                let block = generate_deep_block(x, 8, z, &ore_noise);

                assert!(
                    matches!(
                        block,
                        BlockId::Deepslate
                            | BlockId::DiamondOre
                            | BlockId::RedstoneOre
                            | BlockId::GoldOre
                    ),
                    "Unexpected deep block in deepslate layer: {:?}",
                    block
                );
            }
        }
    }

    #[test]
    fn ore_value_is_inside_noise_range() {
        let ore_noise = Perlin::new(12349);

        for x in (-128..=128).step_by(16) {
            for y in (0..=64).step_by(8) {
                for z in (-128..=128).step_by(16) {
                    let value = ore_value(x, y, z, &ore_noise);

                    assert!(
                        (-1.0..=1.0).contains(&value),
                        "Ore noise value should be inside [-1, 1], got {}",
                        value
                    );
                }
            }
        }
    }

    #[test]
    fn cave_generation_is_deterministic() {
        let cave_noise = Perlin::new(12347);

        let value_a = is_cave(32, 24, -64, &cave_noise);
        let value_b = is_cave(32, 24, -64, &cave_noise);

        assert_eq!(value_a, value_b);
    }

    #[test]
    fn generated_water_or_ice_is_below_or_at_sea_level() {
        let chunk = generate_chunk(0, 0, 12345);
        let sea_level = 42;

        for y in 0..CHUNK_SIZE_Y {
            for z in 0..CHUNK_SIZE_Z {
                for x in 0..CHUNK_SIZE_X {
                    let block = chunk[block_index(x, y, z)];

                    if block == BlockId::Water as u8 || block == BlockId::Ice as u8 {
                        assert!(
                            y as i32 <= sea_level,
                            "Water or ice should only exist below or at sea level"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn top_of_chunk_should_not_contain_solid_terrain_blocks() {
        let chunk = generate_chunk(0, 0, 12345);
        let top_y = CHUNK_SIZE_Y - 1;

        for z in 0..CHUNK_SIZE_Z {
            for x in 0..CHUNK_SIZE_X {
                let block = chunk[block_index(x, top_y, z)];

                assert_eq!(
                    block,
                    BlockId::Air as u8,
                    "The top layer should be air"
                );
            }
        }
    }

    #[test]
    fn bottom_of_chunk_should_contain_solid_blocks() {
        let chunk = generate_chunk(0, 0, 12345);
        let bottom_y = 0;

        for z in 0..CHUNK_SIZE_Z {
            for x in 0..CHUNK_SIZE_X {
                let block = chunk[block_index(x, bottom_y, z)];

                assert_ne!(
                    block,
                    BlockId::Air as u8,
                    "The bottom layer should not be air"
                );

                assert_ne!(
                    block,
                    BlockId::Water as u8,
                    "The bottom layer should not be water"
                );

                assert_ne!(
                    block,
                    BlockId::Ice as u8,
                    "The bottom layer should not be ice"
                );
            }
        }
    }

    #[test]
    fn biome_generation_can_produce_all_main_biomes_over_large_area() {
        let biome_noise = Perlin::new(12348);

        let mut has_plains = false;
        let mut has_desert = false;
        let mut has_snowy = false;

        for x in (-20_000..=20_000).step_by(512) {
            for z in (-20_000..=20_000).step_by(512) {
                match get_biome(x, z, &biome_noise) {
                    BiomeId::Plains => has_plains = true,
                    BiomeId::Desert => has_desert = true,
                    BiomeId::Snowy => has_snowy = true,
                }

                if has_plains && has_desert && has_snowy {
                    return;
                }
            }
        }

        assert!(has_plains, "Expected at least one plains biome");
        assert!(has_desert, "Expected at least one desert biome");
        assert!(has_snowy, "Expected at least one snowy biome");
    }

    #[test]
    fn test_tree_generation_rules() {
        let mut blocks = vec![0u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];
        let seed = 12345;
        // On place l'arbre au milieu pour éviter les bords de chunk
        let x = 8;
        let y = 10;
        let z = 8;
        
        generate_tree(x as i32, y as i32, z as i32, &mut blocks, seed, x as i32, z as i32);
        
        // Trouver le tronc
        let mut min_tx = CHUNK_SIZE_X as i32;
        let mut max_tx = 0;
        let mut min_tz = CHUNK_SIZE_Z as i32;
        let mut max_tz = 0;
        let mut trunk_height = 0;
        
        let mut found_trunk = false;
        for ty in y..CHUNK_SIZE_Y {
            let mut found_in_layer = false;
            for tx in 0..CHUNK_SIZE_X {
                for tz in 0..CHUNK_SIZE_Z {
                    if blocks[block_index(tx, ty, tz)] == BlockId::OakLog as u8 {
                        found_trunk = true;
                        found_in_layer = true;
                        if (tx as i32) < min_tx { min_tx = tx as i32; }
                        if (tx as i32) > max_tx { max_tx = tx as i32; }
                        if (tz as i32) < min_tz { min_tz = tz as i32; }
                        if (tz as i32) > max_tz { max_tz = tz as i32; }
                    }
                }
            }
            if found_in_layer {
                trunk_height += 1;
            } else if found_trunk {
                break;
            }
        }
        
        assert!(found_trunk, "Aucun tronc généré");
        let tw = max_tx - min_tx + 1;
        let td = max_tz - min_tz + 1;
        
        // Règle 1 : Tronc 1x1, 2x1 ou 2x2
        assert!((tw == 1 && td == 1) || (tw == 2 && td == 1) || (tw == 1 && td == 2) || (tw == 2 && td == 2), 
                "Dimensions du tronc invalides : {}x{}", tw, td);
        
        // Règle 2 : Feuillage au dessus
        for tx in min_tx..=max_tx {
            for tz in min_tz..=max_tz {
                let above = blocks[block_index(tx as usize, (y + trunk_height) as usize, tz as usize)];
                assert_eq!(above, BlockId::OakLeaves as u8, "Manque feuillage au dessus du tronc à {},{}", tx, tz);
            }
        }
        
        // Règle 2 : Feuillage sur chaque côté
        // On vérifie que pour chaque bloc de tronc, il y a au moins un bloc de feuillage adjacent sur les côtés (N, S, E, O)
        // La règle dit "au moins 1 bloc de chaque côté ET au dessus" pour L'ARBRE (la structure).
        // Interprétation : l'arbre doit avoir du feuillage sur ses 4 côtés horizontaux.
        
        let mut has_north = false;
        let mut has_south = false;
        let mut has_east = false;
        let mut has_west = false;
        
        for ty in y..y+trunk_height {
            for tx in min_tx..=max_tx {
                for tz in min_tz..=max_tz {
                    // Vérifier voisins
                    if blocks[block_index((tx + 1) as usize, ty as usize, tz as usize)] == BlockId::OakLeaves as u8 { has_east = true; }
                    if tx > 0 && blocks[block_index((tx - 1) as usize, ty as usize, tz as usize)] == BlockId::OakLeaves as u8 { has_west = true; }
                    if blocks[block_index(tx as usize, ty as usize, (tz + 1) as usize)] == BlockId::OakLeaves as u8 { has_south = true; }
                    if tz > 0 && blocks[block_index(tx as usize, ty as usize, (tz - 1) as usize)] == BlockId::OakLeaves as u8 { has_north = true; }
                }
            }
        }
        
        assert!(has_north, "Manque feuillage au Nord");
        assert!(has_south, "Manque feuillage au Sud");
        assert!(has_east, "Manque feuillage à l'Est");
        assert!(has_west, "Manque feuillage à l'Ouest");
    }

    #[test]
    fn test_tree_generation_rules_many_seeds() {
        for s in 0..100 {
            let mut blocks = vec![0u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];
            let seed = 12345 + s;
            let x = 8;
            let y = 10;
            let z = 8;
            
            generate_tree(x as i32, y as i32, z as i32, &mut blocks, seed, x as i32, z as i32);
            
            let mut min_tx = CHUNK_SIZE_X as i32;
            let mut max_tx = 0;
            let mut min_tz = CHUNK_SIZE_Z as i32;
            let mut max_tz = 0;
            let mut trunk_height = 0;
            
            let mut found_trunk = false;
            for ty in y..CHUNK_SIZE_Y {
                let mut found_in_layer = false;
                for tx in 0..CHUNK_SIZE_X {
                    for tz in 0..CHUNK_SIZE_Z {
                        if blocks[block_index(tx, ty, tz)] == BlockId::OakLog as u8 {
                            found_trunk = true;
                            found_in_layer = true;
                            if (tx as i32) < min_tx { min_tx = tx as i32; }
                            if (tx as i32) > max_tx { max_tx = tx as i32; }
                            if (tz as i32) < min_tz { min_tz = tz as i32; }
                            if (tz as i32) > max_tz { max_tz = tz as i32; }
                        }
                    }
                }
                if found_in_layer {
                    trunk_height += 1;
                } else if found_trunk {
                    break;
                }
            }
            
            assert!(found_trunk, "Seed {}: Aucun tronc généré", seed);
            let tw = max_tx - min_tx + 1;
            let td = max_tz - min_tz + 1;
            
            assert!((tw == 1 && td == 1) || (tw == 2 && td == 1) || (tw == 1 && td == 2) || (tw == 2 && td == 2), 
                    "Seed {}: Dimensions du tronc invalides : {}x{}", seed, tw, td);
            
            for tx in min_tx..=max_tx {
                for tz in min_tz..=max_tz {
                    let above = blocks[block_index(tx as usize, (y + trunk_height) as usize, tz as usize)];
                    assert_eq!(above, BlockId::OakLeaves as u8, "Seed {}: Manque feuillage au dessus du tronc à {},{}", seed, tx, tz);
                }
            }
            
            let mut has_north = false;
            let mut has_south = false;
            let mut has_east = false;
            let mut has_west = false;
            
            for ty in y..y+trunk_height {
                for tx in min_tx..=max_tx {
                    for tz in min_tz..=max_tz {
                        if blocks[block_index((tx + 1) as usize, ty as usize, tz as usize)] == BlockId::OakLeaves as u8 { has_east = true; }
                        if tx > 0 && blocks[block_index((tx - 1) as usize, ty as usize, tz as usize)] == BlockId::OakLeaves as u8 { has_west = true; }
                        if blocks[block_index(tx as usize, ty as usize, (tz + 1) as usize)] == BlockId::OakLeaves as u8 { has_south = true; }
                        if tz > 0 && blocks[block_index(tx as usize, ty as usize, (tz - 1) as usize)] == BlockId::OakLeaves as u8 { has_north = true; }
                    }
                }
            }
            
            assert!(has_north, "Seed {}: Manque feuillage au Nord", seed);
            assert!(has_south, "Seed {}: Manque feuillage au Sud", seed);
            assert!(has_east, "Seed {}: Manque feuillage à l'Est", seed);
            assert!(has_west, "Seed {}: Manque feuillage à l'Ouest", seed);
        }
    }

    #[test]
    fn test_tree_trunk_2x2_is_solid() {
        // On cherche une graine qui produit un arbre 2x2
        let mut seed_2x2 = None;
        for s in 0..100 {
            let mut blocks = vec![0u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];
            let seed = 12345 + s;
            generate_tree(8, 10, 8, &mut blocks, seed, 8, 8);
            
            let mut logs = 0;
            for ty in 10..20 {
                for tx in 0..CHUNK_SIZE_X {
                    for tz in 0..CHUNK_SIZE_Z {
                        if blocks[block_index(tx, ty, tz)] == BlockId::OakLog as u8 {
                            logs += 1;
                        }
                    }
                }
            }
            
            // Un tronc 2x2 de hauteur 4-6 devrait avoir entre 16 et 24 logs
            // Un tronc 1x1 : 4-6 logs
            // Un tronc 2x1 : 8-12 logs
            if logs >= 16 {
                seed_2x2 = Some(seed);
                break;
            }
        }
        
        let seed = seed_2x2.expect("Aucun arbre 2x2 trouvé dans les 100 premières graines");
        let mut blocks = vec![0u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];
        let x = 8;
        let y = 10;
        let z = 8;
        generate_tree(x as i32, y as i32, z as i32, &mut blocks, seed, x as i32, z as i32);
        
        // Vérifier que c'est bien un 2x2
        let mut min_tx = CHUNK_SIZE_X;
        let mut max_tx = 0;
        let mut min_tz = CHUNK_SIZE_Z;
        let mut max_tz = 0;
        let mut trunk_height = 0;
        
        for ty in y..CHUNK_SIZE_Y as i32 {
            let mut found_in_layer = false;
            for tx in 0..CHUNK_SIZE_X as i32 {
                for tz in 0..CHUNK_SIZE_Z as i32 {
                    if blocks[block_index(tx as usize, ty as usize, tz as usize)] == BlockId::OakLog as u8 {
                        found_in_layer = true;
                        if tx < min_tx as i32 { min_tx = tx as usize; }
                        if tx > max_tx as i32 { max_tx = tx as usize; }
                        if tz < min_tz as i32 { min_tz = tz as usize; }
                        if tz > max_tz as i32 { max_tz = tz as usize; }
                    }
                }
            }
            if found_in_layer { trunk_height += 1; }
            else if trunk_height > 0 { break; }
        }
        
        let tw = max_tx - min_tx + 1;
        let td = max_tz - min_tz + 1;
        assert_eq!(tw, 2, "Tronc devrait faire 2 de large");
        assert_eq!(td, 2, "Tronc devrait faire 2 de profondeur");
        
        // RÈGLE CRUCIALE : Vérifier que chaque bloc du 2x2 est présent à chaque étage
        for ty in y..y + trunk_height {
            for tx in min_tx..=max_tx {
                for tz in min_tz..=max_tz {
                    assert_eq!(
                        blocks[block_index(tx as usize, ty as usize, tz as usize)], 
                        BlockId::OakLog as u8, 
                        "Bloc de tronc manquant à y={}, x={}, z={}", ty, tx, tz
                    );
                }
            }
        }
    }

    #[test]
    fn test_tree_distance_rule() {
        // On génère plusieurs chunks et on vérifie la distance entre tous les arbres trouvés
        let seed = 12345;
        let mut tree_positions = Vec::new();
        
        // On scanne une zone de 3x3 chunks
        for cx in -1..=1 {
            for cz in -1..=1 {
                let chunk = generate_chunk(cx, cz, seed);
                for lx in 0..CHUNK_SIZE_X {
                    for lz in 0..CHUNK_SIZE_Z {
                        for ly in 0..CHUNK_SIZE_Y {
                            if chunk[block_index(lx, ly, lz)] == BlockId::OakLog as u8 {
                                // On a trouvé un bloc de tronc. 
                                // On enregistre la position mondiale du pied du tronc.
                                // Un arbre peut avoir plusieurs blocs de tronc (1x1, 2x1, 2x2).
                                // On ne veut compter qu'un point par arbre.
                                let wx = cx * CHUNK_SIZE_X as i32 + lx as i32;
                                let wz = cz * CHUNK_SIZE_Z as i32 + lz as i32;
                                
                                // On ne garde que le bloc le plus bas pour chaque colonne de tronc
                                let mut is_new_tree = true;
                                for &(tx, _, tz) in &tree_positions {
                                    // Si on est très proche d'un tronc déjà enregistré (distance < 2), 
                                    // c'est probablement le même arbre (tronc 2x2 ou 2x1)
                                    let dx = (tx as i32 - wx as i32).abs();
                                    let dz = (tz as i32 - wz as i32).abs();
                                    if dx <= 1 && dz <= 1 {
                                        is_new_tree = false;
                                        break;
                                    }
                                }
                                
                                if is_new_tree {
                                    tree_positions.push((wx, ly as i32, wz));
                                }
                                // Une fois qu'on a trouvé un log à cette position (lx, lz), 
                                // on passe à la colonne suivante pour ne pas compter les logs en hauteur
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // Maintenant on vérifie la distance entre chaque paire d'arbres
        for i in 0..tree_positions.iter().len() {
            for j in i + 1..tree_positions.iter().len() {
                let (x1, _, z1) = tree_positions[i];
                let (x2, _, z2) = tree_positions[j];
                
                let dx = (x1 - x2) as f64;
                let dz = (z1 - z2) as f64;
                let distance = (dx*dx + dz*dz).sqrt();
                
                // La règle dit "moins de 10 blocs d'écart". 
                // Habituellement dans Minecraft cela signifie distance euclidienne ou de Manhattan ?
                // "10 blocs d'écart" suggère que si on est à (0,0), le suivant est au moins à (10,0) ou (0,10).
                // Avec ma grille de 12, le minimum devrait être 12 si ils sont dans des cellules adjacentes avec le même offset,
                // ou moins si les offsets les rapprochent.
                // Distance min possible entre deux cellules adjacentes (12x12) :
                // Cellule 0: offset 11,11 -> monde 11,11
                // Cellule 1: offset 0,0   -> monde 12,0
                // Distance = sqrt(1^2 + 11^2) = sqrt(122) ~ 11.04.
                // Donc distance >= 10 devrait être respecté.
                
                assert!(distance >= 10.0, "Arbres trop proches : ({},{}) et ({},{}) distance={}", x1, z1, x2, z2, distance);
            }
        }
    }

    #[test]
    fn test_tree_at_chunk_border_has_leaves_in_neighbor() {
        let seed = 12345;
        // On génère deux chunks adjacents
        let chunk_left = generate_chunk(0, 0, seed);
        let chunk_right = generate_chunk(1, 0, seed);
        
        // On cherche un arbre dans le chunk de droite qui est proche de la bordure
        let mut test_passed = false;
        'outer: for lx in 0..CHUNK_SIZE_X {
            for lz in 0..CHUNK_SIZE_Z {
                for ly in 0..CHUNK_SIZE_Y {
                    if chunk_right[block_index(lx, ly, lz)] == BlockId::OakLog as u8 {
                        // On a un arbre à monde x = 16 + lx.
                        // Si cet arbre est proche de la bordure (lx < 4), il devrait déborder sur chunk_left
                        if lx < 4 {
                            for dx in 1..=lx+1 {
                                let local_x_left = 16 + lx as i32 - dx as i32;
                                if local_x_left < 16 && chunk_left[block_index(local_x_left as usize, ly, lz)] == BlockId::OakLeaves as u8 {
                                    test_passed = true;
                                    break 'outer;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Si on n'a pas trouvé d'arbre en bordure dans chunk_right, on cherche dans chunk_left débordant sur chunk_right
        if !test_passed {
            'outer2: for lx in 12..CHUNK_SIZE_X {
                for lz in 0..CHUNK_SIZE_Z {
                    for ly in 0..CHUNK_SIZE_Y {
                        if chunk_left[block_index(lx, ly, lz)] == BlockId::OakLog as u8 {
                            // On a un arbre à monde x = lx.
                            // Si cet arbre est proche de la bordure (lx >= 12), il devrait déborder sur chunk_right (x >= 16)
                            for dx in 1..=(15-lx)+1 {
                                let local_x_right = lx as i32 + dx as i32 - 16;
                                if local_x_right >= 0 && chunk_right[block_index(local_x_right as usize, ly, lz)] == BlockId::OakLeaves as u8 {
                                    test_passed = true;
                                    break 'outer2;
                                }
                            }
                        }
                    }
                }
            }
        }

        assert!(test_passed, "Aucun arbre ne semble déborder correctement sur son voisin aux bordures de chunk");
    }
    #[test]
    fn test_tree_foliage_all_sides_covered() {
        for s in 0..100 {
            let mut blocks = vec![0u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];
            let seed = 9999 + s;
            let x = 7;
            let y = 10;
            let z = 7;
            generate_tree(x, y, z, &mut blocks, seed, x, z);

            let mut tw = 0;
            let mut td = 0;
            let mut height = 0;

            for ty in y..CHUNK_SIZE_Y as i32 {
                if blocks[block_index(x as usize, ty as usize, z as usize)] == BlockId::OakLog as u8 {
                    height += 1;
                } else {
                    break;
                }
            }
            
            for tx in x..CHUNK_SIZE_X as i32 {
                if blocks[block_index(tx as usize, y as usize, z as usize)] == BlockId::OakLog as u8 {
                    tw += 1;
                } else {
                    break;
                }
            }

            for tz in z..CHUNK_SIZE_Z as i32 {
                if blocks[block_index(x as usize, y as usize, tz as usize)] == BlockId::OakLog as u8 {
                    td += 1;
                } else {
                    break;
                }
            }

            let leaf_start_y_rel = height / 2;
            for ty_rel in leaf_start_y_rel..height {
                let ty = y + ty_rel;
                for tx in x..x+tw {
                    assert_eq!(blocks[block_index(tx as usize, ty as usize, (z-1) as usize)], BlockId::OakLeaves as u8, "Graine {}: Face Nord non couverte à y={} (rel={}), x={}", seed, ty, ty_rel, tx);
                    assert_eq!(blocks[block_index(tx as usize, ty as usize, (z+td) as usize)], BlockId::OakLeaves as u8, "Graine {}: Face Sud non couverte à y={} (rel={}), x={}", seed, ty, ty_rel, tx);
                }
                for tz in z..z+td {
                    assert_eq!(blocks[block_index((x-1) as usize, ty as usize, tz as usize)], BlockId::OakLeaves as u8, "Graine {}: Face Ouest non couverte à y={} (rel={}), z={}", seed, ty, ty_rel, tz);
                    assert_eq!(blocks[block_index((x+tw) as usize, ty as usize, tz as usize)], BlockId::OakLeaves as u8, "Graine {}: Face Est non couverte à y={} (rel={}), z={}", seed, ty, ty_rel, tz);
                }
            }

            // Vérifier que la partie basse du tronc est visible (pas de feuilles adjacentes au tronc)
            for ty_rel in 0..leaf_start_y_rel {
                let ty = y + ty_rel;
                for tx in x..x+tw {
                    assert_ne!(blocks[block_index(tx as usize, ty as usize, (z-1) as usize)], BlockId::OakLeaves as u8, "Graine {}: Feuille indésirable au Nord en bas à y={}, x={}", seed, ty, tx);
                    assert_ne!(blocks[block_index(tx as usize, ty as usize, (z+td) as usize)], BlockId::OakLeaves as u8, "Graine {}: Feuille indésirable au Sud en bas à y={}, x={}", seed, ty, tx);
                }
                for tz in z..z+td {
                    assert_ne!(blocks[block_index((x-1) as usize, ty as usize, tz as usize)], BlockId::OakLeaves as u8, "Graine {}: Feuille indésirable à l'Ouest en bas à y={}, z={}", seed, ty, tz);
                    assert_ne!(blocks[block_index((x+tw) as usize, ty as usize, tz as usize)], BlockId::OakLeaves as u8, "Graine {}: Feuille indésirable à l'Est en bas à y={}, z={}", seed, ty, tz);
                }
            }
        }
    }
}