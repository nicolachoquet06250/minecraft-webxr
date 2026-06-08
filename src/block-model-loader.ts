import "@babylonjs/loaders/glTF";
import { AbstractMesh, Scene, SceneLoader, TransformNode, Vector3 } from "@babylonjs/core";
import { getBlock } from "./functions";
import type { BlockId, WorldChunks } from "./types";

const DEFAULT_SYNC_INTERVAL_MS = 500;

type BlockModelTemplate = {
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  readonly scale: number;
  readonly offset: Vector3;
};

type BlockModelInstance = {
  readonly root: TransformNode;
};

type BlockModelParams = {
  scene: Scene;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  blockId: BlockId;
  modelName: string;
  modelUrl: string;
  normalizedBlockSize?: number;
  syncIntervalMs?: number;
};

const templatePromises = new Map<string, Promise<BlockModelTemplate>>();

export function initializeBlockModelInstances(params: BlockModelParams): void {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, blockId, modelName, modelUrl, normalizedBlockSize = 1, syncIntervalMs = DEFAULT_SYNC_INTERVAL_MS } = params;
  const instances = new Map<string, BlockModelInstance>();
  let lastSyncAt = 0;

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();

    if (now - lastSyncAt < syncIntervalMs) {
      return;
    }

    lastSyncAt = now;

    void syncBlockModelInstances({
      scene,
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      blockId,
      modelName,
      modelUrl,
      normalizedBlockSize,
      instances,
    });
  });
}

async function syncBlockModelInstances(params: BlockModelParams & {
  instances: Map<string, BlockModelInstance>;
}): Promise<void> {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, blockId, modelName, modelUrl, normalizedBlockSize = 1, instances } = params;
  const expectedKeys = new Set<string>();
  const template = await getBlockModelTemplate(scene, modelName, modelUrl, normalizedBlockSize);

  for (const chunk of worldChunks.values()) {
    const worldOffsetX = chunk.chunkX * sizeX;
    const worldOffsetZ = chunk.chunkZ * sizeZ;

    for (let y = 0; y < sizeY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          if (getBlock(chunk.blocks, sizeX, sizeY, sizeZ, x, y, z) !== blockId) {
            continue;
          }

          const worldX = worldOffsetX + x;
          const worldZ = worldOffsetZ + z;
          const key = `${modelName}:${worldX}:${y}:${worldZ}`;
          expectedKeys.add(key);

          if (instances.has(key)) {
            continue;
          }

          const root = instantiateBlockModel(template, scene, key);
          root.position = new Vector3(worldX + 0.5, y, worldZ + 0.5).add(template.offset);
          instances.set(key, { root });
        }
      }
    }
  }

  for (const [key, instance] of instances) {
    if (expectedKeys.has(key)) {
      continue;
    }

    instance.root.dispose(false, true);
    instances.delete(key);
  }
}

async function getBlockModelTemplate(scene: Scene, modelName: string, modelUrl: string, normalizedBlockSize: number): Promise<BlockModelTemplate> {
  const templateKey = `${modelUrl}:${normalizedBlockSize}`;
  const existing = templatePromises.get(templateKey);

  if (existing) {
    return existing;
  }

  const promise = SceneLoader.ImportMeshAsync("", "", modelUrl, scene).then((result) => {
    const root = new TransformNode(`${modelName}-template`, scene);
    const meshes = result.meshes.filter((mesh): mesh is AbstractMesh => mesh instanceof AbstractMesh);

    for (const mesh of meshes) {
      mesh.setEnabled(false);
      mesh.setParent(root);
    }

    root.computeWorldMatrix(true);
    const bounds = root.getHierarchyBoundingVectors(true);
    const size = bounds.max.subtract(bounds.min);
    const maxSize = Math.max(size.x, size.y, size.z);
    const targetSize = Math.min(1, Math.max(0.01, normalizedBlockSize));
    const scale = maxSize > 0 ? targetSize / maxSize : 1;
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const offset = new Vector3(-centerX * scale, -bounds.min.y * scale, -centerZ * scale);

    root.setEnabled(false);

    return {
      root,
      meshes,
      scale,
      offset,
    };
  });

  templatePromises.set(templateKey, promise);
  return promise;
}

function instantiateBlockModel(template: BlockModelTemplate, scene: Scene, key: string): TransformNode {
  const root = new TransformNode(`block-model-${key}`, scene);
  root.scaling.setAll(template.scale);

  for (const mesh of template.meshes) {
    const clone = mesh.clone(`${mesh.name}-${key}`, root);

    if (!clone) {
      continue;
    }

    clone.setEnabled(true);
  }

  return root;
}
