import { Scene } from "@babylonjs/core";
import poppyModelUrl from "./assets/3d/poppy.gltf?url";
import { initializeBlockModelInstances } from "./block-model-loader";
import { BlockId, type WorldChunks } from "./types";

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
  });
}
