import { BlockId } from "../types";
import type { BlockDefinition, BlockTextureDefinition } from "./types";

const stonePalette = {
  A: [0.56, 0.56, 0.56, 1],
  B: [0.50, 0.50, 0.50, 1],
  C: [0.45, 0.45, 0.45, 1],
  D: [0.41, 0.41, 0.41, 1],
} as const;

const stoneSource = [
  [0, 0, 0, 0, 1, 2, 2, 1, 2, 3, 2, 2, 1, 1, 1, 1],
  [1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 3, 3, 2, 1, 2],
  [1, 2, 3, 3, 2, 2, 2, 3, 2, 2, 2, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 2, 2, 2],
  [2, 1, 1, 2, 2, 2, 1, 2, 1, 0, 0, 0, 0, 2, 1, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 2, 3, 2, 0],
  [2, 1, 1, 0, 0, 0, 2, 0, 0, 2, 2, 2, 1, 1, 1, 1],
  [2, 2, 3, 3, 2, 3, 2, 2, 1, 1, 2, 2, 2, 1, 1, 1],
  [0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 2],
  [1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1],
  [3, 1, 2, 1, 2, 2, 3, 3, 2, 1, 2, 1, 1, 2, 2, 2],
  [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0],
  [1, 2, 2, 2, 1, 0, 1, 2, 2, 1, 1, 3, 3, 2, 3, 2],
  [0, 0, 1, 2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 0],
  [1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 0, 0, 1, 1, 2, 1, 1],
] as const;

const stoneKeys = ["A", "B", "C", "D"] as const;

const stoneTexture: BlockTextureDefinition = {
  palette: stonePalette,
  matrix: stoneSource.map((row) => row.map((cell) => stoneKeys[cell]).join("")),
};

const allFaces = (texture: BlockTextureDefinition) => ({
  top: texture,
  bottom: texture,
  front: texture,
  back: texture,
  right: texture,
  left: texture,
});

export const stoneBlockDefinitions: BlockDefinition[] = [
  {
    id: BlockId.Stone,
    name: "Stone",
    color: [0.45, 0.45, 0.45, 1.0],
    solid: true,
    transparentForMeshing: false,
    textures: allFaces(stoneTexture),
  },
];
