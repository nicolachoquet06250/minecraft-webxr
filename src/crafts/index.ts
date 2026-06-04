import { acaciaPlanksCraft } from "./acacia-planks";
import { birchPlanksCraft } from "./birch-planks";
import { cherryPlanksCraft } from "./cherry-planks";
import { craftingTableCraft } from "./crafting-table";
import { darkOakPlanksCraft } from "./dark-oak-planks";
import { dirtGrassPickaxeCraft } from "./dirt-grass-pickaxe";
import { junglePlanksCraft } from "./jungle-planks";
import { mangrovePlanksCraft } from "./mangrove-planks";
import { oakPlanksCraft } from "./oak-planks";
import { sprucePlanksCraft } from "./spruce-planks";
import type { CraftingRecipe } from "./types";

export type { CraftingPattern, CraftingRecipe } from "./types";

export const craftingRecipes: CraftingRecipe[] = [
  oakPlanksCraft,
  sprucePlanksCraft,
  birchPlanksCraft,
  junglePlanksCraft,
  acaciaPlanksCraft,
  darkOakPlanksCraft,
  mangrovePlanksCraft,
  cherryPlanksCraft,
  craftingTableCraft,
  dirtGrassPickaxeCraft,
];
