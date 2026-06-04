import type { InventoryItem } from "../types";
import type { BlockId } from "../types";

export type CraftingPattern = readonly [
  BlockId | null,
  BlockId | null,
  BlockId | null,
  BlockId | null,
  BlockId | null,
  BlockId | null,
  BlockId | null,
  BlockId | null,
  BlockId | null,
];

export type CraftingRecipe = {
  readonly id: string;
  readonly pattern: CraftingPattern;
  readonly result: InventoryItem;
};
