import { Color4 } from "@babylonjs/core";
import { BlockId } from "../types";
import { decorativeBlockDefinitions } from "./decorative-blocks";
import { naturalBlockDefinitions } from "./natural-blocks";
import { oreBlockDefinitions } from "./ore-blocks";
import { plantBlockDefinitions } from "./plant-blocks";
import { terrainBlockDefinitions } from "./terrain-blocks";
import { treeBlockDefinitions } from "./tree-blocks";
import type { BlockDefinition } from "./types";
import { woolBlockDefinitions } from "./wool-blocks";

export type { BlockDefinition, RgbaColor } from "./types";

export const blockDefinitions: BlockDefinition[] = [
  ...terrainBlockDefinitions,
  ...naturalBlockDefinitions,
  ...oreBlockDefinitions,
  ...treeBlockDefinitions,
  ...decorativeBlockDefinitions,
  ...plantBlockDefinitions,
  ...woolBlockDefinitions,
];

const blockDefinitionById = new Map<BlockId, BlockDefinition>(
  blockDefinitions.map((definition) => [definition.id, definition]),
);

export function getBlockDefinition(blockId: BlockId): BlockDefinition | undefined {
  return blockDefinitionById.get(blockId);
}

export function getBlockColorDefinition(blockId: BlockId): Color4 {
  const definition = getBlockDefinition(blockId);

  if (!definition) {
    return new Color4(1.0, 1.0, 1.0, 0.0);
  }

  const [r, g, b, a] = definition.color;
  return new Color4(r, g, b, a);
}

export function isSolidBlockDefinition(blockId: BlockId): boolean {
  return getBlockDefinition(blockId)?.solid ?? false;
}

export function isTransparentForMeshingDefinition(blockId: BlockId): boolean {
  return getBlockDefinition(blockId)?.transparentForMeshing ?? false;
}
