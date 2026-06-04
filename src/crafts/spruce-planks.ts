import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const sprucePlanksCraft: CraftingRecipe = {
  id: "spruce-planks",
  patterns: [
    [BlockId.SpruceLog, null, null, null, null, null, null, null, null],
    [null, BlockId.SpruceLog, null, null, null, null, null, null, null], 
    [null, null, BlockId.SpruceLog, null, null, null, null, null, null],
    [null, null, null, BlockId.SpruceLog, null, null, null, null, null],
    [null, null, null, null, BlockId.SpruceLog, null, null, null, null], 
    [null, null, null, null, null, BlockId.SpruceLog, null, null,	null], 
    [null, null, null, null, null, null, BlockId.SpruceLog, null, null],
    [null, null, null, null, null, null, null, BlockId.SpruceLog, null],
    [null, null, null, null, null, null, null, null, BlockId.SpruceLog]
  ],
  result: { blockId: BlockId.SprucePlanks, count: 4 },
};
