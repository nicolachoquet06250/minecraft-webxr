import type { ClientModManager } from "./client-mod-manager";

const globalState = globalThis as typeof globalThis & {
  __voxicraftClientModManager?: ClientModManager;
};

export function setClientModManager(manager: ClientModManager): void {
  globalState.__voxicraftClientModManager = manager;
}

export function getClientModManager(): ClientModManager | undefined {
  return globalState.__voxicraftClientModManager;
}
