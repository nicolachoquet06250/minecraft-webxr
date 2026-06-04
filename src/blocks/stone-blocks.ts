import { BlockId } from "../types";
import type { BlockDefinition, BlockTextureDefinition } from "./types";

const stoneTexture: BlockTextureDefinition = {
  palette: {
    A: [0.56, 0.56, 0.56, 1],
    B: [0.50, 0.50, 0.50, 1],
    C: [0.45, 0.45, 0.45, 1],
    D: [0.41, 0.41, 0.41, 1],
  },
  matrix: [
    "AAAABCCBCDCCBBBB",
    "BBCBCBBBBBBDDCBC",
    "BCDDCCCDCCCBBBBB",
    "BBAABABBAABBBCCC",
    "CBBCCCBCBAAAACBB",
    "BABBBBBBBCCDCDCA",
    "CBBAAACAACCCBBBB",
    "CCDDCDCCBBCCCBBB",
    "AAABABBAAABBBBBC",
    "BBABBBAAABBAAAAB",
    "DBCBCCDDCBCBBCCC",
    "BBBBBAABBBBBAABA",
    "BCCCBABCCBBDDCDC",
    "AABCCBBCCCBBCCCA",
    "BCCBBBBBBBBBAAAA",
    "BBBBBBCCBAABBCBB",
  ]
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
