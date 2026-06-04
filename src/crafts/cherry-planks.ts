import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const cherryPlanksCraft: CraftingRecipe = {
  id: "cherry-planks",
  patterns: [
      [BlockId.CherryLog, null, null, null, null, null, null, null, null],
      [null, BlockId.CherryLog, null, null, null, null, null, null, null], 
      [null, null, BlockId.CherryLog, null, null, null, null, null, null],
      [null, null, null, BlockId.CherryLog, null, null, null, null, null],
      [null, null, null, null, BlockId.CherryLog, null, null, null, null], 
      [null, null, null, null, null, BlockId.CherryLog, null, null, null], 
      [null, null, null, null, null, null, BlockId.CherryLog, null, null],
      [null, null, null, null, null, null, null, BlockId.CherryLog, null],
      [null, null, null, null, null, null, null, null, BlockId.CherryLog]
    ],
  result: { blockId: BlockId.CherryPlanks, count: 4 },
};
