import type { DroppedItem, PlayerPhysics, VoxelWasmModule, WorldChunks } from "~/types";
import type { Engine, Scene } from "@babylonjs/core";
import { ClientModManager } from "./client-mod-manager";

export type InitializeClientModsParams = {
  scene: Scene;
  engine: Engine;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  droppedItems: DroppedItem[];
  wasm: VoxelWasmModule;
};

export async function initializeClientMods(params: InitializeClientModsParams): Promise<ClientModManager> {
  const manager = new ClientModManager(params);

  await manager.loadAvailableMods();
  manager.emit("player_ready", { player: params.player });
  manager.emit("world_ready", { worldChunks: params.worldChunks });

  return manager;
}
