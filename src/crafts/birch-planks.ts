import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const birchPlanksCraft: CraftingRecipe = {
  id: "birch-planks",
  pattern: [BlockId.BirchLog, null, null, null, null, null, null, null, null],
  result: { blockId: BlockId.BirchPlanks, count: 4 },
};
