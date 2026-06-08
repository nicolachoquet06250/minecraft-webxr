import { Mesh, Scene, StandardMaterial, Vector3, VertexData } from "@babylonjs/core";
import { EYE_HEIGHT, FACES, GRAVITY, PLAYER_HEIGHT, PLAYER_RADIUS, RENDER_CHUNK_RADIUS, SEED } from "./constants";
import { getBlockFaceTextureUv, getFallbackTextureUv } from "./block-atlas";
import { getBlockDefinition } from "./blocks";
import type { BlockFaceName } from "./blocks";
import {
  addToInventory,
  getBlock,
  getBlockFaceColor,
  getChunkFromWorldPosition,
  getChunkKey,
  getCurrentChunkCoordinate,
  getWorldBlock,
  isSolidBlock,
  isTransparentForMeshing,
  setBlock,
  worldToLocalCoordinate,
} from "./functions";
import type { CreateChunkMeshParams, DroppedItem, FaceDefinition, PlayerPhysics, VoxelWasmModule, WorldChunk, WorldChunks } from "./types";
import { BlockId } from "./types";

const DROP_SIZE = 0.3;

type MeshBuffers = {
  positions: number[];
  indices: number[];
  normals: number[];
  colors: number[];
  uvs: number[];
};

type BreakBlockParams = {
  scene: Scene;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  material: StandardMaterial;
  droppedItems: DroppedItem[];
};

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
      material
  } = params;

  const solid: MeshBuffers = createMeshBuffers();
  const water: MeshBuffers = createMeshBuffers();
  const worldOffsetX = chunkX * sizeX;
  const worldOffsetZ = chunkZ * sizeZ;

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const block = getBlock(blocks, sizeX, sizeY, sizeZ, x, y, z);

        if (block === BlockId.Air) continue;

        const worldX = worldOffsetX + x;
        const worldY = y;
        const worldZ = worldOffsetZ + z;
        const visualHeight = getBlockVisualHeight(block);

        if (block === BlockId.Water) {
          const topNeighbor = getBlock(blocks, sizeX, sizeY, sizeZ, x, y + 1, z);

          if (topNeighbor === BlockId.Air) {
            addDoubleSidedFlatFace({
              buffers: water,
              x: worldX,
              y: worldY,
              z: worldZ,
              face: FACES[0],
              block,
              visualHeight,
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

          if (!isTransparentForMeshing(neighbor)) continue;

          addTexturedOrFlatFace({
            buffers: solid,
            x: worldX,
            y: worldY,
            z: worldZ,
            face,
            block,
            visualHeight,
          });
        }
      }
    }
  }

  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = solid.positions;
  vertexData.indices = solid.indices;
  vertexData.normals = solid.normals;
  vertexData.colors = solid.colors;
  vertexData.uvs = solid.uvs;
  vertexData.applyToMesh(mesh);
  mesh.material = material;

  if (water.positions.length > 0) {
    const waterMesh = new Mesh(`${name}-water`, scene);
    const waterVertexData = new VertexData();
    waterVertexData.positions = water.positions;
    waterVertexData.indices = water.indices;
    waterVertexData.normals = water.normals;
    waterVertexData.colors = water.colors;
    waterVertexData.uvs = water.uvs;
    waterVertexData.applyToMesh(waterMesh);
    waterMesh.hasVertexAlpha = true;
    waterMesh.material = material;
    waterMesh.parent = mesh;
  }

  return mesh;
}

function createMeshBuffers(): MeshBuffers {
  return { positions: [], indices: [], normals: [], colors: [], uvs: [] };
}

function getBlockVisualHeight(block: BlockId): number {
  const height = getBlockDefinition(block)?.visualHeight ?? 1;

  if (!Number.isFinite(height)) {
    return 1;
  }

  return Math.min(1, Math.max(0.05, height));
}

function isTreeBlock(block: BlockId): boolean {
  return (
    block === BlockId.OakLog ||
    block === BlockId.SpruceLog ||
    block === BlockId.BirchLog ||
    block === BlockId.JungleLog ||
    block === BlockId.AcaciaLog ||
    block === BlockId.DarkOakLog ||
    block === BlockId.MangroveLog ||
    block === BlockId.CherryLog ||
    block === BlockId.OakLeaves ||
    block === BlockId.SpruceLeaves ||
    block === BlockId.BirchLeaves ||
    block === BlockId.JungleLeaves ||
    block === BlockId.AcaciaLeaves ||
    block === BlockId.DarkOakLeaves ||
    block === BlockId.MangroveLeaves ||
    block === BlockId.CherryLeaves
  );
}

function getFaceLightingNormal(block: BlockId, normal: [number, number, number]): [number, number, number] {
  if (normal[1] === -1 && isTreeBlock(block)) {
    return [0, 1, 0];
  }

  return normal;
}

function addTexturedOrFlatFace(params: {
  buffers: MeshBuffers;
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
  visualHeight?: number;
}): void {
  const faceName = getFaceName(params.face.normal);
  const textureUvs = getBlockFaceTextureUv(params.block, faceName);

  addFlatFace(params, textureUvs);
}

function addDoubleSidedFlatFace(params: {
  buffers: MeshBuffers;
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
  visualHeight?: number;
}): void {
  addFlatFace(params, getBlockFaceTextureUv(params.block, getFaceName(params.face.normal)));
  addFlatFace(params, getBlockFaceTextureUv(params.block, getFaceName(params.face.normal)), true);
}

function addFlatFace(
  params: {
    buffers: MeshBuffers;
    x: number;
    y: number;
    z: number;
    face: FaceDefinition;
    block: BlockId;
    visualHeight?: number;
  },
  textureUvs: readonly number[] | null = null,
  reverseWinding = false,
): void {
  const { buffers, x, y, z, face, block, visualHeight = 1 } = params;
  const vertexIndex = buffers.positions.length / 3;
  const color = textureUvs ? { r: 1, g: 1, b: 1, a: 1 } : getBlockFaceColor(block, face.normal);
  const lightingNormal = getFaceLightingNormal(block, face.normal);

  for (const vertex of face.vertices) {
    buffers.positions.push(
      x + vertex[0],
      y + getVertexVisualY(vertex[1], visualHeight),
      z + vertex[2],
    );
    buffers.normals.push(lightingNormal[0], lightingNormal[1], lightingNormal[2]);
    buffers.colors.push(color.r, color.g, color.b, reverseWinding ? color.a * 0.5 : color.a);
  }

  buffers.uvs.push(...(textureUvs ?? getFallbackTextureUv()));

  if (reverseWinding) {
    buffers.indices.push(vertexIndex, vertexIndex + 2, vertexIndex + 1, vertexIndex, vertexIndex + 3, vertexIndex + 2);
    return;
  }

  buffers.indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
}

function getVertexVisualY(vertexY: number, visualHeight: number): number {
  return vertexY === 1 ? visualHeight : vertexY;
}

export function spawnTexturedDrop(
  scene: Scene,
  worldX: number,
  worldY: number,
  worldZ: number,
  blockId: BlockId,
  material: StandardMaterial,
  droppedItems: DroppedItem[],
): void {
  const buffers = createMeshBuffers();

  for (const face of FACES) {
    addDroppedBlockFace(buffers, blockId, face);
  }

  const mesh = new Mesh(`drop-${blockId}-${Date.now()}`, scene);
  const vertexData = new VertexData();
  vertexData.positions = buffers.positions;
  vertexData.indices = buffers.indices;
  vertexData.normals = buffers.normals;
  vertexData.colors = buffers.colors;
  vertexData.uvs = buffers.uvs;
  vertexData.applyToMesh(mesh);

  mesh.position = new Vector3(worldX + 0.5, worldY + 0.5, worldZ + 0.5);
  mesh.material = material;
  mesh.hasVertexAlpha = true;

  droppedItems.push({
    mesh,
    blockId,
    createdAt: Date.now(),
    velocity: new Vector3(0, 0, 0),
  });
}

function addDroppedBlockFace(buffers: MeshBuffers, block: BlockId, face: FaceDefinition): void {
  const faceName = getFaceName(face.normal);
  const textureUvs = getBlockFaceTextureUv(block, faceName);
  const vertexIndex = buffers.positions.length / 3;
  const color = textureUvs ? { r: 1, g: 1, b: 1, a: 1 } : getBlockFaceColor(block, face.normal);
  const lightingNormal = getFaceLightingNormal(block, face.normal);

  for (const vertex of face.vertices) {
    buffers.positions.push(
      (vertex[0] - 0.5) * DROP_SIZE,
      (vertex[1] - 0.5) * DROP_SIZE,
      (vertex[2] - 0.5) * DROP_SIZE,
    );
    buffers.normals.push(lightingNormal[0], lightingNormal[1], lightingNormal[2]);
    buffers.colors.push(color.r, color.g, color.b, color.a);
  }

  buffers.uvs.push(...(textureUvs ?? getFallbackTextureUv()));
  buffers.indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
}

function getFaceName(normal: [number, number, number]): BlockFaceName {
  if (normal[1] === 1) return "top";
  if (normal[1] === -1) return "bottom";
  if (normal[2] === 1) return "front";
  if (normal[2] === -1) return "back";
  if (normal[0] === 1) return "right";
  return "left";
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
  const { scene, worldChunks, wasm, material, player, sizeX, sizeY, sizeZ, radius = RENDER_CHUNK_RADIUS } = params;
  const centerChunkX = getCurrentChunkCoordinate(player.position.x, sizeX);
  const centerChunkZ = getCurrentChunkCoordinate(player.position.z, sizeZ);
  const requiredChunkKeys = new Set<string>();

  for (let offsetZ = -radius; offsetZ <= radius; offsetZ++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      const chunkX = centerChunkX + offsetX;
      const chunkZ = centerChunkZ + offsetZ;
      const key = getChunkKey(chunkX, chunkZ);
      requiredChunkKeys.add(key);

      if (worldChunks.has(key)) continue;

      const blocks = wasm.generate_chunk(chunkX, chunkZ, SEED);
      const mesh = createChunkMesh({ scene, name: `chunk-${chunkX}-${chunkZ}`, blocks, sizeX, sizeY, sizeZ, chunkX, chunkZ, material });
      worldChunks.set(key, { chunkX, chunkZ, blocks, mesh });
    }
  }

  for (const [key, chunk] of worldChunks.entries()) {
    if (requiredChunkKeys.has(key)) continue;

    chunk.mesh.dispose();
    worldChunks.delete(key);
  }
}

export function breakBlock(params: BreakBlockParams): void {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ, material, droppedItems } = params;
  const ray = scene.createPickingRay(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2, null, scene.activeCamera);
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();
  let targetWorldX = 0;
  let targetWorldY = 0;
  let targetWorldZ = 0;
  let found = false;

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

  if (!found) return;

  const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, targetWorldX, targetWorldZ);
  if (!chunk) return;

  const localX = worldToLocalCoordinate(targetWorldX, sizeX);
  const localZ = worldToLocalCoordinate(targetWorldZ, sizeZ);
  const brokenBlock = getBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, targetWorldY, localZ);
  let newBlock = BlockId.Air;
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

  if (brokenBlock !== BlockId.Air) {
    spawnTexturedDrop(scene, targetWorldX, targetWorldY, targetWorldZ, brokenBlock, material, droppedItems);
  }

  rebuildAffectedChunks(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk, localX, localZ);
}

export function placeBlock(params: BreakBlockParams): void {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ, material } = params;
  const selectedItem = player.inventory[player.selectedSlot];

  if (!selectedItem || selectedItem.count <= 0) {
    return;
  }

  const blockToPlace = selectedItem.blockId;
  const blockDefinition = getBlockDefinition(blockToPlace);

  // Uniquement les blocs connus peuvent etre poses (pas les items/outils).
  if (!blockDefinition || blockToPlace === BlockId.Air) {
    return;
  }

  const ray = scene.createPickingRay(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2, null, scene.activeCamera);
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();
  let placeTarget: { x: number; y: number; z: number } | null = null;

  for (let distance = 0.1; distance <= 3; distance += 0.1) {
    const point = start.add(direction.scale(distance));
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);
    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z);

    if (block === BlockId.Air || block === BlockId.Water) {
      placeTarget = { x, y, z };
      continue;
    }

    break;
  }

  if (!placeTarget) {
    return;
  }

  const existingBlock = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, placeTarget.x, placeTarget.y, placeTarget.z);

  if (existingBlock !== BlockId.Air && existingBlock !== BlockId.Water) {
    return;
  }

  if (blockDefinition.solid && !canPlaceSolidBlockAt(player, placeTarget.x, placeTarget.y, placeTarget.z)) {
    return;
  }

  const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, placeTarget.x, placeTarget.z);

  if (!chunk) {
    return;
  }

  const localX = worldToLocalCoordinate(placeTarget.x, sizeX);
  const localZ = worldToLocalCoordinate(placeTarget.z, sizeZ);

  setBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, placeTarget.y, localZ, blockToPlace);
  rebuildAffectedChunks(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk, localX, localZ);

  selectedItem.count -= 1;

  if (selectedItem.count <= 0) {
    player.inventory.splice(player.selectedSlot, 1);
  }

  if ((player as any)._updateInventoryUI) {
    (player as any)._updateInventoryUI();
  }
}

function canPlaceSolidBlockAt(player: PlayerPhysics, blockX: number, blockY: number, blockZ: number): boolean {
  const playerMinX = player.position.x - PLAYER_RADIUS;
  const playerMaxX = player.position.x + PLAYER_RADIUS;
  const playerMinY = player.position.y;
  const playerMaxY = player.position.y + PLAYER_HEIGHT;
  const playerMinZ = player.position.z - PLAYER_RADIUS;
  const playerMaxZ = player.position.z + PLAYER_RADIUS;

  const blockMinX = blockX;
  const blockMaxX = blockX + 1;
  const blockMinY = blockY;
  const blockMaxY = blockY + 1;
  const blockMinZ = blockZ;
  const blockMaxZ = blockZ + 1;

  const overlapsX = playerMinX < blockMaxX && playerMaxX > blockMinX;
  const overlapsY = playerMinY < blockMaxY && playerMaxY > blockMinY;
  const overlapsZ = playerMinZ < blockMaxZ && playerMaxZ > blockMinZ;

  return !(overlapsX && overlapsY && overlapsZ);
}

function rebuildAffectedChunks(
  scene: Scene,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
  chunk: WorldChunk,
  localX: number,
  localZ: number,
): void {
  const affectedChunks = new Set<string>([getChunkKey(chunk.chunkX, chunk.chunkZ)]);

  if (localX === 0) affectedChunks.add(getChunkKey(chunk.chunkX - 1, chunk.chunkZ));
  if (localX === sizeX - 1) affectedChunks.add(getChunkKey(chunk.chunkX + 1, chunk.chunkZ));
  if (localZ === 0) affectedChunks.add(getChunkKey(chunk.chunkX, chunk.chunkZ - 1));
  if (localZ === sizeZ - 1) affectedChunks.add(getChunkKey(chunk.chunkX, chunk.chunkZ + 1));

  for (const key of affectedChunks) {
    const affectedChunk = worldChunks.get(key);
    if (!affectedChunk) continue;

    const oldMesh = affectedChunk.mesh;
    affectedChunk.mesh = createChunkMesh({
      scene,
      name: `chunk-${affectedChunk.chunkX}-${affectedChunk.chunkZ}`,
      blocks: affectedChunk.blocks,
      sizeX,
      sizeY,
      sizeZ,
      chunkX: affectedChunk.chunkX,
      chunkZ: affectedChunk.chunkZ,
      material,
    });
    oldMesh.dispose();
  }
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
    item.velocity.y += GRAVITY * deltaTime;
    const nextY = item.mesh.position.y + item.velocity.y * deltaTime;
    const worldX = item.mesh.position.x;
    const worldZ = item.mesh.position.z;
    const blockBelow = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, worldX, nextY - 0.15, worldZ);

    if (isSolidBlock(blockBelow)) {
      item.velocity.y = 0;
      item.mesh.position.y = Math.floor(nextY - 0.15) + 1 + 0.15;
    } else {
      item.mesh.position.y = nextY;
    }

    item.mesh.rotation.y += 2 * deltaTime;

    if (item.velocity.y === 0) {
      item.mesh.position.y += Math.sin(now / 200) * 0.001;
    }

    if (Vector3.Distance(player.position, item.mesh.position) < 1.5) {
      item.mesh.dispose();
      droppedItems.splice(i, 1);
      addToInventory(player, item.blockId);
      if ((player as any)._updateInventoryUI) (player as any)._updateInventoryUI();
      continue;
    }

    if (now - item.createdAt > 60000) {
      item.mesh.dispose();
      droppedItems.splice(i, 1);
    }
  }
}