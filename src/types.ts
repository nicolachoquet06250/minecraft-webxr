import type { Mesh, Scene, StandardMaterial, TransformNode, UniversalCamera, Vector3 } from "@babylonjs/core";

export type InventoryItem = {
  blockId: BlockId;
  count: number;
};

export type PlayerPhysics = {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  inventory: InventoryItem[];
  selectedSlot: number;
};

export type VoxelWasmModule = {
  default: () => Promise<void>;
  generate_chunk: (chunkX: number, chunkZ: number, seed: number) => Uint8Array;
  chunk_size_x: () => number;
  chunk_size_y: () => number;
  chunk_size_z: () => number;
};

export type UpdatePlayerPhysicsParams = {
  player: PlayerPhysics;
  camera: UniversalCamera;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  deltaTime: number;
};

export type SpawnPosition = {
  x: number;
  y: number;
  z: number;
};

export enum BlockId {
  Air = 0,

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

  Water = 17,
  Lava = 18,

  Snow = 19,
  SnowBlock = 20,
  Ice = 21,
  PackedIce = 22,
  BlueIce = 23,

  CoalOre = 24,
  IronOre = 25,
  CopperOre = 26,
  GoldOre = 27,
  RedstoneOre = 28,
  LapisOre = 29,
  DiamondOre = 30,
  EmeraldOre = 31,

  DeepslateCoalOre = 32,
  DeepslateIronOre = 33,
  DeepslateCopperOre = 34,
  DeepslateGoldOre = 35,
  DeepslateRedstoneOre = 36,
  DeepslateLapisOre = 37,
  DeepslateDiamondOre = 38,
  DeepslateEmeraldOre = 39,

  OakLog = 40,
  SpruceLog = 41,
  BirchLog = 42,
  JungleLog = 43,
  AcaciaLog = 44,
  DarkOakLog = 45,
  MangroveLog = 46,
  CherryLog = 47,

  OakLeaves = 48,
  SpruceLeaves = 49,
  BirchLeaves = 50,
  JungleLeaves = 51,
  AcaciaLeaves = 52,
  DarkOakLeaves = 53,
  MangroveLeaves = 54,
  CherryLeaves = 55,

  OakPlanks = 56,
  SprucePlanks = 57,
  BirchPlanks = 58,
  JunglePlanks = 59,
  AcaciaPlanks = 60,
  DarkOakPlanks = 61,
  MangrovePlanks = 62,
  CherryPlanks = 63,

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

  Netherrack = 75,
  SoulSand = 76,
  SoulSoil = 77,
  Basalt = 78,
  Blackstone = 79,
  MagmaBlock = 80,
  Glowstone = 81,

  EndStone = 82,
  EndStoneBricks = 83,
  PurpurBlock = 84,

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

  CraftingTable = 101,
  Furnace = 102,
  Chest = 103,
  Torch = 104,
  Glass = 105,
  Bookshelf = 106,

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

  DirtGrassPickaxe = 123,
}

export type CreateChunkMeshParams = {
  scene: Scene;
  name: string;
  blocks: Uint8Array;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  chunkX: number;
  chunkZ: number;
  material: StandardMaterial;
};

export type FaceDefinition = {
  normal: [number, number, number];
  vertices: [number, number, number][];
};

export type AddFaceParams = {
  positions: number[];
  indices: number[];
  normals: number[];
  colors: number[];
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
};

export type WorldChunk = {
  chunkX: number;
  chunkZ: number;
  blocks: Uint8Array;
  mesh: Mesh;
};

export type WorldChunks = Map<string, WorldChunk>;

export type DroppedItem = {
  mesh: Mesh | TransformNode;
  blockId: BlockId;
  createdAt: number;
  velocity: Vector3;
};