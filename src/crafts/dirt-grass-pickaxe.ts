import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const dirtGrassPickaxeCraft: CraftingRecipe = {
  id: "dirt-grass-pickaxe",
  pattern: [
    BlockId.GrassBlock, BlockId.GrassBlock, BlockId.GrassBlock,
    null,               BlockId.Dirt,       null,
    null,               BlockId.Dirt,       null,
  ],
  result: { blockId: BlockId.DirtGrassPickaxe, count: 1 },
};
