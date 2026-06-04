import { Mesh, Scene, StandardMaterial, Vector3, VertexData } from "@babylonjs/core";
import { EYE_HEIGHT, FACES, GRAVITY, RENDER_CHUNK_RADIUS, SEED } from "./constants";
import { getBlockDefinition, type BlockFaceName, type BlockTextureDefinition, type RgbaColor } from "./blocks";
import {
  addToInventory,
  addWaterTopFaceDoubleSided,
  getBlock,
  getBlockFaceColor,
  getChunkFromWorldPosition,
  getChunkKey,
  getCurrentChunkCoordinate,
  getWorldBlock,
  isSolidBlock,
  isTransparentForMeshing,
  setBlock,
  spawnDrop,
  worldToLocalCoordinate,
} from "./functions";
import type { CreateChunkMeshParams, DroppedItem, FaceDefinition, PlayerPhysics, VoxelWasmModule, WorldChunk, WorldChunks } from "./types";
import { BlockId } from "./types";

const BLOCK_TEXTURE_SIZE = 16;

type MeshBuffers = {
  positions: number[];
  indices: number[];
  normals: number[];
  colors: number[];
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
  const { scene, name, blocks, sizeX, sizeY, sizeZ, chunkX, chunkZ, material } = params;

  const solid: MeshBuffers = { positions: [], indices: [], normals: [], colors: [] };
  const water: MeshBuffers = { positions: [], indices: [], normals: [], colors: [] };
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
          const topNeighbor = getBlock(blocks, sizeX, sizeY, sizeZ, x, y + 1, z);

          if (topNeighbor === BlockId.Air) {
            addWaterTopFaceDoubleSided({
              positions: water.positions,
              indices: water.indices,
              normals: water.normals,
              colors: water.colors,
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

          if (!isTransparentForMeshing(neighbor)) continue;

          addTexturedOrFlatFace({
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

  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = solid.positions;
  vertexData.indices = solid.indices;
  vertexData.normals = solid.normals;
  vertexData.colors = solid.colors;
  vertexData.applyToMesh(mesh);
  mesh.material = material;

  if (water.positions.length > 0) {
    const waterMesh = new Mesh(`${name}-water`, scene);
    const waterVertexData = new VertexData();
    waterVertexData.positions = water.positions;
    waterVertexData.indices = water.indices;
    waterVertexData.normals = water.normals;
    waterVertexData.colors = water.colors;
    waterVertexData.applyToMesh(waterMesh);
    waterMesh.hasVertexAlpha = true;
    waterMesh.material = material;
    waterMesh.parent = mesh;
  }

  return mesh;
}

function addTexturedOrFlatFace(params: {
  buffers: MeshBuffers;
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
}): void {
  const faceName = getFaceName(params.face.normal);
  const texture = getBlockDefinition(params.block)?.textures?.[faceName] ?? null;

  if (!texture) {
    addFlatFace(params);
    return;
  }

  addMatrixTexturedFace({ ...params, texture });
}

function addFlatFace(params: {
  buffers: MeshBuffers;
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
}): void {
  const { buffers, x, y, z, face, block } = params;
  const vertexIndex = buffers.positions.length / 3;
  const color = getBlockFaceColor(block, face.normal);

  for (const vertex of face.vertices) {
    buffers.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);
    buffers.colors.push(color.r, color.g, color.b, color.a);
  }

  buffers.indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
}

function addMatrixTexturedFace(params: {
  buffers: MeshBuffers;
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  texture: BlockTextureDefinition;
}): void {
  const { buffers, x, y, z, face, texture } = params;

  for (let row = 0; row < BLOCK_TEXTURE_SIZE; row++) {
    const textureRow = texture.matrix[row];

    for (let column = 0; column < BLOCK_TEXTURE_SIZE; column++) {
      const colorKey = textureRow[column];
      const rgba = texture.palette[colorKey];

      if (!rgba) continue;

      const u0 = column / BLOCK_TEXTURE_SIZE;
      const u1 = (column + 1) / BLOCK_TEXTURE_SIZE;
      const v0 = row / BLOCK_TEXTURE_SIZE;
      const v1 = (row + 1) / BLOCK_TEXTURE_SIZE;
      const vertexIndex = buffers.positions.length / 3;
      const vertices = [
        interpolateFaceVertex(face, u0, v0),
        interpolateFaceVertex(face, u1, v0),
        interpolateFaceVertex(face, u1, v1),
        interpolateFaceVertex(face, u0, v1),
      ];

      for (const vertex of vertices) {
        buffers.positions.push(x + vertex.x, y + vertex.y, z + vertex.z);
        buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);
        buffers.colors.push(rgba[0], rgba[1], rgba[2], rgba[3]);
      }

      buffers.indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
    }
  }
}

function interpolateFaceVertex(face: FaceDefinition, u: number, v: number): Vector3 {
  const [a, b, c, d] = face.vertices;
  const topX = a[0] + (b[0] - a[0]) * u;
  const topY = a[1] + (b[1] - a[1]) * u;
  const topZ = a[2] + (b[2] - a[2]) * u;
  const bottomX = d[0] + (c[0] - d[0]) * u;
  const bottomY = d[1] + (c[1] - d[1]) * u;
  const bottomZ = d[2] + (c[2] - d[2]) * u;

  return new Vector3(
    topX + (bottomX - topX) * v,
    topY + (bottomY - topY) * v,
    topZ + (bottomZ - topZ) * v,
  );
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
    spawnDrop(scene, targetWorldX, targetWorldY, targetWorldZ, brokenBlock, droppedItems);
  }

  rebuildAffectedChunks(scene, worldChunks, sizeX, sizeY, sizeZ, material, chunk, localX, localZ);
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
