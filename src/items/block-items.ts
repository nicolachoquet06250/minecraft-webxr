import { blockDefinitions } from "../blocks";
import type { ItemDefinition } from "./types";

export const blockItemDefinitions: ItemDefinition[] = blockDefinitions
  .filter((block) => block.id !== 0)
  .map((block) => ({
    id: block.id,
    name: block.name,
    maxStackSize: 64,
    icon: { type: "block-color", blockId: block.id },
  }));
