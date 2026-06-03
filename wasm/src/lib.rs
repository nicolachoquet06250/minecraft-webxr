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

    // Natural terrain
    GrassBlock = 1,
    Dirt = 2,
    CoarseDirt = 3,
    Podzol = 4,
    RootedDirt = 5,
    Stone = 6,
    Deepslate = 7,
    Granite = 8,
    Diorite = 9,
    Andesite = 10,
    Tuff = 11,
    Calcite = 12,
    Gravel = 13,
    Sand = 14,
    RedSand = 15,
    Clay = 16,

    // Liquids
    Water = 17,
    Lava = 18,

    // Snow / ice
    Snow = 19,
    SnowBlock = 20,
    Ice = 21,
    PackedIce = 22,
    BlueIce = 23,

    // Ores
    CoalOre = 24,
    IronOre = 25,
    CopperOre = 26,
    GoldOre = 27,
    RedstoneOre = 28,
    LapisOre = 29,
    DiamondOre = 30,
    EmeraldOre = 31,

    // Deepslate ores
    DeepslateCoalOre = 32,
    DeepslateIronOre = 33,
    DeepslateCopperOre = 34,
    DeepslateGoldOre = 35,
    DeepslateRedstoneOre = 36,
    DeepslateLapisOre = 37,
    DeepslateDiamondOre = 38,
    DeepslateEmeraldOre = 39,

    // Wood logs
    OakLog = 40,
    SpruceLog = 41,
    BirchLog = 42,
    JungleLog = 43,
    AcaciaLog = 44,
    DarkOakLog = 45,
    MangroveLog = 46,
    CherryLog = 47,

    // Leaves
    OakLeaves = 48,
    SpruceLeaves = 49,
    BirchLeaves = 50,
    JungleLeaves = 51,
    AcaciaLeaves = 52,
    DarkOakLeaves = 53,
    MangroveLeaves = 54,
    CherryLeaves = 55,

    // Planks
    OakPlanks = 56,
    SprucePlanks = 57,
    BirchPlanks = 58,
    JunglePlanks = 59,
    AcaciaPlanks = 60,
    DarkOakPlanks = 61,
    MangrovePlanks = 62,
    CherryPlanks = 63,

    // Stone building blocks
    Cobblestone = 64,
    MossyCobblestone = 65,
    StoneBricks = 66,
    MossyStoneBricks = 67,
    CrackedStoneBricks = 68,
    ChiseledStoneBricks = 69,
    Bricks = 70,
    Sandstone = 71,
    RedSandstone = 72,
    SmoothStone = 73,
    SmoothSandstone = 74,

    // Nether-like blocks
    Netherrack = 75,
    SoulSand = 76,
    SoulSoil = 77,
    Basalt = 78,
    Blackstone = 79,
    MagmaBlock = 80,
    Glowstone = 81,

    // End-like blocks
    EndStone = 82,
    EndStoneBricks = 83,
    PurpurBlock = 84,

    // Vegetation
    Grass = 85,
    TallGrass = 86,
    Fern = 87,
    DeadBush = 88,
    Cactus = 89,
    SugarCane = 90,
    Dandelion = 91,
    Poppy = 92,
    BlueOrchid = 93,
    Allium = 94,
    AzureBluet = 95,
    RedTulip = 96,
    OrangeTulip = 97,
    WhiteTulip = 98,
    PinkTulip = 99,
    OxeyeDaisy = 100,

    // Utility / artificial
    CraftingTable = 101,
    Furnace = 102,
    Chest = 103,
    Torch = 104,
    Glass = 105,
    Bookshelf = 106,

    // Wool colors
    WhiteWool = 107,
    OrangeWool = 108,
    MagentaWool = 109,
    LightBlueWool = 110,
    YellowWool = 111,
    LimeWool = 112,
    PinkWool = 113,
    GrayWool = 114,
    LightGrayWool = 115,
    CyanWool = 116,
    PurpleWool = 117,
    BlueWool = 118,
    BrownWool = 119,
    GreenWool = 120,
    RedWool = 121,
    BlackWool = 122,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BiomeId {
    Plains,
    Desert,
    Snowy,
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
    let ore_noise = Perlin::new(seed.wrapping_add(4));
    let decoration_noise = Perlin::new(seed.wrapping_add(5));

    let mut blocks = vec![BlockId::Air as u8; CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z];

    for local_x in 0..CHUNK_SIZE_X {
        for local_z in 0..CHUNK_SIZE_Z {
            let world_x = chunk_x * CHUNK_SIZE_X as i32 + local_x as i32;
            let world_z = chunk_z * CHUNK_SIZE_Z as i32 + local_z as i32;

            let biome = get_biome(world_x, world_z, &biome_noise);

            let height = terrain_height(
                world_x,
                world_z,
                biome,
                &terrain_noise,
                &detail_noise,
            );

            let sea_level = 42;

            for y in 0..CHUNK_SIZE_Y {
                let world_y = y as i32;

                let block = if world_y > height {
                    generate_above_surface_block(world_y, sea_level, biome)
                } else {
                    let has_cave = is_cave(world_x, world_y, world_z, &cave_noise);

                    if has_cave && world_y < height - 4 && world_y > 8 {
                        BlockId::Air
                    } else {
                        generate_underground_block(
                            world_x,
                            world_y,
                            world_z,
                            height,
                            sea_level,
                            biome,
                            &ore_noise,
                        )
                    }
                };

                let index = block_index(local_x, y, local_z);
                blocks[index] = block as u8;
            }

            let decoration_y = height + 1;

            if height >= sea_level && decoration_y > 0 && decoration_y < CHUNK_SIZE_Y as i32 {
                let decoration = surface_decoration_block(
                    world_x,
                    world_z,
                    height,
                    sea_level,
                    biome,
                    &decoration_noise,
                );

                if decoration != BlockId::Air {
                    let index = block_index(local_x, decoration_y as usize, local_z);
                    blocks[index] = decoration as u8;
                }
            }
        }
    }

    blocks
}

fn get_biome(world_x: i32, world_z: i32, biome_noise: &Perlin) -> BiomeId {
    let x = world_x as f64;
    let z = world_z as f64;

    let frequency = 0.012;

    let temperature = biome_noise.get([x * frequency, z * frequency]);
    let humidity = biome_noise.get([
        x * frequency + 10_000.0,
        z * frequency - 10_000.0,
    ]);

    if temperature > 0.15 && humidity < 0.35 {
        BiomeId::Desert
    } else if temperature < -0.15 {
        BiomeId::Snowy
    } else {
        BiomeId::Plains
    }
}

fn surface_decoration_block(
    world_x: i32,
    world_z: i32,
    surface_y: i32,
    sea_level: i32,
    biome: BiomeId,
    decoration_noise: &Perlin,
) -> BlockId {
    if surface_y < sea_level {
        return BlockId::Air;
    }

    let x = world_x as f64;
    let z = world_z as f64;

    let value = decoration_noise.get([x * 0.25, z * 0.25]);

    match biome {
        BiomeId::Plains => {
            if value > 0.72 {
                BlockId::TallGrass
            } else if value > 0.66 {
                BlockId::Dandelion
            } else if value > 0.60 {
                BlockId::Poppy
            } else {
                BlockId::Air
            }
        }

        BiomeId::Desert => {
            if value > 0.82 && surface_y > 42 {
                BlockId::Cactus
            } else if value > 0.68 {
                BlockId::DeadBush
            } else {
                BlockId::Air
            }
        }

        BiomeId::Snowy => {
            if value > 0.70 {
                BlockId::SnowBlock
            } else {
                BlockId::Air
            }
        }
    }
}

fn terrain_height(
    world_x: i32,
    world_z: i32,
    biome: BiomeId,
    terrain_noise: &Perlin,
    detail_noise: &Perlin,
) -> i32 {
    let x = world_x as f64;
    let z = world_z as f64;

    let continents = terrain_noise.get([x * 0.006, z * 0.006]);
    let hills = terrain_noise.get([x * 0.018, z * 0.018]);
    let details = detail_noise.get([x * 0.055, z * 0.055]);

    let biome_height_modifier = match biome {
        BiomeId::Plains => 0.0,
        BiomeId::Desert => -2.0,
        BiomeId::Snowy => 6.0,
    };

    let biome_hill_modifier = match biome {
        BiomeId::Plains => 1.0,
        BiomeId::Desert => 0.45,
        BiomeId::Snowy => 1.45,
    };

    let height =
        44.0
        + continents * 30.0
        + hills * 18.0 * biome_hill_modifier
        + details * 6.0
        + biome_height_modifier;

    height.clamp(8.0, (CHUNK_SIZE_Y - 2) as f64) as i32
}

fn generate_above_surface_block(
    world_y: i32,
    sea_level: i32,
    biome: BiomeId,
) -> BlockId {
    if world_y <= sea_level {
        match biome {
            BiomeId::Snowy => BlockId::Ice,
            _ => BlockId::Water,
        }
    } else {
        BlockId::Air
    }
}

fn generate_underground_block(
    world_x: i32,
    world_y: i32,
    world_z: i32,
    terrain_height: i32,
    sea_level: i32,
    biome: BiomeId,
    ore_noise: &Perlin,
) -> BlockId {
    if world_y == terrain_height {
        return generate_surface_block_at_height(biome, terrain_height, sea_level);
    }

    if world_y == terrain_height - 1 && biome == BiomeId::Snowy {
        return BlockId::SnowBlock;
    }

    if world_y >= terrain_height - 4 {
        return generate_subsurface_block_at_height(biome, terrain_height, sea_level);
    }

    generate_deep_block(world_x, world_y, world_z, ore_noise)
}

fn generate_surface_block_at_height(
    biome: BiomeId,
    terrain_height: i32,
    sea_level: i32,
) -> BlockId {
    if terrain_height < sea_level {
        return match biome {
            BiomeId::Plains => BlockId::Stone,
            BiomeId::Desert => BlockId::Sand,
            BiomeId::Snowy => BlockId::Clay,
        };
    }

    generate_surface_block(biome)
}

fn generate_subsurface_block_at_height(
    biome: BiomeId,
    terrain_height: i32,
    sea_level: i32,
) -> BlockId {
    if terrain_height < sea_level {
        return match biome {
            BiomeId::Plains => BlockId::Stone,
            BiomeId::Desert => BlockId::Sand,
            BiomeId::Snowy => BlockId::Clay,
        };
    }

    generate_subsurface_block(biome)
}

fn generate_surface_block(biome: BiomeId) -> BlockId {
    match biome {
        BiomeId::Plains => BlockId::GrassBlock,
        BiomeId::Desert => BlockId::Sand,
        BiomeId::Snowy => BlockId::Snow,
    }
}

fn generate_subsurface_block(biome: BiomeId) -> BlockId {
    match biome {
        BiomeId::Plains => BlockId::Dirt,
        BiomeId::Desert => BlockId::Sandstone,
        BiomeId::Snowy => BlockId::Dirt,
    }
}

fn generate_deep_block(
    world_x: i32,
    world_y: i32,
    world_z: i32,
    ore_noise: &Perlin,
) -> BlockId {
    if world_y < 18 {
        let ore = ore_value(world_x, world_y, world_z, ore_noise);

        if ore > 0.83 {
            return BlockId::DiamondOre;
        }

        if ore > 0.78 {
            return BlockId::RedstoneOre;
        }

        if ore > 0.74 {
            return BlockId::GoldOre;
        }

        return BlockId::Deepslate;
    }

    let ore = ore_value(world_x, world_y, world_z, ore_noise);

    if ore > 0.86 {
        BlockId::CoalOre
    } else if ore > 0.82 {
        BlockId::IronOre
    } else if ore > 0.79 {
        BlockId::CopperOre
    } else {
        BlockId::Stone
    }
}

fn ore_value(
    world_x: i32,
    world_y: i32,
    world_z: i32,
    ore_noise: &Perlin,
) -> f64 {
    let x = world_x as f64;
    let y = world_y as f64;
    let z = world_z as f64;

    ore_noise.get([
        x * 0.12,
        y * 0.12,
        z * 0.12,
    ])
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