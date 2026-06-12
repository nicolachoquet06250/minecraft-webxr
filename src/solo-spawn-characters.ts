import { Scene, Vector3 } from "@babylonjs/core";
import { createAlex, createSteve } from "~/characters";
import { SPAWN_X, SPAWN_Z } from "./constants";
import { findDrySpawnPosition } from "./functions";
import type { WorldChunks } from "./types";

const GAME_MODE_STORAGE_KEY = "voxicraft:game-mode";

function isSinglePlayerMode(): boolean {
  try {
    return window.localStorage.getItem(GAME_MODE_STORAGE_KEY) === "singleplayer";
  } catch {
    return true;
  }
}

export function initializeSoloSpawnCharacters(params: {
  scene: Scene;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}): void {
  if (!isSinglePlayerMode()) {
    return;
  }

  const { scene, worldChunks, sizeX, sizeY, sizeZ } = params;

  const alexSpawn = findDrySpawnPosition(
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    SPAWN_X + 5,
    SPAWN_Z,
    10,
  );

  const { animator: alexAnimator } = createAlex(
    scene,
    new Vector3(alexSpawn.x, alexSpawn.y, alexSpawn.z),
    { physics: { externalControl: false } },
  );

  alexAnimator.play("mine");

  window.setTimeout(() => {
    alexAnimator.stop();
  }, 20_000);

  const steveSpawn = findDrySpawnPosition(
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    SPAWN_X + 5,
    SPAWN_Z - 1,
    10,
  );

  const { mesh: steveMesh, animator: steveAnimator } = createSteve(
    scene,
    new Vector3(steveSpawn.x, steveSpawn.y, steveSpawn.z),
    { physics: { externalControl: false } },
  );

  steveMesh.rotation.y = -(Math.PI / 2);
  steveAnimator.play("walk");

  window.setTimeout(() => {
    steveAnimator.stop();
  }, 20_000);
}
