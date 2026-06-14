import type { DroppedItem, PlayerPhysics, WorldChunks } from "~/types";
import type { Engine, Scene } from "@babylonjs/core";
import { ClientModManager } from "./client-mod-manager";
import { setClientModManager } from "./runtime";

export type InitializeClientModsRuntimeParams = {
  scene: Scene;
  engine: Engine;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  droppedItems: DroppedItem[];
};

export async function initializeClientModsRuntime(params: InitializeClientModsRuntimeParams): Promise<ClientModManager> {
  const manager = new ClientModManager(params);

  setClientModManager(manager);
  await manager.loadAvailableMods();
  manager.emit("player_ready", { player: params.player });
  manager.emit("world_ready", { worldChunks: params.worldChunks });

  params.scene.onBeforeRenderObservable.add(() => {
    const deltaTime = Math.min(params.engine.getDeltaTime() / 1000, 0.05);

    manager.emit("before_render", { deltaTime });
    manager.emit("tick", { deltaTime });
  });

  params.scene.onAfterRenderObservable.add(() => {
    const deltaTime = Math.min(params.engine.getDeltaTime() / 1000, 0.05);

    manager.emit("after_render", { deltaTime });
  });

  return manager;
}
