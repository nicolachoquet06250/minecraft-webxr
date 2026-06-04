import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const oakPlanksCraft: CraftingRecipe = {
  id: "oak-planks",
  patterns: [[BlockId.OakLog, null, null, null, null, null, null, null, null]],
  result: { blockId: BlockId.OakPlanks, count: 4 },
};
