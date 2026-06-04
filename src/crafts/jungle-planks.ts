import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const junglePlanksCraft: CraftingRecipe = {
  id: "jungle-planks",
  patterns: [
    [BlockId.JungleLog, null, null, null, null, null, null, null, null],
    [null, BlockId.JungleLog, null, null, null, null, null, null, null], 
    [null, null, BlockId.JungleLog, null, null, null, null, null, null],
    [null, null, null, BlockId.JungleLog, null, null, null, null, null],
    [null, null, null, null, BlockId.JungleLog, null, null, null, null], 
    [null, null, null, null, null, BlockId.JungleLog, null, null,	null], 
    [null, null, null, null, null, null, BlockId.JungleLog, null, null],
    [null, null, null, null, null, null, null, BlockId.JungleLog, null],
    [null, null, null, null, null, null, null, null, BlockId.JungleLog]
  ],
  result: { blockId: BlockId.JunglePlanks, count: 4 },
};
