import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const birchPlanksCraft: CraftingRecipe = {
  id: "birch-planks",
  patterns: [
    [BlockId.BirchLog, null, null, null, null, null, null, null, null],
    [null, BlockId.BirchLog, null, null, null, null, null, null, null], 
    [null, null, BlockId.BirchLog, null, null, null, null, null, null],
    [null, null, null, BlockId.BirchLog, null, null, null, null, null],
    [null, null, null, null, BlockId.BirchLog, null, null, null, null], 
    [null, null, null, null, null, BlockId.BirchLog, null, null, null], 
    [null, null, null, null, null, null, BlockId.BirchLog, null, null],
    [null, null, null, null, null, null, null, BlockId.BirchLog, null],
    [null, null, null, null, null, null, null, null, BlockId.BirchLog]
  ],
  result: { blockId: BlockId.BirchPlanks, count: 4 },
};
