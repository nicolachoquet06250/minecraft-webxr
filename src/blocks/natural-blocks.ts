import { BlockId } from "../types";
import type { BlockDefinition } from "./types";

export const naturalBlockDefinitions: BlockDefinition[] = [
  { id: BlockId.Water, name: "Water", color: [0.1, 0.35, 0.85, 0.65], solid: false, transparentForMeshing: true },
  { id: BlockId.Lava, name: "Lava", color: [1.0, 0.32, 0.05, 0.9], solid: false, transparentForMeshing: true },
  { id: BlockId.Snow, name: "Snow", color: [0.95, 0.97, 1.0, 1.0], solid: false, transparentForMeshing: false },
  { id: BlockId.SnowBlock, name: "Snow Block", color: [0.95, 0.97, 1.0, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Ice, name: "Ice", color: [0.55, 0.78, 1.0, 0.75], solid: true, transparentForMeshing: false },
  { id: BlockId.PackedIce, name: "Packed Ice", color: [0.55, 0.78, 1.0, 0.75], solid: true, transparentForMeshing: false },
  { id: BlockId.BlueIce, name: "Blue Ice", color: [0.55, 0.78, 1.0, 0.75], solid: true, transparentForMeshing: false },
];
