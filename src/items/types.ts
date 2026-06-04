import type { BlockId } from "../types";

export type ItemIconDefinition =
  | { readonly type: "block-color"; readonly blockId: BlockId }
  | { readonly type: "image"; readonly src: string };

export type ItemDefinition = {
  readonly id: BlockId;
  readonly name: string;
  readonly maxStackSize: number;
  readonly icon: ItemIconDefinition;
};
