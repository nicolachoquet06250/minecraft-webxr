use noise::{NoiseFn, Perlin};
use wasm_bindgen::prelude::*;

const CHUNK_SIZE_X: usize = 16;
const CHUNK_SIZE_Y: usize = 96;
const CHUNK_SIZE_Z: usize = 16;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BlockId {
    Air = 0,
    Grass = 1,
    Dirt = 2,
    Stone = 3,
    Sand = 4,
    Water = 5,
}

#[wasm_bindgen]
pub fn chunk_size_x() -> usize {
    CHUNK_SIZE_X
}

#[wasm_bindgen]
pub fn chunk_size_y() -> usize {
    CHUNK_SIZE_Y
}

#[wasm_bindgen]
pub fn chunk_size_z() -> usize {
    CHUNK_SIZE_Z
}

#[wasm_bindgen]
pub fn generate_chunk(chunk_x: i32, chunk_z: i32, seed: u32) -> Vec<u8> {
    let terrain_noise = Perlin::new(seed);
    let detail_noise = Perlin::new(seed.wrapping_add(1));
    let cave_noise = Perlin::new(seed.wrapping_add(2));
    let biome_noise = Perlin::new(seed.wrapping_add(3));

    let mut blocks = vec![BlockId::Air as u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];

    for local_x in 0..CHUNK_SIZE_X {
        for local_z in 0..CHUNK_SIZE_Z {
            let world_x = chunk_x * CHUNK_SIZE_X as i32 + local_x as i32;
            let world_z = chunk_z * CHUNK_SIZE_Z as i32 + local_z as i32;

            let height = terrain_height(
                world_x,
                world_z,
                &terrain_noise,
                &detail_noise,
            );

            let is_desert = is_desert_biome(world_x, world_z, &biome_noise);
            let sea_level = 42;

            for y in 0..CHUNK_SIZE_Y {
                let world_y = y as i32;

                let block = if world_y > height {
                    if world_y <= sea_level {
                        BlockId::Water
                    } else {
                        BlockId::Air
                    }
                } else {
                    let has_cave = is_cave(world_x, world_y, world_z, &cave_noise);

                    if has_cave && world_y < height - 4 && world_y > 8 {
                        BlockId::Air
                    } else if is_desert {
                        generate_desert_block(world_y, height)
                    } else {
                        generate_plain_block(world_y, height)
                    }
                };

                let index = block_index(local_x, y, local_z);
                blocks[index] = block as u8;
            }
        }
    }

    blocks
}

fn terrain_height(
    world_x: i32,
    world_z: i32,
    terrain_noise: &Perlin,
    detail_noise: &Perlin,
) -> i32 {
    let x = world_x as f64;
    let z = world_z as f64;

    let continents = terrain_noise.get([x * 0.006, z * 0.006]);
    let hills = terrain_noise.get([x * 0.018, z * 0.018]);
    let details = detail_noise.get([x * 0.055, z * 0.055]);

    let height =
        44.0
        + continents * 26.0
        + hills * 10.0
        + details * 3.0;

    height.clamp(8.0, (CHUNK_SIZE_Y - 2) as f64) as i32
}

fn generate_plain_block(world_y: i32, terrain_height: i32) -> BlockId {
    if world_y == terrain_height {
        BlockId::Grass
    } else if world_y >= terrain_height - 4 {
        BlockId::Dirt
    } else {
        BlockId::Stone
    }
}

fn generate_desert_block(world_y: i32, terrain_height: i32) -> BlockId {
    if world_y >= terrain_height - 5 {
        BlockId::Sand
    } else {
        BlockId::Stone
    }
}

fn is_desert_biome(world_x: i32, world_z: i32, biome_noise: &Perlin) -> bool {
    let x = world_x as f64;
    let z = world_z as f64;

    let value = biome_noise.get([x * 0.0025, z * 0.0025]);

    value > 0.35
}

fn is_cave(world_x: i32, world_y: i32, world_z: i32, cave_noise: &Perlin) -> bool {
    let x = world_x as f64;
    let y = world_y as f64;
    let z = world_z as f64;

    let cave_value = cave_noise.get([
        x * 0.045,
        y * 0.065,
        z * 0.045,
    ]);

    cave_value > 0.58
}

fn block_index(x: usize, y: usize, z: usize) -> usize {
    x + CHUNK_SIZE_X * (z + CHUNK_SIZE_Z * y)
}

mod tests;