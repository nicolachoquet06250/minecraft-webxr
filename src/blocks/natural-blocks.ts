import { BlockId } from "../types";
import type { BlockDefinition } from "./types";

export const naturalBlockDefinitions: BlockDefinition[] = [
  { id: BlockId.Water, name: "Water", frenchName: "eau", color: [0.1, 0.35, 0.85, 0.65], solid: false, transparentForMeshing: true, visualHeight: 0.88 },
  { id: BlockId.Lava, name: "Lava", frenchName: "lave", color: [1.0, 0.32, 0.05, 0.9], solid: false, transparentForMeshing: true },
  { id: BlockId.Snow, name: "Snow", frenchName: "neige", color: [0.95, 0.97, 1.0, 1.0], solid: false, transparentForMeshing: false },
  { id: BlockId.SnowBlock, name: "Snow Block", frenchName: "bloc de neige", color: [0.95, 0.97, 1.0, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Ice, name: "Ice", frenchName: "glace", color: [0.55, 0.78, 1.0, 0.75], solid: true, transparentForMeshing: false },
  { id: BlockId.PackedIce, name: "Packed Ice", frenchName: "glace compactée", color: [0.55, 0.78, 1.0, 0.75], solid: true, transparentForMeshing: false },
  { id: BlockId.BlueIce, name: "Blue Ice", frenchName: "glace bleue", color: [0.55, 0.78, 1.0, 0.75], solid: true, transparentForMeshing: false },
];
