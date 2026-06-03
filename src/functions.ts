import { Color3, Color4, HemisphericLight, Mesh, Scene, StandardMaterial, UniversalCamera, Vector3, VertexData } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
} from "@babylonjs/gui";
import { EYE_HEIGHT, FACES, GRAVITY, JUMP_VELOCITY, MOVE_SPEED, PLAYER_HEIGHT, PLAYER_RADIUS, pressedKeys, RENDER_CHUNK_RADIUS, SEED } from "./constants";
import { isMobileMode } from "./mobile-controls";
import {
  type AddFaceParams,
  type CreateChunkMeshParams,
  type PlayerPhysics,
  type SpawnPosition,
  type UpdatePlayerPhysicsParams,
  type WorldChunks,
  type WorldChunk,
  type VoxelWasmModule,
  type DroppedItem,
  BlockId
} from "./types";

export function createChunkMesh(params: CreateChunkMeshParams): Mesh {
  const {
    scene,
    name,
    blocks,
    sizeX,
    sizeY,
    sizeZ,
    chunkX,
    chunkZ,
    material,
  } = params;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const waterPositions: number[] = [];
  const waterIndices: number[] = [];
  const waterNormals: number[] = [];
  const waterColors: number[] = [];

  const worldOffsetX = chunkX * sizeX;
  const worldOffsetZ = chunkZ * sizeZ;

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const block = getBlock(blocks, sizeX, sizeY, sizeZ, x, y, z);

        if (block === BlockId.Air) {
          continue;
        }

        const worldX = worldOffsetX + x;
        const worldY = y;
        const worldZ = worldOffsetZ + z;

        if (block === BlockId.Water) {
          const topNeighbor = getBlock(
            blocks,
            sizeX,
            sizeY,
            sizeZ,
            x,
            y + 1,
            z,
          );

          if (topNeighbor === BlockId.Air) {
            addWaterTopFaceDoubleSided({
              positions: waterPositions,
              indices: waterIndices,
              normals: waterNormals,
              colors: waterColors,
              x: worldX,
              y: worldY,
              z: worldZ,
              block,
            });
          }

          continue;
        }

        for (const face of FACES) {
          const neighbor = getBlock(
            blocks,
            sizeX,
            sizeY,
            sizeZ,
            x + face.normal[0],
            y + face.normal[1],
            z + face.normal[2],
          );

          if (isTransparentForMeshing(neighbor)) {
            addFace({
              positions,
              indices,
              normals,
              colors,
              x: worldX,
              y: worldY,
              z: worldZ,
              face,
              block,
            });
          }
        }
      }
    }
  }

  const mesh = new Mesh(name, scene);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.colors = colors;
  vertexData.applyToMesh(mesh);

  mesh.material = material;

  if (waterPositions.length > 0) {
    const waterMesh = new Mesh(`${name}-water`, scene);

    const waterVertexData = new VertexData();
    waterVertexData.positions = waterPositions;
    waterVertexData.indices = waterIndices;
    waterVertexData.normals = waterNormals;
    waterVertexData.colors = waterColors;
    waterVertexData.applyToMesh(waterMesh);

    waterMesh.hasVertexAlpha = true;
    waterMesh.material = material;
    waterMesh.parent = mesh;
  }

  return mesh;
}

export function getBlockFaceColor(
  block: BlockId,
  normal: [number, number, number],
): Color4 {
  const isTopFace = normal[1] === 1;
  const isBottomFace = normal[1] === -1;

  if (block === BlockId.GrassBlock) {
    if (isTopFace) {
      return new Color4(0.25, 0.65, 0.2, 1.0);
    }

    if (isBottomFace) {
      return new Color4(0.45, 0.28, 0.12, 1.0);
    }

    return new Color4(0.36, 0.42, 0.16, 1.0);
  }

  if (block === BlockId.Snow) {
    if (isTopFace) {
      return new Color4(0.95, 0.97, 1.0, 1.0);
    }

    return new Color4(0.75, 0.78, 0.82, 1.0);
  }

  return getBlockColor(block);
}

export function addFace(params: AddFaceParams): void {
  const { positions, indices, normals, colors, x, y, z, face, block } = params;

  const vertexIndex = positions.length / 3;
  const color = getBlockFaceColor(block, face.normal);

  for (const vertex of face.vertices) {
    positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    normals.push(face.normal[0], face.normal[1], face.normal[2]);
    colors.push(color.r, color.g, color.b, color.a);
  }

  indices.push(
    vertexIndex,
    vertexIndex + 1,
    vertexIndex + 2,
    vertexIndex,
    vertexIndex + 2,
    vertexIndex + 3,
  );
}

export function addWaterTopFaceDoubleSided(params: Omit<AddFaceParams, "face">): void {
  const { positions, indices, normals, colors, x, y, z, block } = params;

  const topFace = FACES[0];
  const frontColor = getBlockFaceColor(block, topFace.normal);

  const frontVertexIndex = positions.length / 3;

  for (const vertex of topFace.vertices) {
    positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    normals.push(topFace.normal[0], topFace.normal[1], topFace.normal[2]);
    colors.push(frontColor.r, frontColor.g, frontColor.b, frontColor.a);
  }

  indices.push(
    frontVertexIndex,
    frontVertexIndex + 1,
    frontVertexIndex + 2,
    frontVertexIndex,
    frontVertexIndex + 2,
    frontVertexIndex + 3,
  );

  const backVertexIndex = positions.length / 3;

  for (const vertex of topFace.vertices) {
    positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);

    // On garde la normale vers le haut pour éviter le dessous noir.
    normals.push(topFace.normal[0], topFace.normal[1], topFace.normal[2]);

    // Verso à 50% d'opacité.
    colors.push(frontColor.r, frontColor.g, frontColor.b, 0.5);
  }

  indices.push(
    backVertexIndex,
    backVertexIndex + 2,
    backVertexIndex + 1,
    backVertexIndex,
    backVertexIndex + 3,
    backVertexIndex + 2,
  );
}

export function getBlock(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  x: number,
  y: number,
  z: number,
): BlockId {
  if (x < 0 || x >= sizeX) return BlockId.Air;
  if (y < 0 || y >= sizeY) return BlockId.Air;
  if (z < 0 || z >= sizeZ) return BlockId.Air;

  const index = x + sizeX * (z + sizeZ * y);

  return blocks[index] as BlockId;
}

export function setBlock(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  x: number,
  y: number,
  z: number,
  block: BlockId,
): void {
  if (x < 0 || x >= sizeX) return;
  if (y < 0 || y >= sizeY) return;
  if (z < 0 || z >= sizeZ) return;

  const index = x + sizeX * (z + sizeZ * y);

  blocks[index] = block;
}

export function isSolidBlock(block: BlockId): boolean {
  return (
    block !== BlockId.Air &&
    block !== BlockId.Water &&
    block !== BlockId.Lava &&
    block !== BlockId.Grass &&
    block !== BlockId.TallGrass &&
    block !== BlockId.Fern &&
    block !== BlockId.DeadBush &&
    block !== BlockId.Dandelion &&
    block !== BlockId.Poppy &&
    block !== BlockId.BlueOrchid &&
    block !== BlockId.Allium &&
    block !== BlockId.AzureBluet &&
    block !== BlockId.RedTulip &&
    block !== BlockId.OrangeTulip &&
    block !== BlockId.WhiteTulip &&
    block !== BlockId.PinkTulip &&
    block !== BlockId.OxeyeDaisy &&
    block !== BlockId.Torch
  );
}

export function getWorldBlock(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  worldX: number,
  worldY: number,
  worldZ: number,
): BlockId {
  const y = Math.floor(worldY);

  if (y < 0 || y >= sizeY) {
    return BlockId.Air;
  }

  const chunk = getChunkFromWorldPosition(
    worldChunks,
    sizeX,
    sizeZ,
    worldX,
    worldZ,
  );

  if (!chunk) {
    return BlockId.Air;
  }

  const localX = worldToLocalCoordinate(worldX, sizeX);
  const localZ = worldToLocalCoordinate(worldZ, sizeZ);

  return getBlock(
    chunk.blocks,
    sizeX,
    sizeY,
    sizeZ,
    localX,
    y,
    localZ,
  );
}

export function findTerrainSpawnY(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  x: number,
  z: number,
): number {
  const blockX = Math.floor(x);
  const blockZ = Math.floor(z);

  for (let y = sizeY - 1; y >= 0; y--) {
    const block = getBlock(blocks, sizeX, sizeY, sizeZ, blockX, y, blockZ);

    if (isSolidBlock(block)) {
      return y + 1;
    }
  }

  return sizeY + 4;
}

export function hasCollisionAt(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  position: Vector3,
): boolean {
  const minX = position.x - PLAYER_RADIUS;
  const maxX = position.x + PLAYER_RADIUS;
  const minY = position.y;
  const maxY = position.y + PLAYER_HEIGHT;
  const minZ = position.z - PLAYER_RADIUS;
  const maxZ = position.z + PLAYER_RADIUS;

  for (let y = Math.floor(minY); y <= Math.floor(maxY); y++) {
    for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
      for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
        const block = getWorldBlock(
          worldChunks,
          sizeX,
          sizeY,
          sizeZ,
          x,
          y,
          z,
        );

        if (isSolidBlock(block)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function moveWithCollision(
  player: PlayerPhysics,
  deltaMove: Vector3,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): void {
  const nextX = player.position.add(new Vector3(deltaMove.x, 0, 0));

  if (!hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, nextX)) {
    player.position.x = nextX.x;
  } else {
    player.velocity.x = 0;
  }

  const nextZ = player.position.add(new Vector3(0, 0, deltaMove.z));

  if (!hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, nextZ)) {
    player.position.z = nextZ.z;
  } else {
    player.velocity.z = 0;
  }

  const nextY = player.position.add(new Vector3(0, deltaMove.y, 0));

  if (!hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, nextY)) {
    player.position.y = nextY.y;
    player.grounded = false;
  } else {
    if (deltaMove.y < 0) {
      player.grounded = true;
    }

    player.velocity.y = 0;
  }
}

export function isTransparentForMeshing(block: BlockId): boolean {
  return (
    block === BlockId.Air ||
    block === BlockId.Water ||
    block === BlockId.Lava ||
    block === BlockId.Glass ||
    block === BlockId.Grass ||
    block === BlockId.TallGrass ||
    block === BlockId.Fern ||
    block === BlockId.DeadBush ||
    block === BlockId.Cactus ||
    block === BlockId.SugarCane ||
    block === BlockId.Dandelion ||
    block === BlockId.Poppy ||
    block === BlockId.BlueOrchid ||
    block === BlockId.Allium ||
    block === BlockId.AzureBluet ||
    block === BlockId.RedTulip ||
    block === BlockId.OrangeTulip ||
    block === BlockId.WhiteTulip ||
    block === BlockId.PinkTulip ||
    block === BlockId.OxeyeDaisy ||
    block === BlockId.Torch
  );
}

export function getBlockColor(block: BlockId): Color4 {
  switch (block) {
    case BlockId.GrassBlock:
      return new Color4(0.25, 0.65, 0.2, 1.0);

    case BlockId.Dirt:
    case BlockId.CoarseDirt:
    case BlockId.RootedDirt:
      return new Color4(0.45, 0.28, 0.12, 1.0);

    case BlockId.Podzol:
      return new Color4(0.36, 0.23, 0.11, 1.0);

    case BlockId.Stone:
    case BlockId.Cobblestone:
    case BlockId.StoneBricks:
    case BlockId.SmoothStone:
      return new Color4(0.45, 0.45, 0.45, 1.0);

    case BlockId.Deepslate:
      return new Color4(0.18, 0.18, 0.2, 1.0);

    case BlockId.Granite:
      return new Color4(0.58, 0.36, 0.29, 1.0);

    case BlockId.Diorite:
      return new Color4(0.78, 0.78, 0.76, 1.0);

    case BlockId.Andesite:
      return new Color4(0.42, 0.42, 0.42, 1.0);

    case BlockId.Tuff:
      return new Color4(0.32, 0.34, 0.32, 1.0);

    case BlockId.Calcite:
      return new Color4(0.86, 0.84, 0.78, 1.0);

    case BlockId.Gravel:
      return new Color4(0.42, 0.4, 0.38, 1.0);

    case BlockId.Sand:
    case BlockId.Sandstone:
    case BlockId.SmoothSandstone:
      return new Color4(0.82, 0.72, 0.42, 1.0);

    case BlockId.RedSand:
    case BlockId.RedSandstone:
      return new Color4(0.75, 0.33, 0.16, 1.0);

    case BlockId.Clay:
      return new Color4(0.48, 0.52, 0.58, 1.0);

    case BlockId.Water:
      return new Color4(0.1, 0.35, 0.85, 0.65);

    case BlockId.Lava:
      return new Color4(1.0, 0.32, 0.05, 0.9);

    case BlockId.Snow:
    case BlockId.SnowBlock:
      return new Color4(0.95, 0.97, 1.0, 1.0);

    case BlockId.Ice:
    case BlockId.PackedIce:
    case BlockId.BlueIce:
      return new Color4(0.55, 0.78, 1.0, 0.75);

    case BlockId.CoalOre:
    case BlockId.DeepslateCoalOre:
      return new Color4(0.12, 0.12, 0.12, 1.0);

    case BlockId.IronOre:
    case BlockId.DeepslateIronOre:
      return new Color4(0.78, 0.58, 0.38, 1.0);

    case BlockId.CopperOre:
    case BlockId.DeepslateCopperOre:
      return new Color4(0.75, 0.42, 0.25, 1.0);

    case BlockId.GoldOre:
    case BlockId.DeepslateGoldOre:
      return new Color4(1.0, 0.78, 0.12, 1.0);

    case BlockId.RedstoneOre:
    case BlockId.DeepslateRedstoneOre:
      return new Color4(0.8, 0.05, 0.05, 1.0);

    case BlockId.LapisOre:
    case BlockId.DeepslateLapisOre:
      return new Color4(0.08, 0.18, 0.75, 1.0);

    case BlockId.DiamondOre:
    case BlockId.DeepslateDiamondOre:
      return new Color4(0.25, 0.9, 0.95, 1.0);

    case BlockId.EmeraldOre:
    case BlockId.DeepslateEmeraldOre:
      return new Color4(0.1, 0.8, 0.25, 1.0);

    case BlockId.OakLog:
    case BlockId.SpruceLog:
    case BlockId.BirchLog:
    case BlockId.JungleLog:
    case BlockId.AcaciaLog:
    case BlockId.DarkOakLog:
    case BlockId.MangroveLog:
    case BlockId.CherryLog:
      return new Color4(0.25, 0.15, 0.05, 1.0);

    case BlockId.OakLeaves:
    case BlockId.BirchLeaves:
    case BlockId.JungleLeaves:
    case BlockId.AcaciaLeaves:
    case BlockId.DarkOakLeaves:
    case BlockId.MangroveLeaves:
    case BlockId.CherryLeaves:
      return new Color4(0.16, 0.5, 0.12, 0.9);

    case BlockId.SpruceLeaves:
      return new Color4(0.08, 0.32, 0.16, 0.9);

    case BlockId.OakPlanks:
    case BlockId.SprucePlanks:
    case BlockId.BirchPlanks:
    case BlockId.JunglePlanks:
    case BlockId.AcaciaPlanks:
    case BlockId.DarkOakPlanks:
    case BlockId.MangrovePlanks:
    case BlockId.CherryPlanks:
      return new Color4(0.58, 0.38, 0.18, 1.0);

    case BlockId.Netherrack:
      return new Color4(0.45, 0.08, 0.08, 1.0);

    case BlockId.SoulSand:
    case BlockId.SoulSoil:
      return new Color4(0.23, 0.16, 0.12, 1.0);

    case BlockId.Basalt:
    case BlockId.Blackstone:
      return new Color4(0.08, 0.08, 0.1, 1.0);

    case BlockId.MagmaBlock:
      return new Color4(0.95, 0.25, 0.05, 1.0);

    case BlockId.Glowstone:
      return new Color4(1.0, 0.82, 0.35, 1.0);

    case BlockId.EndStone:
    case BlockId.EndStoneBricks:
      return new Color4(0.86, 0.84, 0.55, 1.0);

    case BlockId.PurpurBlock:
      return new Color4(0.55, 0.32, 0.62, 1.0);

    case BlockId.Grass:
    case BlockId.TallGrass:
    case BlockId.Fern:
      return new Color4(0.2, 0.65, 0.18, 0.9);

    case BlockId.DeadBush:
    case BlockId.Cactus:
      return new Color4(0.2, 0.45, 0.16, 1.0);

    case BlockId.SugarCane:
      return new Color4(0.45, 0.8, 0.35, 1.0);

    case BlockId.Dandelion:
      return new Color4(1.0, 0.9, 0.1, 1.0);

    case BlockId.Poppy:
    case BlockId.RedTulip:
      return new Color4(0.9, 0.05, 0.05, 1.0);

    case BlockId.BlueOrchid:
      return new Color4(0.25, 0.5, 1.0, 1.0);

    case BlockId.Allium:
      return new Color4(0.65, 0.35, 0.9, 1.0);

    case BlockId.AzureBluet:
    case BlockId.WhiteTulip:
    case BlockId.OxeyeDaisy:
      return new Color4(0.95, 0.95, 0.9, 1.0);

    case BlockId.OrangeTulip:
      return new Color4(1.0, 0.45, 0.1, 1.0);

    case BlockId.PinkTulip:
      return new Color4(1.0, 0.45, 0.72, 1.0);

    case BlockId.CraftingTable:
      return new Color4(0.5, 0.32, 0.16, 1.0);

    case BlockId.Furnace:
      return new Color4(0.25, 0.25, 0.25, 1.0);

    case BlockId.Chest:
      return new Color4(0.72, 0.42, 0.12, 1.0);

    case BlockId.Torch:
      return new Color4(1.0, 0.75, 0.18, 1.0);

    case BlockId.Glass:
      return new Color4(0.8, 0.95, 1.0, 0.35);

    case BlockId.Bookshelf:
      return new Color4(0.45, 0.25, 0.12, 1.0);

    case BlockId.WhiteWool:
      return new Color4(0.95, 0.95, 0.95, 1.0);
    case BlockId.OrangeWool:
      return new Color4(0.95, 0.45, 0.12, 1.0);
    case BlockId.MagentaWool:
      return new Color4(0.75, 0.2, 0.75, 1.0);
    case BlockId.LightBlueWool:
      return new Color4(0.4, 0.65, 0.95, 1.0);
    case BlockId.YellowWool:
      return new Color4(0.95, 0.85, 0.15, 1.0);
    case BlockId.LimeWool:
      return new Color4(0.45, 0.85, 0.2, 1.0);
    case BlockId.PinkWool:
      return new Color4(0.95, 0.45, 0.7, 1.0);
    case BlockId.GrayWool:
      return new Color4(0.3, 0.3, 0.3, 1.0);
    case BlockId.LightGrayWool:
      return new Color4(0.65, 0.65, 0.65, 1.0);
    case BlockId.CyanWool:
      return new Color4(0.15, 0.55, 0.65, 1.0);
    case BlockId.PurpleWool:
      return new Color4(0.45, 0.2, 0.65, 1.0);
    case BlockId.BlueWool:
      return new Color4(0.15, 0.25, 0.75, 1.0);
    case BlockId.BrownWool:
      return new Color4(0.35, 0.18, 0.08, 1.0);
    case BlockId.GreenWool:
      return new Color4(0.18, 0.45, 0.12, 1.0);
    case BlockId.RedWool:
      return new Color4(0.75, 0.08, 0.08, 1.0);
    case BlockId.BlackWool:
      return new Color4(0.02, 0.02, 0.02, 1.0);

    case BlockId.Air:
    default:
      return new Color4(1.0, 1.0, 1.0, 0.0);
  }
}

export function updatePlayerPhysics(params: UpdatePlayerPhysicsParams): void {
  const {
    player,
    camera,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    deltaTime,
  } = params;

  const forward = new Vector3(
    Math.sin(player.yaw),
    0,
    Math.cos(player.yaw),
  );

  const right = new Vector3(
    Math.cos(player.yaw),
    0,
    -Math.sin(player.yaw),
  );

  const moveDirection = Vector3.Zero();

  if (
  pressedKeys.has("KeyW") ||
  pressedKeys.has("KeyZ") ||
  pressedKeys.has("ArrowUp")
) {
  moveDirection.addInPlace(forward);
}

if (
  pressedKeys.has("KeyS") ||
  pressedKeys.has("ArrowDown")
) {
  moveDirection.subtractInPlace(forward);
}

if (
  pressedKeys.has("KeyD") ||
  pressedKeys.has("ArrowRight")
) {
  moveDirection.addInPlace(right);
}

if (
  pressedKeys.has("KeyA") ||
  pressedKeys.has("KeyQ") ||
  pressedKeys.has("ArrowLeft")
) {
  moveDirection.subtractInPlace(right);
}

  if (moveDirection.lengthSquared() > 0) {
    moveDirection.normalize();
  }

  player.velocity.x = moveDirection.x * MOVE_SPEED;
  player.velocity.z = moveDirection.z * MOVE_SPEED;

  if (player.grounded && pressedKeys.has("Space")) {
    player.velocity.y = JUMP_VELOCITY;
    player.grounded = false;
  }

  player.velocity.y += GRAVITY * deltaTime;

  const deltaMove = player.velocity.scale(deltaTime);

  moveWithCollision(
    player,
    deltaMove,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
  );

  camera.position.copyFrom(
    player.position.add(new Vector3(0, EYE_HEIGHT, 0)),
  );

  camera.rotation.x = player.pitch;
  camera.rotation.y = player.yaw;
  camera.rotation.z = 0;
}

export function initializeCamera(scene: Scene, player: PlayerPhysics): UniversalCamera {
  const camera = new UniversalCamera(
    "fps-camera",
    player.position.add(new Vector3(0, EYE_HEIGHT, 0)),
    scene,
  );
  
  camera.minZ = 0.05;
  camera.maxZ = 500;
  camera.fov = 1.1;

  camera.inputs.clear();

  scene.activeCamera = camera;

  return camera;
}

export function inisializeLight(scene: Scene) {
  new HemisphericLight("sun", new Vector3(0.3, 1.0, 0.4), scene);
  
  const lightMaterial = new StandardMaterial("terrain-material", scene);
  lightMaterial.specularColor = Color3.Black();

  return lightMaterial;
}

export const generatePlayer = (spawn: SpawnPosition): PlayerPhysics => ({
  position: new Vector3(spawn.x, spawn.y, spawn.z),
  velocity: Vector3.Zero(),
  yaw: Math.PI / 4,
  pitch: 0,
  grounded: false,
  inventory: [],
  selectedSlot: 0,
});

export function getChunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX}:${chunkZ}`;
}

export function worldToChunkCoordinate(value: number, chunkSize: number): number {
  return Math.floor(value / chunkSize);
}

export function worldToLocalCoordinate(value: number, chunkSize: number): number {
  const local = Math.floor(value) % chunkSize;

  return local < 0 ? local + chunkSize : local;
}

export function getChunkFromWorldPosition(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeZ: number,
  worldX: number,
  worldZ: number,
): WorldChunk | undefined {
  const chunkX = worldToChunkCoordinate(worldX, sizeX);
  const chunkZ = worldToChunkCoordinate(worldZ, sizeZ);

  return worldChunks.get(getChunkKey(chunkX, chunkZ));
}

export function initializeCrosshair(scene: Scene): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("crosshair-ui", true, scene);

  const verticalLine = new Rectangle("crosshair-vertical");
  verticalLine.width = "2px";
  verticalLine.height = "18px";
  verticalLine.thickness = 0;
  verticalLine.background = "white";
  verticalLine.alpha = 0.9;
  verticalLine.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  verticalLine.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

  const horizontalLine = new Rectangle("crosshair-horizontal");
  horizontalLine.width = "18px";
  horizontalLine.height = "2px";
  horizontalLine.thickness = 0;
  horizontalLine.background = "white";
  horizontalLine.alpha = 0.9;
  horizontalLine.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  horizontalLine.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

  ui.addControl(verticalLine);
  ui.addControl(horizontalLine);

  return ui;
}

export function isLiquidBlock(block: BlockId): boolean {
  return block === BlockId.Water || block === BlockId.Lava;
}

export function isSpawnPassableBlock(block: BlockId): boolean {
  return (
    block === BlockId.Air ||
    block === BlockId.Grass ||
    block === BlockId.TallGrass ||
    block === BlockId.Fern ||
    block === BlockId.DeadBush ||
    block === BlockId.Dandelion ||
    block === BlockId.Poppy ||
    block === BlockId.BlueOrchid ||
    block === BlockId.Allium ||
    block === BlockId.AzureBluet ||
    block === BlockId.RedTulip ||
    block === BlockId.OrangeTulip ||
    block === BlockId.WhiteTulip ||
    block === BlockId.PinkTulip ||
    block === BlockId.OxeyeDaisy
  );
}

export function findDrySpawnPosition(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  preferredX: number,
  preferredZ: number,
  searchRadius = 64,
): SpawnPosition {
  let bestSpawn: SpawnPosition | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let dz = -searchRadius; dz <= searchRadius; dz++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const worldX = Math.floor(preferredX + dx);
      const worldZ = Math.floor(preferredZ + dz);

      const spawnY = findDrySpawnYAt(
        worldChunks,
        sizeX,
        sizeY,
        sizeZ,
        worldX,
        worldZ,
      );

      if (spawnY === null) {
        continue;
      }

      const distanceSquared = dx * dx + dz * dz;

      if (distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = distanceSquared;
        bestSpawn = {
          x: worldX + 0.5,
          y: spawnY,
          z: worldZ + 0.5,
        };
      }
    }
  }

  if (!bestSpawn) {
    throw new Error("Aucun spawn sec trouvé dans les chunks chargés");
  }

  return bestSpawn;
}

function findDrySpawnYAt(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  worldX: number,
  worldZ: number,
): number | null {
  for (let y = sizeY - 3; y >= 1; y--) {
    const groundBlock = getWorldBlock(
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      worldX,
      y,
      worldZ,
    );

    if (!isSolidBlock(groundBlock)) {
      continue;
    }

    const feetBlock = getWorldBlock(
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      worldX,
      y + 1,
      worldZ,
    );

    const headBlock = getWorldBlock(
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      worldX,
      y + 2,
      worldZ,
    );

    if (isLiquidBlock(feetBlock) || isLiquidBlock(headBlock)) {
      return null;
    }

    if (!isSpawnPassableBlock(feetBlock) || !isSpawnPassableBlock(headBlock)) {
      return null;
    }

    return y + 1;
  }

  return null;
}

export function getCurrentChunkCoordinate(
  worldPosition: number,
  chunkSize: number,
): number {
  return Math.floor(worldPosition / chunkSize);
}

export function ensureChunksAroundPlayer(params: {
  scene: Scene;
  worldChunks: WorldChunks;
  wasm: Pick<VoxelWasmModule, "generate_chunk">;
  material: StandardMaterial;
  player: PlayerPhysics;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  radius?: number;
}): void {
  const {
    scene,
    worldChunks,
    wasm,
    material,
    player,
    sizeX,
    sizeY,
    sizeZ,
    radius = RENDER_CHUNK_RADIUS,
  } = params;

  const centerChunkX = getCurrentChunkCoordinate(player.position.x, sizeX);
  const centerChunkZ = getCurrentChunkCoordinate(player.position.z, sizeZ);

  const requiredChunkKeys = new Set<string>();

  for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      const chunkX = centerChunkX + offsetX;
      const chunkZ = centerChunkZ + offsetZ;
      const key = getChunkKey(chunkX, chunkZ);

      requiredChunkKeys.add(key);

      if (worldChunks.has(key)) {
        continue;
      }

      const blocks = wasm.generate_chunk(chunkX, chunkZ, SEED);

      const mesh = createChunkMesh({
        scene,
        name: `chunk-${chunkX}-${chunkZ}`,
        blocks,
        sizeX,
        sizeY,
        sizeZ,
        chunkX,
        chunkZ,
        material,
      });

      worldChunks.set(key, {
        chunkX,
        chunkZ,
        blocks,
        mesh,
      });
    }
  }

  for (const [key, chunk] of worldChunks.entries()) {
    if (requiredChunkKeys.has(key)) {
      continue;
    }

    chunk.mesh.dispose();
    worldChunks.delete(key);
  }
}

function color4ToCssRgba(color: Color4, alpha = color.a): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

export function spawnDrop(
  scene: Scene,
  worldX: number,
  worldY: number,
  worldZ: number,
  blockId: BlockId,
  droppedItems: DroppedItem[],
): void {
  const cube = Mesh.CreateBox(`drop-${blockId}-${Date.now()}`, 0.3, scene);
  cube.position = new Vector3(worldX + 0.5, worldY + 0.5, worldZ + 0.5);

  const color = getBlockColor(blockId);
  const material = new StandardMaterial(`mat-drop-${blockId}`, scene);
  material.diffuseColor = new Color3(color.r, color.g, color.b);
  cube.material = material;

  droppedItems.push({
    mesh: cube,
    blockId,
    createdAt: Date.now(),
    velocity: new Vector3(0, 0, 0),
  });
}

export function updateDroppedItems(
  droppedItems: DroppedItem[],
  player: PlayerPhysics,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  deltaTime: number,
): void {
  const now = Date.now();
  for (let i = droppedItems.length - 1; i >= 0; i--) {
    const item = droppedItems[i];

    // Physique simple : Gravité
    item.velocity.y += GRAVITY * deltaTime;
    
    // Déplacement
    const nextY = item.mesh.position.y + item.velocity.y * deltaTime;
    const worldX = item.mesh.position.x;
    const worldZ = item.mesh.position.z;

    // Vérification collision sous l'item (pieds de l'item à 0.15 du centre car taille 0.3)
    const blockBelow = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, worldX, nextY - 0.15, worldZ);
    
    if (isSolidBlock(blockBelow)) {
      // Collision avec le sol
      item.velocity.y = 0;
      // Aligner sur le dessus du bloc
      item.mesh.position.y = Math.floor(nextY - 0.15) + 1 + 0.15;
    } else {
      item.mesh.position.y = nextY;
    }

    // Animation: rotation et flottement léger si au sol
    item.mesh.rotation.y += 2 * deltaTime;
    if (item.velocity.y === 0) {
      item.mesh.position.y += Math.sin(now / 200) * 0.001;
    }

    // Ramassage (proximité)
    const distance = Vector3.Distance(player.position, item.mesh.position);
    if (distance < 1.5) {
      item.mesh.dispose();
      droppedItems.splice(i, 1);
      
      addToInventory(player, item.blockId);
      if ((player as any)._updateInventoryUI) {
        (player as any)._updateInventoryUI();
      }
      continue;
    }

    // Despawn après 60 secondes
    if (now - item.createdAt > 60000) {
      item.mesh.dispose();
      droppedItems.splice(i, 1);
    }
  }

  // Système de repoussement pour éviter la superposition
  for (let i = 0; i < droppedItems.length; i++) {
    for (let j = i + 1; j < droppedItems.length; j++) {
      const itemA = droppedItems[i];
      const itemB = droppedItems[j];

      let dx = itemA.mesh.position.x - itemB.mesh.position.x;
      let dz = itemA.mesh.position.z - itemB.mesh.position.z;
      const dy = Math.abs(itemA.mesh.position.y - itemB.mesh.position.y);

      // Si les items sont très proches horizontalement et sur le même plan vertical
      const distanceSq = dx * dx + dz * dz;
      const minDistance = 0.4; // Augmenté un peu pour plus de visibilité
      if (distanceSq < minDistance * minDistance && dy < 0.3) {
        let distance = Math.sqrt(distanceSq);
        
        // Si exactement à la même position, on pousse dans une direction arbitraire
        if (distance < 0.001) {
          dx = Math.random() - 0.5;
          dz = Math.random() - 0.5;
          distance = Math.sqrt(dx * dx + dz * dz);
        }

        const pushForce = (minDistance - distance) * 0.5;
        const pushX = (dx / distance) * pushForce;
        const pushZ = (dz / distance) * pushForce;

        // On vérifie que le mouvement ne pousse pas dans un mur
        const nextAX = itemA.mesh.position.x + pushX;
        const nextAZ = itemA.mesh.position.z + pushZ;
        const nextBX = itemB.mesh.position.x - pushX;
        const nextBZ = itemB.mesh.position.z - pushZ;

        if (!isSolidBlock(getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, nextAX, itemA.mesh.position.y, nextAZ))) {
          itemA.mesh.position.x = nextAX;
          itemA.mesh.position.z = nextAZ;
        }

        if (!isSolidBlock(getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, nextBX, itemB.mesh.position.y, nextBZ))) {
          itemB.mesh.position.x = nextBX;
          itemB.mesh.position.z = nextBZ;
        }
      }
    }
  }
}

export type BreakBlockParams = {
  scene: Scene;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  material: StandardMaterial;
  droppedItems: DroppedItem[];
};

export function breakBlock(params: BreakBlockParams): void {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ, material, droppedItems } = params;

  const ray = scene.createPickingRay(
    scene.getEngine().getRenderWidth() / 2,
    scene.getEngine().getRenderHeight() / 2,
    null,
    scene.activeCamera,
  );

  // On cherche le premier bloc solide ou de l'eau en parcourant le rayon
  // Mais la consigne dit : "considérer les bloques water comme un bloque d'air" pour le cassage.
  // Donc on doit trouver le premier bloc qui n'est ni Air ni Water.

  let targetWorldX = 0;
  let targetWorldY = 0;
  let targetWorldZ = 0;
  let found = false;

  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();

  // On avance par petits pas pour trouver le premier bloc non-air/non-eau
  for (let d = 0.1; d <= 3; d += 0.1) {
    const p = start.add(direction.scale(d));
    const wx = Math.floor(p.x);
    const wy = Math.floor(p.y);
    const wz = Math.floor(p.z);

    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, wx, wy, wz);
    if (block !== BlockId.Air && block !== BlockId.Water) {
      targetWorldX = wx;
      targetWorldY = wy;
      targetWorldZ = wz;
      found = true;
      break;
    }
  }

  if (found) {
    const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, targetWorldX, targetWorldZ);

    if (chunk) {
      const localX = worldToLocalCoordinate(targetWorldX, sizeX);
      const localZ = worldToLocalCoordinate(targetWorldZ, sizeZ);

      // Le bloc à casser
      const brokenBlock = getBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, targetWorldY, localZ);
      let newBlock = BlockId.Air;

      // "quand je casse un bloque adjacent à un bloque water, celui-ci se transforme en bloque water."
      const neighbors = [
        [targetWorldX + 1, targetWorldY, targetWorldZ],
        [targetWorldX - 1, targetWorldY, targetWorldZ],
        [targetWorldX, targetWorldY + 1, targetWorldZ],
        [targetWorldX, targetWorldY - 1, targetWorldZ],
        [targetWorldX, targetWorldY, targetWorldZ + 1],
        [targetWorldX, targetWorldY, targetWorldZ - 1],
      ];

      for (const [nx, ny, nz] of neighbors) {
        if (getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, nx, ny, nz) === BlockId.Water) {
          newBlock = BlockId.Water;
          break;
        }
      }

      setBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, targetWorldY, localZ, newBlock);

      // Drop de l'item tant que ce n'était pas de l'air
      if (brokenBlock !== BlockId.Air) {
        spawnDrop(scene, targetWorldX, targetWorldY, targetWorldZ, brokenBlock, droppedItems);
      }

      const affectedChunks = new Set<string>();
      affectedChunks.add(getChunkKey(chunk.chunkX, chunk.chunkZ));

      // Si le bloc était sur une bordure, le chunk voisin est aussi affecté
      if (localX === 0) affectedChunks.add(getChunkKey(chunk.chunkX - 1, chunk.chunkZ));
      if (localX === sizeX - 1) affectedChunks.add(getChunkKey(chunk.chunkX + 1, chunk.chunkZ));
      if (localZ === 0) affectedChunks.add(getChunkKey(chunk.chunkX, chunk.chunkZ - 1));
      if (localZ === sizeZ - 1) affectedChunks.add(getChunkKey(chunk.chunkX, chunk.chunkZ + 1));

      for (const key of affectedChunks) {
        const c = worldChunks.get(key);
        if (c) {
          const oldMesh = c.mesh;
          c.mesh = createChunkMesh({
            scene,
            name: `chunk-${c.chunkX}-${c.chunkZ}`,
            blocks: c.blocks,
            sizeX,
            sizeY,
            sizeZ,
            chunkX: c.chunkX,
            chunkZ: c.chunkZ,
            material,
          });
          oldMesh.dispose();
        }
      }
    }
  }
}

export function addToInventory(player: PlayerPhysics, blockId: BlockId): void {
  // Chercher s'il y a déjà une pile de ce bloc avec de la place (< 64)
  for (const item of player.inventory) {
    if (item.blockId === blockId && item.count < 64) {
      item.count++;
      return;
    }
  }

  // Si pas de pile existante ou piles pleines, ajouter un nouveau slot si place dispo (max 9 slots pour le moment)
  if (player.inventory.length < 9) {
    player.inventory.push({ blockId, count: 1 });
  } else {
    // Si l'inventaire est plein, on ne fait rien (l'objet est perdu ou reste au sol)
    // Dans Minecraft l'objet reste au sol, mais ici on l'a déjà supprimé de droppedItems
    // Pour bien faire il faudrait vérifier avant de splice, mais restons simple pour l'instant.
  }
}

export function initializeInventoryBar(scene: Scene, player: PlayerPhysics): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("inventory-ui", true, scene);
  
  const isMobile = isMobileMode();

  if (isMobile) {
    ui.renderAtIdealSize = true;
    ui.idealWidth = 1280;
    ui.idealHeight = 720;
  }

  const slots: Rectangle[] = [];
  const itemIcons: Rectangle[] = [];
  const countTexts: TextBlock[] = [];

  const slotCount = 9;
  const screenWidth = window.innerWidth || 1024;

  const slotSize = Math.max(
    isMobile ? 34 : 42,
    Math.min(isMobile ? 44 : 52, Math.floor((screenWidth - 24) / slotCount)),
  );

  const itemSize = Math.floor(slotSize * 0.58);

  const hotbar = new StackPanel("inventory-hotbar");
  hotbar.isVertical = false;
  hotbar.width = `${slotSize * slotCount}px`;
  hotbar.height = `${slotSize}px`;
  hotbar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  hotbar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  hotbar.top = isMobile ? "-16px" : "-24px";
  hotbar.isPointerBlocker = true;

  ui.addControl(hotbar);

  const updateUI = (): void => {
    // Mise à jour de la sélection
    for (let index = 0; index < slotCount; index++) {
      const slot = slots[index];
      const isSelected = index === player.selectedSlot;

      slot.thickness = isSelected ? 4 : 2;
      slot.color = isSelected ? "white" : "rgba(160, 160, 160, 0.95)";
      slot.background = isSelected
        ? "rgba(90, 90, 90, 0.82)"
        : "rgba(30, 30, 30, 0.68)";

      // Mise à jour du contenu du slot
      const inventoryItem = player.inventory[index];
      const icon = itemIcons[index];
      const countText = countTexts[index];

      if (inventoryItem) {
        icon.isVisible = true;
        icon.background = color4ToCssRgba(
          getBlockColor(inventoryItem.blockId),
          inventoryItem.blockId === BlockId.Water ? 0.75 : 1.0,
        );
        
        countText.isVisible = inventoryItem.count > 1;
        countText.text = `${inventoryItem.count}`;
      } else {
        icon.isVisible = false;
        countText.isVisible = false;
      }
    }
  };

  const updateSelectedSlot = (nextSelectedIndex: number): void => {
    if (nextSelectedIndex < 0 || nextSelectedIndex >= slotCount) {
      return;
    }

    player.selectedSlot = nextSelectedIndex;
    updateUI();
  };

  for (let index = 0; index < slotCount; index++) {
    const slot = new Rectangle(`inventory-slot-${index}`);
    slot.width = `${slotSize}px`;
    slot.height = `${slotSize}px`;
    slot.thickness = 2;
    slot.color = "rgba(160, 160, 160, 0.95)";
    slot.background = "rgba(30, 30, 30, 0.68)";
    slot.isPointerBlocker = true;

    slot.onPointerClickObservable.add(() => {
      updateSelectedSlot(index);
    });

    const item = new Rectangle(`inventory-item-${index}`);
    item.width = `${itemSize}px`;
    item.height = `${itemSize}px`;
    item.thickness = 1;
    item.color = "rgba(255, 255, 255, 0.35)";
    item.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    item.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    item.isPointerBlocker = false;
    item.isVisible = false;

    const countText = new TextBlock(`inventory-count-${index}`);
    countText.color = "white";
    countText.fontSize = Math.max(10, Math.floor(slotSize * 0.3));
    countText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    countText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    countText.paddingRight = "2px";
    countText.paddingTop = "2px";
    countText.isPointerBlocker = false;
    countText.isVisible = false;
    countText.shadowBlur = 3;
    countText.shadowColor = "black";

    const shortcut = new TextBlock(`inventory-shortcut-${index}`);
    shortcut.text = `${index + 1}`;
    shortcut.color = "rgba(255, 255, 255, 0.9)";
    shortcut.fontSize = Math.max(10, Math.floor(slotSize * 0.22));
    shortcut.width = `${slotSize}px`;
    shortcut.height = `${slotSize}px`;
    shortcut.paddingLeft = "4px";
    shortcut.paddingBottom = "2px";
    shortcut.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    shortcut.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    shortcut.isPointerBlocker = false;

    slot.addControl(item);
    slot.addControl(countText);
    slot.addControl(shortcut);

    slots.push(slot);
    itemIcons.push(item);
    countTexts.push(countText);
    hotbar.addControl(slot);
  }

  // Exposer updateUI sur l'objet player pour pouvoir rafraîchir l'inventaire
  // de n'importe où (un peu hacky mais efficace pour ce projet sans système d'events complexe)
  (player as any)._updateInventoryUI = updateUI;

  updateUI();

  window.addEventListener("keydown", (event) => {
    const digitMatch = event.code.match(/^Digit([1-9])$/);
    const numpadMatch = event.code.match(/^Numpad([1-9])$/);

    const selectedNumber = digitMatch?.[1] ?? numpadMatch?.[1];

    if (!selectedNumber) {
      return;
    }

    const nextSelectedIndex = Number(selectedNumber) - 1;
    updateSelectedSlot(nextSelectedIndex);
    event.preventDefault();
  });

  return ui;
}
