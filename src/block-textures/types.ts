import type { Color4 } from "@babylonjs/core";
import type { BlockId } from "../types";

export const BLOCK_TEXTURE_SIZE = 16;

export type BlockFaceName = "top" | "bottom" | "front" | "back" | "right" | "left";
export type TextureColorKey = string;
export type BlockTextureMatrix = readonly TextureColorKey[];

export type BlockTextureDefinition = {
  readonly palette: Readonly<Record<TextureColorKey, Color4>>;
  readonly matrix: BlockTextureMatrix;
};

export type BlockFaceTextureDefinition = Partial<Record<BlockFaceName, BlockTextureDefinition>>;

export type BlockTextureSet = {
  readonly blockId: BlockId;
  readonly faces: BlockFaceTextureDefinition;
};
