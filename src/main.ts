import "./style.css";
import init, * as wasmModule from "~/assets/wasm/voxel_wasm";
import voxelWasmUrl from "~/assets/wasm/voxel_wasm_bg.wasm?url";

import type { VoxelWasmModule, WorldChunks, DroppedItem } from "./types";

import {
  INITIAL_CHUNK_RADIUS,
  SEED,
  SPAWN_X,
  SPAWN_Z,
} from "./constants";

import { Color4, Engine, Scene } from "@babylonjs/core";

import {
  updatePlayerPhysics,
  initializeCamera,
  inisializeLight,
  generatePlayer,
  getChunkKey,
  initializeCrosshair,
  findDrySpawnPosition,
} from "./functions";
import {
  createChunkMesh,
  ensureChunksAroundPlayer,
  updateDroppedItems,
} from "./textured-world";

import initializeEvents from "./events";
import { updateBlockBreaking } from "./block-breaking";
import { applyProceduralBlockAtlasMaterial } from "./block-atlas";
import { initializeCraftingOverlay } from "./crafting-ui";
import { initializeInventoryBar } from "./inventory-ui";
import initializeMobileControls from "./mobile-controls";
import { initializeWebXRGameControls } from "./vr-mode";

async function loadVoxelWasm(): Promise<VoxelWasmModule> {
  await init(voxelWasmUrl);

  return wasmModule as unknown as VoxelWasmModule;
}

function debugBlockDistribution(blocks: Uint8Array): void {
  const counts = new Map<number, number>();

  for (const block of blocks) {
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }

  console.table(
    [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([blockId, count]) => ({ blockId, count })),
  );
}

const canvas = document.querySelector("#minecraft");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #minecraft introuvable");
}

const engine = new Engine(canvas, true);
const scene = new Scene(engine);

scene.clearColor = new Color4(0.55, 0.75, 1.0, 1.0);

const lightMaterial = inisializeLight(scene);
applyProceduralBlockAtlasMaterial(scene, lightMaterial);

const wasm = await loadVoxelWasm();
const {
  generate_chunk, chunk_size_x,
  chunk_size_y, chunk_size_z
} = wasm;

const sizeX = chunk_size_x();
const sizeY = chunk_size_y();
const sizeZ = chunk_size_z();

const spawnChunkX = Math.floor(SPAWN_X / sizeX);
const spawnChunkZ = Math.floor(SPAWN_Z / sizeZ);

const worldChunks: WorldChunks = new Map();
const droppedItems: DroppedItem[] = [];

for (let offsetZ = -INITIAL_CHUNK_RADIUS; offsetZ <= INITIAL_CHUNK_RADIUS; offsetZ++) {
  for (let offsetX = -INITIAL_CHUNK_RADIUS; offsetX <= INITIAL_CHUNK_RADIUS; offsetX++) {
    const chunkX = spawnChunkX + offsetX;
    const chunkZ = spawnChunkZ + offsetZ;

    const blocks = generate_chunk(chunkX, chunkZ, SEED);

    debugBlockDistribution(blocks);

    const mesh = createChunkMesh({
      scene,
      name: `chunk-${chunkX}-${chunkZ}`,
      blocks,
      sizeX,
      sizeY,
      sizeZ,
      chunkX,
      chunkZ,
      material: lightMaterial,
    });

    worldChunks.set(getChunkKey(chunkX, chunkZ), {
      chunkX,
      chunkZ,
      blocks,
      mesh,
    });
  }
}

const spawnChunk = worldChunks.get(getChunkKey(spawnChunkX, spawnChunkZ));

if (!spawnChunk) {
  throw new Error("Chunk de spawn introuvable");
}

const spawn = findDrySpawnPosition(
  worldChunks,
  sizeX,
  sizeY,
  sizeZ,
  SPAWN_X,
  SPAWN_Z,
  64,
);

const player = generatePlayer(spawn);

// Expose properties for mobile controls
(player as any)._worldChunks = worldChunks;
(player as any)._sizeX = sizeX;
(player as any)._sizeY = sizeY;
(player as any)._sizeZ = sizeZ;
(player as any)._material = lightMaterial;
(player as any)._droppedItems = droppedItems;

const camera = initializeCamera(scene, player);

initializeCrosshair(scene);
initializeInventoryBar(scene, player);
initializeEvents(
  engine,
  player,
  canvas,
  scene,
  worldChunks,
  sizeX,
  sizeY,
  sizeZ,
  lightMaterial,
  droppedItems,
);
initializeMobileControls(scene, player);
initializeCraftingOverlay(scene, player);

const webXRControls = await initializeWebXRGameControls(scene, player);

engine.runRenderLoop(() => {
  const deltaTime = Math.min(engine.getDeltaTime() / 1000, 0.05);

  webXRControls.syncBeforePhysics(deltaTime);

  updatePlayerPhysics({
    player,
    camera,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    deltaTime,
  });

  webXRControls.syncAfterPhysics();

  ensureChunksAroundPlayer({
    scene,
    worldChunks,
    wasm,
    material: lightMaterial,
    player,
    sizeX,
    sizeY,
    sizeZ,
  });

  updateBlockBreaking(deltaTime);
  updateDroppedItems(droppedItems, player, worldChunks, sizeX, sizeY, sizeZ, deltaTime);

  scene.render();
});
