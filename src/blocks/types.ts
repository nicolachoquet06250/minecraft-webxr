import type { BlockId } from "../types";

export type RgbaColor = readonly [number, number, number, number];

export type BlockDefinition = {
  readonly id: BlockId;
  readonly name: string;
  readonly color: RgbaColor;
  readonly solid: boolean;
  readonly transparentForMeshing: boolean;
};
