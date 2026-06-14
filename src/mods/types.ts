import type * as BABYLON from "@babylonjs/core";
import type { PlayerPhysics, WorldChunks, DroppedItem, VoxelWasmModule } from "~/types";

export type VoxiCraftModSide = "client" | "server" | "both";

export type VoxiCraftClientModPermission =
  | "babylon.scene"
  | "babylon.engine"
  | "game.player.read"
  | "game.world.read"
  | "game.world.write"
  | "game.events"
  | "ui.notify"
  | "ui.hud.write";

export type VoxiCraftClientModManifest = {
  id: string;
  name: string;
  version: string;
  side: VoxiCraftModSide;
  client?: {
    runtime: "javascript";
    entry: string;
    types?: string;
    assets?: string;
  };
  permissions?: VoxiCraftClientModPermission[];
};

export type VoxiCraftClientEventName =
  | "tick"
  | "before_render"
  | "after_render"
  | "player_ready"
  | "world_ready";

export type VoxiCraftClientEventPayloads = {
  tick: { deltaTime: number };
  before_render: { deltaTime: number };
  after_render: { deltaTime: number };
  player_ready: { player: PlayerPhysics };
  world_ready: { worldChunks: WorldChunks };
};

export type VoxiCraftClientEventCallback<TName extends VoxiCraftClientEventName> = (
  payload: VoxiCraftClientEventPayloads[TName],
) => void;

export type VoxiCraftClientEventBus = {
  on<TName extends VoxiCraftClientEventName>(
    eventName: TName,
    callback: VoxiCraftClientEventCallback<TName>,
  ): () => void;
  emit<TName extends VoxiCraftClientEventName>(
    eventName: TName,
    payload: VoxiCraftClientEventPayloads[TName],
  ): void;
};

export type VoxiCraftClientModContext = {
  readonly BABYLON: typeof BABYLON;
  readonly manifest: VoxiCraftClientModManifest;
  readonly scene: BABYLON.Scene;
  readonly engine: BABYLON.Engine;
  readonly player: PlayerPhysics;
  readonly worldChunks: WorldChunks;
  readonly droppedItems: DroppedItem[];
  readonly wasm: VoxelWasmModule;
  readonly events: VoxiCraftClientEventBus;
  readonly ui: {
    notify(message: string): void;
  };
  resolveAssetUrl(path: string): string;
  addDisposable(disposable: { dispose(): void }): void;
};

export type VoxiCraftClientModModule = {
  activate?(ctx: VoxiCraftClientModContext): void | Promise<void>;
  deactivate?(ctx: VoxiCraftClientModContext): void | Promise<void>;
};

export type LoadedVoxiCraftClientMod = {
  manifest: VoxiCraftClientModManifest;
  module: VoxiCraftClientModModule;
  disposables: Array<{ dispose(): void }>;
};
