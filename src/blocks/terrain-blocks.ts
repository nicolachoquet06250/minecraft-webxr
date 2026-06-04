import { BlockId } from "../types";
import type { BlockDefinition } from "./types";

export const terrainBlockDefinitions: BlockDefinition[] = [
  { id: BlockId.Air, name: "Air", color: [1.0, 1.0, 1.0, 0.0], solid: false, transparentForMeshing: true },
  { id: BlockId.GrassBlock, name: "Grass Block", color: [0.25, 0.65, 0.2, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Dirt, name: "Dirt", color: [0.45, 0.28, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.CoarseDirt, name: "Coarse Dirt", color: [0.45, 0.28, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Podzol, name: "Podzol", color: [0.36, 0.23, 0.11, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.RootedDirt, name: "Rooted Dirt", color: [0.45, 0.28, 0.12, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Stone, name: "Stone", color: [0.45, 0.45, 0.45, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Deepslate, name: "Deepslate", color: [0.18, 0.18, 0.2, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Granite, name: "Granite", color: [0.58, 0.36, 0.29, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Diorite, name: "Diorite", color: [0.78, 0.78, 0.76, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Andesite, name: "Andesite", color: [0.42, 0.42, 0.42, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Tuff, name: "Tuff", color: [0.32, 0.34, 0.32, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Calcite, name: "Calcite", color: [0.86, 0.84, 0.78, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Gravel, name: "Gravel", color: [0.42, 0.4, 0.38, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Sand, name: "Sand", color: [0.82, 0.72, 0.42, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.RedSand, name: "Red Sand", color: [0.75, 0.33, 0.16, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.Clay, name: "Clay", color: [0.48, 0.52, 0.58, 1.0], solid: true, transparentForMeshing: false },
];
