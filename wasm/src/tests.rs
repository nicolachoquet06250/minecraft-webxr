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
}