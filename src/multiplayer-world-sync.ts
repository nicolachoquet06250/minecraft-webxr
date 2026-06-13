import {
  Color3,
  Mesh,
  MeshBuilder,
  Ray,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { EYE_HEIGHT } from "./constants";
import {
  getChunkFromWorldPosition,
  getWorldBlock,
  setBlock,
  worldToLocalCoordinate,
} from "./functions";
import { isBlockBreakingActive } from "./block-breaking";
import { createChunkMesh, dropBlock } from "./textured-world";
import { MultiplayerClient, type MultiplayerSyncEvent } from "./multiplayer-client";
import { BlockId, type DroppedItem, type PlayerPhysics, type WorldChunk, type WorldChunks } from "./types";

type SyncParams = {
  scene: Scene;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  material: StandardMaterial;
  droppedItems: DroppedItem[];
};

type TargetBlock = {
  x: number;
  y: number;
  z: number;
  block: BlockId;
};

type RemoteBreaking = {
  mesh: Mesh;
  material: StandardMaterial;
};

const BREAKING_REACH = 3;
const BREAKING_STEP = 0.1;
const BREAKING_STAGE_COUNT = 4;
const LOCAL_SYNC_TICK_MS = 90;
const DROP_ID_PREFIX = "drop";

let params: SyncParams | null = null;
let initialized = false;
let loopStarted = false;
let wasBreaking = false;
let activeTarget: TargetBlock | null = null;
let activeProgress = 0;
let lastSyncAt = 0;
let localDropCounter = 0;
const knownDrops = new Map<DroppedItem, string>();
const remoteBreakingMeshes = new Map<string, RemoteBreaking>();
const removedDropIds = new Set<string>();

export function initializeMultiplayerWorldSync(syncParams: SyncParams): void {
  params = syncParams;

  if (!initialized) {
    initialized = true;
    window.addEventListener("voxicraft:multiplayer-sync", handleSyncEvent as EventListener);
  }

  if (!loopStarted) {
    loopStarted = true;
    requestAnimationFrame(syncLoop);
  }
}

function syncLoop(): void {
  requestAnimationFrame(syncLoop);

  const context = params;

  if (!context) {
    return;
  }

  syncLocalBreaking(context);
  syncLocalDrops(context);
}

function syncLocalBreaking(context: SyncParams): void {
  const breaking = isBlockBreakingActive();
  const now = performance.now();

  if (breaking) {
    const target = findTargetBlock(context);

    if (!target) {
      return;
    }

    const targetChanged = !activeTarget || !sameTarget(activeTarget, target);

    if (!wasBreaking || targetChanged) {
      activeTarget = target;
      activeProgress = 0;
      MultiplayerClient.syncEvent({
        kind: "block_breaking",
        action: "start",
        x: target.x,
        y: target.y,
        z: target.z,
        blockId: target.block,
        progress: 0,
        stage: 0,
      });
      lastSyncAt = now;
    } else if (now - lastSyncAt >= LOCAL_SYNC_TICK_MS) {
      activeProgress = Math.min(0.98, activeProgress + (now - lastSyncAt) / 1000);
      MultiplayerClient.syncEvent({
        kind: "block_breaking",
        action: "progress",
        x: target.x,
        y: target.y,
        z: target.z,
        blockId: target.block,
        progress: activeProgress,
        stage: Math.min(BREAKING_STAGE_COUNT - 1, Math.floor(activeProgress * BREAKING_STAGE_COUNT)),
      });
      lastSyncAt = now;
    }

    wasBreaking = true;
    return;
  }

  if (!wasBreaking || !activeTarget) {
    return;
  }

  const finalBlock = getWorldBlock(
    context.worldChunks,
    context.sizeX,
    context.sizeY,
    context.sizeZ,
    activeTarget.x,
    activeTarget.y,
    activeTarget.z,
  );
  const action = finalBlock === BlockId.Air ? "finish" : "cancel";

  MultiplayerClient.syncEvent({
    kind: "block_breaking",
    action,
    x: activeTarget.x,
    y: activeTarget.y,
    z: activeTarget.z,
    blockId: activeTarget.block,
    progress: action === "finish" ? 1 : activeProgress,
    stage: action === "finish" ? BREAKING_STAGE_COUNT - 1 : Math.min(BREAKING_STAGE_COUNT - 1, Math.floor(activeProgress * BREAKING_STAGE_COUNT)),
  });

  activeTarget = null;
  activeProgress = 0;
  wasBreaking = false;
}

function syncLocalDrops(context: SyncParams): void {
  const liveDropIds = new Set<string>();

  for (const item of context.droppedItems) {
    let dropId = item.dropId ?? knownDrops.get(item);

    if (!dropId) {
      dropId = createDropId();
      item.dropId = dropId;
      knownDrops.set(item, dropId);

      MultiplayerClient.syncEvent({
        kind: "drop_spawned",
        dropId,
        blockId: item.blockId,
        position: [item.mesh.position.x, item.mesh.position.y, item.mesh.position.z],
        velocity: [item.velocity.x, item.velocity.y, item.velocity.z],
      });
    }

    liveDropIds.add(dropId);
  }

  for (const [item, dropId] of [...knownDrops.entries()]) {
    if (liveDropIds.has(dropId)) {
      continue;
    }

    knownDrops.delete(item);

    if (removedDropIds.delete(dropId)) {
      continue;
    }

    MultiplayerClient.syncEvent({
      kind: "drop_picked_up",
      dropId,
    });
  }
}

function handleSyncEvent(event: CustomEvent<{ playerId: string; event: MultiplayerSyncEvent }>): void {
  const syncEvent = event.detail?.event;

  if (!syncEvent) {
    return;
  }

  switch (syncEvent.kind) {
    case "block_breaking":
      applyRemoteBlockBreaking(syncEvent);
      return;
    case "drop_spawned":
      spawnRemoteDrop(syncEvent);
      return;
    case "drop_picked_up":
      removeSyncedDrop(syncEvent.dropId);
      return;
  }
}

function applyRemoteBlockBreaking(event: Extract<MultiplayerSyncEvent, { kind: "block_breaking" }>): void {
  const context = params;

  if (!context) {
    return;
  }

  const key = blockKey(event.x, event.y, event.z);

  if (event.action === "cancel") {
    removeRemoteBreaking(key);
    return;
  }

  if (event.action === "finish") {
    removeRemoteBreaking(key);
    setRemoteBlockToAir(context, event.x, event.y, event.z);
    return;
  }

  if (activeTarget && activeTarget.x === event.x && activeTarget.y === event.y && activeTarget.z === event.z) {
    return;
  }

  let breaking = remoteBreakingMeshes.get(key);

  if (!breaking) {
    breaking = createRemoteBreakingMesh(context.scene, event.x, event.y, event.z);
    remoteBreakingMeshes.set(key, breaking);
  }

  const alpha = Math.max(0.18, Math.min(0.78, 0.18 + event.progress * 0.6));
  breaking.material.alpha = alpha;
  breaking.mesh.scaling.setAll(1 + Math.min(0.015, event.stage * 0.003));
}

function spawnRemoteDrop(event: Extract<MultiplayerSyncEvent, { kind: "drop_spawned" }>): void {
  const context = params;

  if (!context || context.droppedItems.some((item) => item.dropId === event.dropId)) {
    return;
  }

  dropBlock(
    context.scene,
    event.blockId as BlockId,
    new Vector3(event.position[0], event.position[1], event.position[2]),
    context.material,
    context.droppedItems,
  );

  const item = context.droppedItems[context.droppedItems.length - 1];
  item.dropId = event.dropId;
  item.velocity.copyFromFloats(event.velocity[0], event.velocity[1], event.velocity[2]);
  knownDrops.set(item, event.dropId);
}

function removeSyncedDrop(dropId: string): void {
  const context = params;

  if (!context) {
    return;
  }

  const index = context.droppedItems.findIndex((item) => item.dropId === dropId);

  if (index === -1) {
    return;
  }

  const [item] = context.droppedItems.splice(index, 1);
  removedDropIds.add(dropId);
  knownDrops.delete(item);
  item.mesh.dispose();
}

function createRemoteBreakingMesh(scene: Scene, x: number, y: number, z: number): RemoteBreaking {
  const mesh = MeshBuilder.CreateBox(
    `remote-breaking-${x}-${y}-${z}`,
    { size: 1.006 },
    scene,
  );
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  mesh.isPickable = false;

  const material = new StandardMaterial(`remote-breaking-material-${x}-${y}-${z}`, scene);
  material.diffuseColor = new Color3(0.02, 0.018, 0.015);
  material.emissiveColor = new Color3(0.02, 0.018, 0.015);
  material.alpha = 0.2;
  material.wireframe = true;
  material.disableLighting = true;

  mesh.material = material;

  return { mesh, material };
}

function removeRemoteBreaking(key: string): void {
  const breaking = remoteBreakingMeshes.get(key);

  if (!breaking) {
    return;
  }

  breaking.mesh.dispose();
  breaking.material.dispose();
  remoteBreakingMeshes.delete(key);
}

function setRemoteBlockToAir(context: SyncParams, x: number, y: number, z: number): void {
  const chunk = getChunkFromWorldPosition(context.worldChunks, context.sizeX, context.sizeZ, x, z);

  if (!chunk) {
    return;
  }

  const localX = worldToLocalCoordinate(x, context.sizeX);
  const localZ = worldToLocalCoordinate(z, context.sizeZ);
  setBlock(chunk.blocks, context.sizeX, context.sizeY, context.sizeZ, localX, y, localZ, BlockId.Air);
  rebuildChunk(context, chunk);
}

function rebuildChunk(context: SyncParams, chunk: WorldChunk): void {
  chunk.mesh.dispose();
  chunk.mesh = createChunkMesh({
    scene: context.scene,
    name: `chunk-${chunk.chunkX}-${chunk.chunkZ}`,
    blocks: chunk.blocks,
    sizeX: context.sizeX,
    sizeY: context.sizeY,
    sizeZ: context.sizeZ,
    chunkX: chunk.chunkX,
    chunkZ: chunk.chunkZ,
    material: context.material,
  });
}

function findTargetBlock(context: SyncParams): TargetBlock | null {
  const ray = context.scene.createPickingRay(
    context.scene.getEngine().getRenderWidth() / 2,
    context.scene.getEngine().getRenderHeight() / 2,
    null,
    context.scene.activeCamera,
  );
  const origin = context.player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const pickRay = new Ray(origin, ray.direction.normalize(), BREAKING_REACH);

  for (let distance = BREAKING_STEP; distance <= BREAKING_REACH; distance += BREAKING_STEP) {
    const point = pickRay.origin.add(pickRay.direction.scale(distance));
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);
    const block = getWorldBlock(context.worldChunks, context.sizeX, context.sizeY, context.sizeZ, x, y, z);

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { x, y, z, block };
    }
  }

  return null;
}

function sameTarget(a: TargetBlock, b: TargetBlock): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function blockKey(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

function createDropId(): string {
  localDropCounter += 1;
  return `${DROP_ID_PREFIX}-${Date.now().toString(36)}-${localDropCounter.toString(36)}`;
}
