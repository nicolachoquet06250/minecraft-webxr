import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const mangrovePlanksCraft: CraftingRecipe = {
  id: "mangrove-planks",
  patterns: [[BlockId.MangroveLog, null, null, null, null, null, null, null, null]],
  result: { blockId: BlockId.MangrovePlanks, count: 4 },
};
