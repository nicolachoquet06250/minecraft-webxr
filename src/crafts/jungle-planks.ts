import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const junglePlanksCraft: CraftingRecipe = {
  id: "jungle-planks",
  pattern: [BlockId.JungleLog, null, null, null, null, null, null, null, null],
  result: { blockId: BlockId.JunglePlanks, count: 4 },
};
