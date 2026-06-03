import "./style.css";
import init, * as wasmModule from "../public/wasm/voxel_wasm"

import type { VoxelWasmModule } from './types';

import {
  CHUNK_X, CHUNK_Z, 
  SPEED, SPAWN_X, 
  SPAWN_Z
} from './constants';
import { Color4, Engine, Scene } from "@babylonjs/core";
import { 
  findTerrainSpawnY, createChunkMesh, 
  updatePlayerPhysics, 
  initializeCamera,
  inisializeLight,
  generatePlayer
} from "./functions";
import initializeEvents from "./events";

async function loadVoxelWasm(): Promise<VoxelWasmModule> {
  await init();

  return wasmModule as unknown as VoxelWasmModule;
}

const canvas = document.querySelector("#minecraft");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #minecraft introuvable");
}

const engine = new Engine(canvas, true);
const scene = new Scene(engine);

scene.clearColor = new Color4(0.55, 0.75, 1.0, 1.0);

const lightMaterial = inisializeLight(scene);

const { 
  generate_chunk, chunk_size_x, 
  chunk_size_y, chunk_size_z
} = await loadVoxelWasm();

const blocks = generate_chunk(CHUNK_X, CHUNK_Z, SPEED);

const sizeX = chunk_size_x();
const sizeY = chunk_size_y();
const sizeZ = chunk_size_z();

const player = generatePlayer(findTerrainSpawnY(blocks, sizeX, sizeY, sizeZ, SPAWN_X, SPAWN_Z));

createChunkMesh({
  scene,
  name: "chunk-0-0",
  blocks,
  sizeX,
  sizeY,
  sizeZ,
  chunkX: CHUNK_X,
  chunkZ: CHUNK_Z,
  material: lightMaterial,
});

await scene.createDefaultXRExperienceAsync({
  floorMeshes: [],
});

engine.runRenderLoop(() => {
  const deltaTime = Math.min(engine.getDeltaTime() / 1000, 0.05);

  updatePlayerPhysics({
    player,
    camera: initializeCamera(scene, player),
    blocks,
    sizeX,
    sizeY,
    sizeZ,
    deltaTime,
  });

  scene.render();
});

initializeEvents(engine, player, canvas);