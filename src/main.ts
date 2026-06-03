import "./style.css";
import init, * as wasmModule from "../public/wasm/voxel_wasm";

import type { VoxelWasmModule, WorldChunks } from "./types";

import {
  INITIAL_CHUNK_RADIUS,
  SEED,
  SPAWN_X,
  SPAWN_Z,
} from "./constants";

import { Color4, Engine, Scene } from "@babylonjs/core";

import {
  createChunkMesh,
  updatePlayerPhysics,
  initializeCamera,
  inisializeLight,
  generatePlayer,
  getChunkKey,
  initializeCrosshair,
  findDrySpawnPosition,
  ensureChunksAroundPlayer,
} from "./functions";

import initializeEvents from "./events";

async function loadVoxelWasm(): Promise<VoxelWasmModule> {
  await init();

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

const camera = initializeCamera(scene, player);

initializeCrosshair(scene);

initializeEvents(engine, player, canvas);

await scene.createDefaultXRExperienceAsync({
  floorMeshes: [],
});

engine.runRenderLoop(() => {
  const deltaTime = Math.min(engine.getDeltaTime() / 1000, 0.05);

  updatePlayerPhysics({
    player,
    camera,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    deltaTime,
  });

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

  scene.render();
});