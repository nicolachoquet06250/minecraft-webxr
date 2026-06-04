import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const darkOakPlanksCraft: CraftingRecipe = {
  id: "dark-oak-planks",
  pattern: [BlockId.DarkOakLog, null, null, null, null, null, null, null, null],
  result: { blockId: BlockId.DarkOakPlanks, count: 4 },
};
