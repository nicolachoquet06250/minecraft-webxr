import { BlockId } from "../types";
import type { BlockDefinition } from "./types";

export const oreBlockDefinitions: BlockDefinition[] = [
  { id: BlockId.CoalOre, name: "Coal Ore", frenchName: "minerai de charbon", color: [0.12, 0.12, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.IronOre, name: "Iron Ore", frenchName: "minerai de fer", color: [0.78, 0.58, 0.38, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.CopperOre, name: "Copper Ore", frenchName: "minerai de cuivre", color: [0.75, 0.42, 0.25, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.GoldOre, name: "Gold Ore", frenchName: "minerai d'or", color: [1.0, 0.78, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.RedstoneOre, name: "Redstone Ore", frenchName: "minerai de redstone", color: [0.8, 0.05, 0.05, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.LapisOre, name: "Lapis Ore", frenchName: "minerai de lapis-lazuli", color: [0.08, 0.18, 0.75, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DiamondOre, name: "Diamond Ore", frenchName: "minerai de diamant", color: [0.25, 0.9, 0.95, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.EmeraldOre, name: "Emerald Ore", frenchName: "minerai d'émeraude", color: [0.1, 0.8, 0.25, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateCoalOre, name: "Deepslate Coal Ore", frenchName: "minerai de charbon des abîmes", color: [0.12, 0.12, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateIronOre, name: "Deepslate Iron Ore", frenchName: "minerai de fer des abîmes", color: [0.78, 0.58, 0.38, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateCopperOre, name: "Deepslate Copper Ore", frenchName: "minerai de cuivre des abîmes", color: [0.75, 0.42, 0.25, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateGoldOre, name: "Deepslate Gold Ore", frenchName: "minerai d'or des abîmes", color: [1.0, 0.78, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateRedstoneOre, name: "Deepslate Redstone Ore", frenchName: "minerai de redstone des abîmes", color: [0.8, 0.05, 0.05, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateLapisOre, name: "Deepslate Lapis Ore", frenchName: "minerai de lapis-lazuli des abîmes", color: [0.08, 0.18, 0.75, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateDiamondOre, name: "Deepslate Diamond Ore", frenchName: "minerai de diamant des abîmes", color: [0.25, 0.9, 0.95, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DeepslateEmeraldOre, name: "Deepslate Emerald Ore", frenchName: "minerai d'émeraude des abîmes", color: [0.1, 0.8, 0.25, 1.0], solid: true, transparentForMeshing: false },
];
