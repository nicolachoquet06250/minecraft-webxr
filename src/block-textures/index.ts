import { BlockId } from "../types";
import { dirtTexture } from "./dirt";
import { grassSideTexture, grassTopTexture } from "./grass";
import type { BlockFaceName, BlockTextureDefinition, BlockTextureSet } from "./types";

export type { BlockFaceName, BlockTextureDefinition, BlockTextureMatrix, TextureColorKey } from "./types";
export { BLOCK_TEXTURE_SIZE } from "./types";

const blockTextureSets: BlockTextureSet[] = [
  {
    blockId: BlockId.Dirt,
    faces: {
      top: dirtTexture,
      bottom: dirtTexture,
      front: dirtTexture,
      back: dirtTexture,
      right: dirtTexture,
      left: dirtTexture,
    },
  },
  {
    blockId: BlockId.GrassBlock,
    faces: {
      top: grassTopTexture,
      bottom: dirtTexture,
      front: grassSideTexture,
      back: grassSideTexture,
      right: grassSideTexture,
      left: grassSideTexture,
    },
  },
];

const blockTextureSetById = new Map<BlockId, BlockTextureSet>(
  blockTextureSets.map((textureSet) => [textureSet.blockId, textureSet]),
);

export function getBlockFaceTexture(blockId: BlockId, faceName: BlockFaceName): BlockTextureDefinition | null {
  return blockTextureSetById.get(blockId)?.faces[faceName] ?? null;
}
