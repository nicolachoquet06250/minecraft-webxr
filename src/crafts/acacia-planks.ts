import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const acaciaPlanksCraft: CraftingRecipe = {
  id: "acacia-planks",
  patterns: [
    [BlockId.AcaciaLog, null, null, null, null, null, null, null, null],
    [null, BlockId.AcaciaLog, null, null, null, null, null, null, null], 
    [null, null, BlockId.AcaciaLog, null, null, null, null, null, null],
    [null, null, null, BlockId.AcaciaLog, null, null, null, null, null],
    [null, null, null, null, BlockId.AcaciaLog, null, null, null, null], 
    [null, null, null, null, null, BlockId.AcaciaLog, null, null, null], 
    [null, null, null, null, null, null, BlockId.AcaciaLog, null, null],
    [null, null, null, null, null, null, null, BlockId.AcaciaLog, null],
    [null, null, null, null, null, null, null, null, BlockId.AcaciaLog]
  ],
  result: { blockId: BlockId.AcaciaPlanks, count: 4 },
};
