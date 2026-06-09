import { blockDefinitions } from "../blocks";
import { BlockId } from "../types";
import type { ItemDefinition } from "./types";

export const blockItemDefinitions: ItemDefinition[] = blockDefinitions
  .filter((block) => block.id !== BlockId.Air)
  .map((block) => ({
    id: block.id,
    name: block.name,
    maxStackSize: 64,
    icon: block.id === BlockId.Poppy
      ? { type: "image", src: "/blocks/plants/poppy.png" }
      : { type: "block-color", blockId: block.id },
  }));
