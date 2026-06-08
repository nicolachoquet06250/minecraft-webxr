import "@babylonjs/loaders/glTF";
import { AbstractMesh, Scene, SceneLoader, TransformNode, Vector3 } from "@babylonjs/core";
import poppyModelUrl from "./assets/3d/poppy.gltf?url";
import { getBlock } from "./functions";
import { BlockId, type WorldChunks } from "./types";

const SYNC_INTERVAL_MS = 500;

type PoppyModelTemplate = {
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
};

type PoppyInstance = {
  readonly key: string;
  readonly root: TransformNode;
};

let templatePromise: Promise<PoppyModelTemplate> | null = null;

export function initializePoppyModels(params: {
  scene: Scene;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}): void {
  const { scene, worldChunks, sizeX, sizeY, sizeZ } = params;
  const instances = new Map<string, PoppyInstance>();
  let lastSyncAt = 0;

  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();

    if (now - lastSyncAt < SYNC_INTERVAL_MS) {
      return;
    }

    lastSyncAt = now;

    void syncPoppyModels({
      scene,
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      instances,
    });
  });
}

async function syncPoppyModels(params: {
  scene: Scene;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  instances: Map<string, PoppyInstance>;
}): Promise<void> {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, instances } = params;
  const expectedKeys = new Set<string>();
  const template = await getPoppyModelTemplate(scene);

  for (const chunk of worldChunks.values()) {
    const worldOffsetX = chunk.chunkX * sizeX;
    const worldOffsetZ = chunk.chunkZ * sizeZ;

    for (let y = 0; y < sizeY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          if (getBlock(chunk.blocks, sizeX, sizeY, sizeZ, x, y, z) !== BlockId.Poppy) {
            continue;
          }

          const worldX = worldOffsetX + x;
          const worldZ = worldOffsetZ + z;
          const key = `${worldX}:${y}:${worldZ}`;
          expectedKeys.add(key);

          if (instances.has(key)) {
            continue;
          }

          const root = instantiatePoppyModel(template, scene, key);
          root.position = new Vector3(worldX + 0.5, y, worldZ + 0.5);
          instances.set(key, { key, root });
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

async function getPoppyModelTemplate(scene: Scene): Promise<PoppyModelTemplate> {
  templatePromise ??= SceneLoader.ImportMeshAsync("", "", poppyModelUrl, scene).then((result) => {
    const root = new TransformNode("poppy-template", scene);
    const meshes = result.meshes.filter((mesh): mesh is AbstractMesh => mesh instanceof AbstractMesh);

    for (const mesh of meshes) {
      mesh.setEnabled(false);
      mesh.parent = root;
    }

    root.setEnabled(false);

    return { root, meshes };
  });

  return templatePromise;
}

function instantiatePoppyModel(template: PoppyModelTemplate, scene: Scene, key: string): TransformNode {
  const root = new TransformNode(`poppy-${key}`, scene);
  root.scaling.setAll(1);

  for (const mesh of template.meshes) {
    const clone = mesh.clone(`${mesh.name}-${key}`, root);

    if (!clone) {
      continue;
    }

    clone.setEnabled(true);
  }

  return root;
}
