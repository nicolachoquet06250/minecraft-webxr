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
                block <= BlockId::Water as u8,
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
            .filter(|&&block| block != BlockId::Air as u8 && block != BlockId::Water as u8)
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
    fn generated_chunk_contains_surface_blocks() {
        let chunk = generate_chunk(0, 0, 12345);

        let grass_count = chunk
            .iter()
            .filter(|&&block| block == BlockId::Grass as u8)
            .count();

        let sand_count = chunk
            .iter()
            .filter(|&&block| block == BlockId::Sand as u8)
            .count();

        assert!(
            grass_count + sand_count > 0,
            "The generated chunk should contain grass or sand surface blocks"
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
    fn terrain_height_is_inside_chunk_bounds() {
        let terrain_noise = Perlin::new(12345);
        let detail_noise = Perlin::new(12346);

        for x in -128..128 {
            for z in -128..128 {
                let height = terrain_height(x, z, &terrain_noise, &detail_noise);

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

    #[test]
    fn terrain_height_is_deterministic() {
        let terrain_noise = Perlin::new(12345);
        let detail_noise = Perlin::new(12346);

        let height_a = terrain_height(42, -17, &terrain_noise, &detail_noise);
        let height_b = terrain_height(42, -17, &terrain_noise, &detail_noise);

        assert_eq!(height_a, height_b);
    }

    #[test]
    fn plain_surface_block_is_grass() {
        let terrain_height = 50;

        let block = generate_plain_block(terrain_height, terrain_height);

        assert_eq!(block, BlockId::Grass);
    }

    #[test]
    fn plain_subsurface_blocks_are_dirt() {
        let terrain_height = 50;

        assert_eq!(generate_plain_block(49, terrain_height), BlockId::Dirt);
        assert_eq!(generate_plain_block(48, terrain_height), BlockId::Dirt);
        assert_eq!(generate_plain_block(47, terrain_height), BlockId::Dirt);
        assert_eq!(generate_plain_block(46, terrain_height), BlockId::Dirt);
    }

    #[test]
    fn plain_deep_blocks_are_stone() {
        let terrain_height = 50;

        assert_eq!(generate_plain_block(45, terrain_height), BlockId::Stone);
        assert_eq!(generate_plain_block(20, terrain_height), BlockId::Stone);
        assert_eq!(generate_plain_block(0, terrain_height), BlockId::Stone);
    }

    #[test]
    fn desert_surface_and_subsurface_blocks_are_sand() {
        let terrain_height = 50;

        assert_eq!(generate_desert_block(50, terrain_height), BlockId::Sand);
        assert_eq!(generate_desert_block(49, terrain_height), BlockId::Sand);
        assert_eq!(generate_desert_block(48, terrain_height), BlockId::Sand);
        assert_eq!(generate_desert_block(47, terrain_height), BlockId::Sand);
        assert_eq!(generate_desert_block(46, terrain_height), BlockId::Sand);
        assert_eq!(generate_desert_block(45, terrain_height), BlockId::Sand);
    }

    #[test]
    fn desert_deep_blocks_are_stone() {
        let terrain_height = 50;

        assert_eq!(generate_desert_block(44, terrain_height), BlockId::Stone);
        assert_eq!(generate_desert_block(20, terrain_height), BlockId::Stone);
        assert_eq!(generate_desert_block(0, terrain_height), BlockId::Stone);
    }

    #[test]
    fn biome_generation_is_deterministic() {
        let biome_noise = Perlin::new(12348);

        let value_a = is_desert_biome(128, -256, &biome_noise);
        let value_b = is_desert_biome(128, -256, &biome_noise);

        assert_eq!(value_a, value_b);
    }

    #[test]
    fn cave_generation_is_deterministic() {
        let cave_noise = Perlin::new(12347);

        let value_a = is_cave(32, 24, -64, &cave_noise);
        let value_b = is_cave(32, 24, -64, &cave_noise);

        assert_eq!(value_a, value_b);
    }

    #[test]
    fn water_is_generated_below_or_at_sea_level_when_above_terrain() {
        let chunk = generate_chunk(0, 0, 12345);
        let sea_level = 42;

        for y in 0..CHUNK_SIZE_Y {
            for z in 0..CHUNK_SIZE_Z {
                for x in 0..CHUNK_SIZE_X {
                    let block = chunk[block_index(x, y, z)];

                    if block == BlockId::Water as u8 {
                        assert!(
                            y as i32 <= sea_level,
                            "Water should only exist below or at sea level"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn top_of_chunk_should_not_contain_solid_blocks_for_normal_generation() {
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
            }
        }
    }
}