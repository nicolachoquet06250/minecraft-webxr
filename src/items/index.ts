import { BlockId } from "../types";
import { blockItemDefinitions } from "./block-items";
import { toolItemDefinitions } from "./tool-items";
import type { ItemDefinition } from "./types";

export type { ItemDefinition, ItemIconDefinition } from "./types";

export const itemDefinitions: ItemDefinition[] = [
  ...blockItemDefinitions,
  ...toolItemDefinitions,
];

const itemDefinitionById = new Map<BlockId, ItemDefinition>(
  itemDefinitions.map((definition) => [definition.id, definition]),
);

export function getItemDefinition(itemId: BlockId): ItemDefinition | undefined {
  return itemDefinitionById.get(itemId);
}

export function getItemMaxStackSize(itemId: BlockId): number {
  return getItemDefinition(itemId)?.maxStackSize ?? 64;
}
