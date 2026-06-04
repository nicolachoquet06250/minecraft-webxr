import { BlockId } from "../types";
import type { ItemDefinition } from "./types";

export const toolItemDefinitions: ItemDefinition[] = [
  {
    id: BlockId.DirtGrassPickaxe,
    name: "Dirt Grass Pickaxe",
    maxStackSize: 1,
    icon: { type: "image", src: "/items/pickaxe-grass-dirt.png" },
  },
];
