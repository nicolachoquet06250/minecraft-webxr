import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const oakPlanksCraft: CraftingRecipe = {
  id: "oak-planks",
  patterns: [
    [BlockId.OakLog, null, null, null, null, null, null, null, null],
    [null, BlockId.OakLog, null, null, null, null, null, null, null], 
    [null, null, BlockId.OakLog, null, null, null, null, null, null],
    [null, null, null, BlockId.OakLog, null, null, null, null, null],
    [null, null, null, null, BlockId.OakLog, null, null, null, null], 
    [null, null, null, null, null, BlockId.OakLog, null, null, null], 
    [null, null, null, null, null, null, BlockId.OakLog, null, null],
    [null, null, null, null, null, null, null, BlockId.OakLog, null],
    [null, null, null, null, null, null, null, null, BlockId.OakLog]
  ],
  result: { blockId: BlockId.OakPlanks, count: 4 },
};
