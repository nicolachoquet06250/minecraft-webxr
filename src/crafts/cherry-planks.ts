import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const cherryPlanksCraft: CraftingRecipe = {
  id: "cherry-planks",
  pattern: [BlockId.CherryLog, null, null, null, null, null, null, null, null],
  result: { blockId: BlockId.CherryPlanks, count: 4 },
};
