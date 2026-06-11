import { Scene, TransformNode } from "@babylonjs/core";
import poppyModelUrl from "./assets/3d/poppy.gltf?url";
import { attachBlockModelToParent, initializeBlockModelInstances } from "./block-model-loader";
import { initializeSoloSpawnCharacters } from "./solo-spawn-characters";
import { BlockId, type WorldChunks } from "./types";

const POPPY_MODEL_BLOCK_SIZE = 0.75;

export function initializePoppyModels(params: {
  scene: Scene;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}): void {
  initializeBlockModelInstances({
    ...params,
    blockId: BlockId.Poppy,
    modelName: "poppy",
    modelUrl: poppyModelUrl,
    normalizedBlockSize: POPPY_MODEL_BLOCK_SIZE,
  });

  initializeSoloSpawnCharacters(params);
}

export async function attachPoppyModelToParent(scene: Scene, parent: TransformNode, instanceName: string): Promise<TransformNode> {
  return attachBlockModelToParent({
    scene,
    parent,
    modelName: "poppy",
    modelUrl: poppyModelUrl,
    instanceName,
    normalizedBlockSize: POPPY_MODEL_BLOCK_SIZE,
  });
}
