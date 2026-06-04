import { BlockId } from "../types";
import type { CraftingRecipe } from "./types";

export const acaciaPlanksCraft: CraftingRecipe = {
  id: "acacia-planks",
  pattern: [BlockId.AcaciaLog, null, null, null, null, null, null, null, null],
  result: { blockId: BlockId.AcaciaPlanks, count: 4 },
};
