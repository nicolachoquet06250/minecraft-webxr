import { Mesh, Ray, Scene, StandardMaterial, TransformNode, Vector3, VertexData } from "@babylonjs/core";
import { EYE_HEIGHT, FACES, GRAVITY, PLAYER_HEIGHT, PLAYER_RADIUS, RENDER_CHUNK_RADIUS, SEED } from "./constants";
import { getBlockFaceTextureUv, getFallbackTextureUv } from "./block-atlas";
import { getBlockDefinition } from "./blocks";
import type { BlockFaceName } from "./blocks";
import { attachPoppyModelToParent } from "./poppy-models";
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
const BLOCK_INTERACTION_REACH = 3;
const BLOCK_INTERACTION_STEP = 0.1;
const DROP_PICKUP_DELAY_MS = 350;
const DROP_PICKUP_DISTANCE = 1.15;
const DROP_GROUND_DAMPING = 0.82;
const DROP_HORIZONTAL_DAMPING = 0.94;

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
  targetRay?: Ray | null;
};

type WorldBlockPosition = { x: number; y: number; z: number };

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

  const solid = createMeshBuffers();
  const water = createMeshBuffers();
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

        if (block === BlockId.Water) {
          addWaterGeometryForBlock({
            buffers: water,
            blocks,
            sizeX,
            sizeY,
            sizeZ,
            x,
            y,
            z,
            worldX,
            worldY,
            worldZ,
            block,
          });
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
            addTexturedFace({
              buffers: solid,
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
  applyBuffersToMesh(mesh, solid);
  mesh.material = material;

  if (water.positions.length > 0) {
    const waterMesh = new Mesh(`${name}-water`, scene);
    applyBuffersToMesh(waterMesh, water);
    waterMesh.hasVertexAlpha = true;
    waterMesh.material = material;
    waterMesh.parent = mesh;
  }

  return mesh;
}

type AddWaterGeometryParams = {
  buffers: MeshBuffers;
  blocks: Uint8Array;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  x: number;
  y: number;
  z: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  block: BlockId;
};

function addWaterGeometryForBlock(params: AddWaterGeometryParams): void {
  const { buffers, blocks, sizeX, sizeY, sizeZ, x, y, z, worldX, worldY, worldZ, block } = params;
  const topNeighbor = getBlock(blocks, sizeX, sizeY, sizeZ, x, y + 1, z);

  if (topNeighbor !== BlockId.Air) {
    return;
  }

  addTexturedFace({
    buffers,
    x: worldX,
    y: worldY + getBlockVisualHeight(block) - 1,
    z: worldZ,
    face: FACES[0],
    block,
  });
}

function getBlockVisualHeight(block: BlockId): number {
  return getBlockDefinition(block)?.visualHeight ?? 1;
}

function createMeshBuffers(): MeshBuffers {
  return {
    positions: [],
    indices: [],
    normals: [],
    colors: [],
    uvs: [],
  };
}

type AddTexturedFaceParams = {
  buffers: MeshBuffers;
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
};

function addTexturedFace(params: AddTexturedFaceParams): void {
  const { buffers, x, y, z, face, block } = params;
  const vertexIndex = buffers.positions.length / 3;
  const color = getBlockFaceColor(block, face.normal);
  const uv = getFaceTextureUv(block, face);

  for (const vertex of face.vertices) {
    buffers.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);
    buffers.colors.push(color.r, color.g, color.b, color.a);
  }

  buffers.indices.push(
    vertexIndex,
    vertexIndex + 1,
    vertexIndex + 2,
    vertexIndex,
    vertexIndex + 2,
    vertexIndex + 3,
  );

  buffers.uvs.push(...uv);
}

function addDroppedTexturedFace(buffers: MeshBuffers, face: FaceDefinition, block: BlockId): void {
  const vertexIndex = buffers.positions.length / 3;
  const color = getBlockFaceColor(block, face.normal);
  const uv = getFaceTextureUv(block, face);

  for (const vertex of face.vertices) {
    buffers.positions.push(
      (vertex[0] - 0.5) * DROP_SIZE,
      (vertex[1] - 0.5) * DROP_SIZE,
      (vertex[2] - 0.5) * DROP_SIZE,
    );
    buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);
    buffers.colors.push(color.r, color.g, color.b, color.a);
  }

  buffers.indices.push(
    vertexIndex,
    vertexIndex + 1,
    vertexIndex + 2,
    vertexIndex,
    vertexIndex + 2,
    vertexIndex + 3,
  );

  buffers.uvs.push(...uv);
}

function getFaceTextureUv(block: BlockId, face: FaceDefinition): readonly number[] {
  return getBlockFaceTextureUv(block, getFaceName(face)) ?? getFallbackTextureUv();
}

function getFaceName(face: FaceDefinition): BlockFaceName {
  const [nx, ny, nz] = face.normal;

  if (ny === 1) return "top";
  if (ny === -1) return "bottom";
  if (nz === 1) return "front";
  if (nz === -1) return "back";
  if (nx === 1) return "right";

  return "left";
}

function applyBuffersToMesh(mesh: Mesh, buffers: MeshBuffers): void {
  const vertexData = new VertexData();
  vertexData.positions = buffers.positions;
  vertexData.indices = buffers.indices;
  vertexData.normals = buffers.normals;
  vertexData.colors = buffers.colors;
  vertexData.uvs = buffers.uvs;
  vertexData.applyToMesh(mesh);
}

function createDroppedBlockMesh(scene: Scene, blockId: BlockId, material: StandardMaterial): Mesh {
  const mesh = new Mesh(`dropped-block-${blockId}`, scene);
  const buffers = createMeshBuffers();

  for (const face of FACES) {
    addDroppedTexturedFace(buffers, face, blockId);
  }

  applyBuffersToMesh(mesh, buffers);
  mesh.hasVertexAlpha = true;
  mesh.material = material;

  return mesh;
}

export function dropBlock(
  scene: Scene,
  blockId: BlockId,
  position: Vector3,
  material: StandardMaterial,
  droppedItems: DroppedItem[],
): void {
  const root = new TransformNode("dropped-block-root", scene);
  root.position.copyFrom(position);

  if (blockId === BlockId.Poppy) {
    void attachPoppyModelToParent(scene, root, `dropped-poppy-${Date.now()}-${Math.random()}`);
  } else {
    const mesh = createDroppedBlockMesh(scene, blockId, material);
    mesh.parent = root;
  }

  root.scaling.setAll(0.85);
  root.rotation.y = Math.random() * Math.PI * 2;

  droppedItems.push({
    blockId,
    mesh: root,
    velocity: new Vector3((Math.random() - 0.5) * 1.5, 3.5, (Math.random() - 0.5) * 1.5),
    createdAt: Date.now(),
  });
}

export function spawnTexturedDrop(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  blockId: BlockId,
  material: StandardMaterial,
  droppedItems: DroppedItem[],
): void {
  dropBlock(scene, blockId, new Vector3(x + 0.5, y + 0.5, z + 0.5), material, droppedItems);
}

export function breakBlock(params: BreakBlockParams): void {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, material, droppedItems } = params;
  const target = findFirstSolidBlockFromInteractionRay(params);

  if (!target) {
    return;
  }

  const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, target.x, target.z);

  if (!chunk) {
    return;
  }

  const localX = worldToLocalCoordinate(target.x, sizeX);
  const localZ = worldToLocalCoordinate(target.z, sizeZ);
  setBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, target.y, localZ, BlockId.Air);
  rebuildAffectedChunks(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk, localX, localZ);
  dropBlock(scene, target.block, new Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5), material, droppedItems);
}

export function placeBlock(params: BreakBlockParams): void {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ, material } = params;
  const selectedItem = player.inventory[player.selectedSlot];

  if (!selectedItem) {
    return;
  }

  const blockToPlace = selectedItem.blockId;
  const blockDefinition = getBlockDefinition(blockToPlace);

  if (!blockDefinition || blockToPlace === BlockId.Air) {
    return;
  }

  const placeTarget = findLastReplaceableBlockBeforeSolidFromInteractionRay(params);

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

  for (let index = droppedItems.length - 1; index >= 0; index--) {
    const item = droppedItems[index];
    const mesh = item.mesh;

    item.velocity.y += GRAVITY * deltaTime;
    mesh.position.addInPlace(item.velocity.scale(deltaTime));
    mesh.rotation.y += deltaTime * 1.8;

    const blockBelow = getWorldBlock(
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      Math.floor(mesh.position.x),
      Math.floor(mesh.position.y - DROP_SIZE / 2),
      Math.floor(mesh.position.z),
    );

    if (isSolidBlock(blockBelow) && item.velocity.y < 0) {
      mesh.position.y = Math.floor(mesh.position.y - DROP_SIZE / 2) + 1 + DROP_SIZE / 2;
      item.velocity.y = Math.abs(item.velocity.y) * DROP_GROUND_DAMPING;

      if (Math.abs(item.velocity.y) < 0.08) {
        item.velocity.y = 0;
      }
    }

    item.velocity.x *= DROP_HORIZONTAL_DAMPING;
    item.velocity.z *= DROP_HORIZONTAL_DAMPING;

    if (now - item.createdAt >= DROP_PICKUP_DELAY_MS && Vector3.Distance(mesh.position, player.position) <= DROP_PICKUP_DISTANCE) {
      addToInventory(player, item.blockId);

      if ((player as any)._updateInventoryUI) {
        (player as any)._updateInventoryUI();
      }

      mesh.dispose();
      droppedItems.splice(index, 1);
    }
  }
}

function getInteractionRay(params: BreakBlockParams): Ray {
  if (params.targetRay) {
    return params.targetRay;
  }

  const { scene, player } = params;
  const ray = scene.createPickingRay(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2, null, scene.activeCamera);
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));

  return new Ray(start, ray.direction.normalize(), BLOCK_INTERACTION_REACH);
}

function findFirstSolidBlockFromInteractionRay(params: BreakBlockParams): (WorldBlockPosition & { block: BlockId }) | null {
  const { worldChunks, sizeX, sizeY, sizeZ } = params;
  const ray = getInteractionRay(params);
  const direction = ray.direction.normalize();
  const reach = getInteractionRayReach(ray);

  for (let distance = BLOCK_INTERACTION_STEP; distance <= reach; distance += BLOCK_INTERACTION_STEP) {
    const point = ray.origin.add(direction.scale(distance));
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);
    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z);

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { x, y, z, block };
    }
  }

  return null;
}

function findLastReplaceableBlockBeforeSolidFromInteractionRay(params: BreakBlockParams): WorldBlockPosition | null {
  const { worldChunks, sizeX, sizeY, sizeZ } = params;
  const ray = getInteractionRay(params);
  const direction = ray.direction.normalize();
  const reach = getInteractionRayReach(ray);
  let lastReplaceable: WorldBlockPosition | null = null;

  for (let distance = BLOCK_INTERACTION_STEP; distance <= reach; distance += BLOCK_INTERACTION_STEP) {
    const point = ray.origin.add(direction.scale(distance));
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);
    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z);

    if (block === BlockId.Air || block === BlockId.Water) {
      lastReplaceable = { x, y, z };
      continue;
    }

    return lastReplaceable;
  }

  return null;
}

function getInteractionRayReach(ray: Ray): number {
  return Number.isFinite(ray.length) && ray.length > 0 ? ray.length : BLOCK_INTERACTION_REACH;
}

function canPlaceSolidBlockAt(player: PlayerPhysics, x: number, y: number, z: number): boolean {
  const minX = player.position.x - PLAYER_RADIUS;
  const maxX = player.position.x + PLAYER_RADIUS;
  const minY = player.position.y;
  const maxY = player.position.y + PLAYER_HEIGHT;
  const minZ = player.position.z - PLAYER_RADIUS;
  const maxZ = player.position.z + PLAYER_RADIUS;

  return !(
    x + 1 > minX &&
    x < maxX &&
    y + 1 > minY &&
    y < maxY &&
    z + 1 > minZ &&
    z < maxZ
  );
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
  rebuildChunk(scene, sizeX, sizeY, sizeZ, material, chunk);

  if (localX === 0) {
    rebuildNeighborChunk(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk.chunkX - 1, chunk.chunkZ);
  } else if (localX === sizeX - 1) {
    rebuildNeighborChunk(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk.chunkX + 1, chunk.chunkZ);
  }

  if (localZ === 0) {
    rebuildNeighborChunk(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk.chunkX, chunk.chunkZ - 1);
  } else if (localZ === sizeZ - 1) {
    rebuildNeighborChunk(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk.chunkX, chunk.chunkZ + 1);
  }
}

function rebuildNeighborChunk(
  scene: Scene,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
  chunkX: number,
  chunkZ: number,
): void {
  const chunk = worldChunks.get(getChunkKey(chunkX, chunkZ));

  if (chunk) {
    rebuildChunk(scene, sizeX, sizeY, sizeZ, material, chunk);
  }
}

function rebuildChunk(
  scene: Scene,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
  chunk: WorldChunk,
): void {
  chunk.mesh.dispose();

  const mesh = createChunkMesh({
    scene,
    name: `chunk-${chunk.chunkX}-${chunk.chunkZ}`,
    blocks: chunk.blocks,
    sizeX,
    sizeY,
    sizeZ,
    chunkX: chunk.chunkX,
    chunkZ: chunk.chunkZ,
    material,
  });

  chunk.mesh = mesh;
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
}): void {
  const centerChunkX = getCurrentChunkCoordinate(params.player.position.x, params.sizeX);
  const centerChunkZ = getCurrentChunkCoordinate(params.player.position.z, params.sizeZ);

  for (let dz = -RENDER_CHUNK_RADIUS; dz <= RENDER_CHUNK_RADIUS; dz++) {
    for (let dx = -RENDER_CHUNK_RADIUS; dx <= RENDER_CHUNK_RADIUS; dx++) {
      const chunkX = centerChunkX + dx;
      const chunkZ = centerChunkZ + dz;
      const key = getChunkKey(chunkX, chunkZ);

      if (params.worldChunks.has(key)) {
        continue;
      }

      const blocks = params.wasm.generate_chunk(chunkX, chunkZ, SEED);
      const mesh = createChunkMesh({
        scene: params.scene,
        name: `chunk-${chunkX}-${chunkZ}`,
        blocks,
        sizeX: params.sizeX,
        sizeY: params.sizeY,
        sizeZ: params.sizeZ,
        chunkX,
        chunkZ,
        material: params.material,
      });

      params.worldChunks.set(key, {
        chunkX,
        chunkZ,
        blocks,
        mesh,
      });
    }
  }
}
