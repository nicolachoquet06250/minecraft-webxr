import { BlockId } from "../types";
import type { BlockDefinition } from "./types";

export const plantBlockDefinitions: BlockDefinition[] = [
  { id: BlockId.Grass, name: "Grass", color: [0.2, 0.65, 0.18, 0.9], solid: false, transparentForMeshing: true },
  { id: BlockId.TallGrass, name: "Tall Grass", color: [0.2, 0.65, 0.18, 0.9], solid: false, transparentForMeshing: true },
  { id: BlockId.Fern, name: "Fern", color: [0.2, 0.65, 0.18, 0.9], solid: false, transparentForMeshing: true },
  { id: BlockId.DeadBush, name: "Dead Bush", color: [0.2, 0.45, 0.16, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.Cactus, name: "Cactus", color: [0.2, 0.45, 0.16, 1.0], solid: true, transparentForMeshing: true },
  { id: BlockId.SugarCane, name: "Sugar Cane", color: [0.45, 0.8, 0.35, 1.0], solid: true, transparentForMeshing: true },
  { id: BlockId.Dandelion, name: "Dandelion", color: [1.0, 0.9, 0.1, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.Poppy, name: "Poppy", color: [0.9, 0.05, 0.05, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.BlueOrchid, name: "Blue Orchid", color: [0.25, 0.5, 1.0, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.Allium, name: "Allium", color: [0.65, 0.35, 0.9, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.AzureBluet, name: "Azure Bluet", color: [0.95, 0.95, 0.9, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.RedTulip, name: "Red Tulip", color: [0.9, 0.05, 0.05, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.OrangeTulip, name: "Orange Tulip", color: [1.0, 0.45, 0.1, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.WhiteTulip, name: "White Tulip", color: [0.95, 0.95, 0.9, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.PinkTulip, name: "Pink Tulip", color: [1.0, 0.45, 0.72, 1.0], solid: false, transparentForMeshing: true },
  { id: BlockId.OxeyeDaisy, name: "Oxeye Daisy", color: [0.95, 0.95, 0.9, 1.0], solid: false, transparentForMeshing: true },
];
