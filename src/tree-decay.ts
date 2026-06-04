import type { Scene, StandardMaterial } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import {
  EYE_HEIGHT,
  LEAF_DECAY_INTERVAL_MS,
  TREE_DECAY_LEAF_SEARCH_RADIUS,
  TREE_DECAY_LOG_SEARCH_RADIUS,
} from "./constants";
import {
  getChunkFromWorldPosition,
  getChunkKey,
  getWorldBlock,
  setBlock,
  spawnDrop,
  worldToLocalCoordinate,
} from "./functions";
import {
  breakBlock as breakBlockBase,
  createChunkMesh,
} from "./textured-world";
import { BlockId, type DroppedItem, type PlayerPhysics, type WorldChunks } from "./types";

export type BreakBlockWithLeafDecayParams = {
  scene: Scene;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  material: StandardMaterial;
  droppedItems: DroppedItem[];
};

type WorldBlockPosition = { x: number; y: number; z: number };

const scheduledLeafDecay = new Set<string>();

export function breakBlock(params: BreakBlockWithLeafDecayParams): void {
  const target = findTargetBlock(params);

  breakBlockBase(params);

  if (target && isLogBlock(target.block)) {
    scheduleLeafDecayIfTreeHasNoLogs(params, target.position);
  }
}

function findTargetBlock(params: BreakBlockWithLeafDecayParams): { position: WorldBlockPosition; block: BlockId } | null {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ } = params;
  const ray = scene.createPickingRay(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2, null, scene.activeCamera);
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();

  for (let d = 0.1; d <= 3; d += 0.1) {
    const p = start.add(direction.scale(d));
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const z = Math.floor(p.z);
    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z);

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { position: { x, y, z }, block };
    }
  }

  return null;
}

function scheduleLeafDecayIfTreeHasNoLogs(params: BreakBlockWithLeafDecayParams, origin: WorldBlockPosition): void {
  if (hasLogAround(params, origin)) return;

  findLeavesAround(params, origin).forEach((leaf, index) => {
    const key = toPositionKey(leaf);

    if (scheduledLeafDecay.has(key)) return;

    scheduledLeafDecay.add(key);

    window.setTimeout(() => {
      scheduledLeafDecay.delete(key);
      decayLeaf(params, leaf);
    }, LEAF_DECAY_INTERVAL_MS * (index + 1));
  });
}

function decayLeaf(params: BreakBlockWithLeafDecayParams, leaf: WorldBlockPosition): void {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, droppedItems } = params;
  const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, leaf.x, leaf.y, leaf.z);

  if (!isLeafBlock(block)) return;

  const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, leaf.x, leaf.z);

  if (!chunk) return;

  const localX = worldToLocalCoordinate(leaf.x, sizeX);
  const localZ = worldToLocalCoordinate(leaf.z, sizeZ);

  setBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, leaf.y, localZ, BlockId.Air);
  spawnDrop(scene, leaf.x, leaf.y, leaf.z, block, droppedItems);
  rebuildAffectedChunks(params, chunk.chunkX, chunk.chunkZ, localX, localZ);
}

function hasLogAround(params: BreakBlockWithLeafDecayParams, origin: WorldBlockPosition): boolean {
  const { worldChunks, sizeX, sizeY, sizeZ } = params;
  const radius = TREE_DECAY_LOG_SEARCH_RADIUS;

  for (let y = Math.max(0, origin.y - radius); y <= Math.min(sizeY - 1, origin.y + radius); y++) {
    for (let z = origin.z - radius; z <= origin.z + radius; z++) {
      for (let x = origin.x - radius; x <= origin.x + radius; x++) {
        if (isLogBlock(getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z))) return true;
      }
    }
  }

  return false;
}

function findLeavesAround(params: BreakBlockWithLeafDecayParams, origin: WorldBlockPosition): WorldBlockPosition[] {
  const { worldChunks, sizeX, sizeY, sizeZ } = params;
  const radius = TREE_DECAY_LEAF_SEARCH_RADIUS;
  const leaves: WorldBlockPosition[] = [];

  for (let y = Math.max(0, origin.y - radius); y <= Math.min(sizeY - 1, origin.y + radius); y++) {
    for (let z = origin.z - radius; z <= origin.z + radius; z++) {
      for (let x = origin.x - radius; x <= origin.x + radius; x++) {
        if (isLeafBlock(getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z))) leaves.push({ x, y, z });
      }
    }
  }

  return leaves.sort((a, b) => getSquaredDistance(origin, a) - getSquaredDistance(origin, b));
}

function rebuildAffectedChunks(params: BreakBlockWithLeafDecayParams, chunkX: number, chunkZ: number, localX: number, localZ: number): void {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, material } = params;
  const affectedChunks = new Set<string>([getChunkKey(chunkX, chunkZ)]);

  if (localX === 0) affectedChunks.add(getChunkKey(chunkX - 1, chunkZ));
  if (localX === sizeX - 1) affectedChunks.add(getChunkKey(chunkX + 1, chunkZ));
  if (localZ === 0) affectedChunks.add(getChunkKey(chunkX, chunkZ - 1));
  if (localZ === sizeZ - 1) affectedChunks.add(getChunkKey(chunkX, chunkZ + 1));

  for (const key of affectedChunks) {
    const chunk = worldChunks.get(key);
    if (!chunk) continue;

    const oldMesh = chunk.mesh;
    chunk.mesh = createChunkMesh({
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
    oldMesh.dispose();
  }
}

function isLogBlock(block: BlockId): boolean {
  return block >= BlockId.OakLog && block <= BlockId.CherryLog;
}

function isLeafBlock(block: BlockId): boolean {
  return block >= BlockId.OakLeaves && block <= BlockId.CherryLeaves;
}

function getSquaredDistance(a: WorldBlockPosition, b: WorldBlockPosition): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function toPositionKey(position: WorldBlockPosition): string {
  return `${position.x}:${position.y}:${position.z}`;
}
