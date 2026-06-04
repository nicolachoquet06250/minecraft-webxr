import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const craftingTableCraft: CraftingRecipe = {
  id: "crafting-table",
  patterns: [[
    BlockId.OakPlanks, BlockId.OakPlanks, null,
    BlockId.OakPlanks, BlockId.OakPlanks, null,
    null,              null,              null,
  ]],
  result: { blockId: BlockId.CraftingTable, count: 1 },
};
