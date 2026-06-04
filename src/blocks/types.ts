import type { BlockId } from "../types";

export type RgbaColor = readonly [number, number, number, number];
export type BlockTextureColorKey = string;
export type BlockTextureMatrix = readonly string[];
export type BlockFaceName = "top" | "bottom" | "front" | "back" | "right" | "left";

export type BlockTextureDefinition = {
  readonly palette: Readonly<Record<BlockTextureColorKey, RgbaColor>>;
  readonly matrix: BlockTextureMatrix;
};

export type BlockFaceTextureDefinitions = Partial<Record<BlockFaceName, BlockTextureDefinition>>;

export type BlockDefinition = {
  readonly id: BlockId;
  readonly name: string;
  readonly color: RgbaColor;
  readonly solid: boolean;
  readonly transparentForMeshing: boolean;
  readonly textures?: BlockFaceTextureDefinitions;
};
