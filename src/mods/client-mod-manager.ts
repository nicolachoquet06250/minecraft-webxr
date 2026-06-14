import * as BABYLON from "@babylonjs/core";
import type { Engine, Scene } from "@babylonjs/core";
import type { DroppedItem, PlayerPhysics, VoxelWasmModule, WorldChunks } from "~/types";
import type {
  LoadedVoxiCraftClientMod,
  VoxiCraftClientEventBus,
  VoxiCraftClientEventCallback,
  VoxiCraftClientEventName,
  VoxiCraftClientEventPayloads,
  VoxiCraftClientModContext,
  VoxiCraftClientModManifest,
  VoxiCraftClientModModule,
} from "./types";

const CLIENT_MOD_MANIFEST_ENDPOINT = "/api/mods/manifest";

class ClientModEventBus implements VoxiCraftClientEventBus {
  private readonly listeners = new Map<VoxiCraftClientEventName, Set<(payload: unknown) => void>>();

  on<TName extends VoxiCraftClientEventName>(
    eventName: TName,
    callback: VoxiCraftClientEventCallback<TName>,
  ): () => void {
    const listeners = this.listeners.get(eventName) ?? new Set<(payload: unknown) => void>();
    const listener = callback as (payload: unknown) => void;

    listeners.add(listener);
    this.listeners.set(eventName, listeners);

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  emit<TName extends VoxiCraftClientEventName>(
    eventName: TName,
    payload: VoxiCraftClientEventPayloads[TName],
  ): void {
    const listeners = this.listeners.get(eventName);

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(payload);
    }
  }
}

export type ClientModManagerParams = {
  scene: Scene;
  engine: Engine;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  droppedItems: DroppedItem[];
  wasm: VoxelWasmModule;
};

export class ClientModManager {
  private readonly scene: Scene;
  private readonly engine: Engine;
  private readonly player: PlayerPhysics;
  private readonly worldChunks: WorldChunks;
  private readonly droppedItems: DroppedItem[];
  private readonly wasm: VoxelWasmModule;
  private readonly eventBus = new ClientModEventBus();
  private readonly loadedMods = new Map<string, LoadedVoxiCraftClientMod>();

  constructor(params: ClientModManagerParams) {
    this.scene = params.scene;
    this.engine = params.engine;
    this.player = params.player;
    this.worldChunks = params.worldChunks;
    this.droppedItems = params.droppedItems;
    this.wasm = params.wasm;
  }

  async loadAvailableMods(): Promise<void> {
    const manifests = await fetchClientModManifest();

    for (const manifest of manifests) {
      if (!manifest.client || this.loadedMods.has(manifest.id)) {
        continue;
      }

      try {
        await this.load(manifest);
      } catch (error) {
        console.warn(`[mods] impossible de charger le mod client ${manifest.id}`, error);
      }
    }
  }

  async load(manifest: VoxiCraftClientModManifest): Promise<void> {
    const clientEntry = manifest.client?.entry;

    if (!clientEntry) {
      return;
    }

    const versionedEntry = withCacheBuster(clientEntry);
    const module = await import(/* @vite-ignore */ versionedEntry) as VoxiCraftClientModModule;
    const loadedMod: LoadedVoxiCraftClientMod = {
      manifest,
      module,
      disposables: [],
    };
    const ctx = this.createContext(loadedMod);

    await module.activate?.(ctx);
    this.loadedMods.set(manifest.id, loadedMod);
    console.info(`[mods] mod client chargé: ${manifest.id}@${manifest.version}`);
  }

  async unload(modId: string): Promise<void> {
    const loadedMod = this.loadedMods.get(modId);

    if (!loadedMod) {
      return;
    }

    const ctx = this.createContext(loadedMod);

    try {
      await loadedMod.module.deactivate?.(ctx);
    } finally {
      for (const disposable of loadedMod.disposables.splice(0)) {
        try {
          disposable.dispose();
        } catch (error) {
          console.warn(`[mods] erreur pendant le nettoyage du mod client ${modId}`, error);
        }
      }

      this.loadedMods.delete(modId);
      console.info(`[mods] mod client déchargé: ${modId}`);
    }
  }

  async reload(manifest: VoxiCraftClientModManifest): Promise<void> {
    await this.unload(manifest.id);
    await this.load(manifest);
  }

  emit<TName extends VoxiCraftClientEventName>(
    eventName: TName,
    payload: VoxiCraftClientEventPayloads[TName],
  ): void {
    this.eventBus.emit(eventName, payload);
  }

  private createContext(loadedMod: LoadedVoxiCraftClientMod): VoxiCraftClientModContext {
    return {
      BABYLON,
      manifest: loadedMod.manifest,
      scene: this.scene,
      engine: this.engine,
      player: this.player,
      worldChunks: this.worldChunks,
      droppedItems: this.droppedItems,
      wasm: this.wasm,
      events: this.eventBus,
      ui: {
        notify: (message) => console.info(`[mod:${loadedMod.manifest.id}] ${message}`),
      },
      resolveAssetUrl: (path) => resolveModAssetUrl(loadedMod.manifest, path),
      addDisposable: (disposable) => loadedMod.disposables.push(disposable),
    };
  }
}

async function fetchClientModManifest(): Promise<VoxiCraftClientModManifest[]> {
  const response = await fetch(CLIENT_MOD_MANIFEST_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Manifest des mods client indisponible: HTTP ${response.status}`);
  }

  const payload = await response.json() as { mods?: VoxiCraftClientModManifest[] };

  return payload.mods ?? [];
}

function withCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}t=${Date.now()}`;
}

function resolveModAssetUrl(manifest: VoxiCraftClientModManifest, path: string): string {
  const assetsBaseUrl = manifest.client?.assets;

  if (!assetsBaseUrl) {
    throw new Error(`Le mod ${manifest.id} ne déclare pas de dossier assets client`);
  }

  return `${assetsBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
