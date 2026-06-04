import { Color4 } from "@babylonjs/core";
import type { BlockTextureDefinition } from "./types";

export const grassSideTexture: BlockTextureDefinition = {
  palette: {
    A: new Color4(0.16, 0.42, 0.11, 1),
    B: new Color4(0.22, 0.58, 0.14, 1),
    C: new Color4(0.32, 0.70, 0.22, 1),
    D: new Color4(0.42, 0.26, 0.15, 1),
    E: new Color4(0.52, 0.34, 0.20, 1),
    F: new Color4(0.34, 0.22, 0.13, 1),
    G: new Color4(0.62, 0.45, 0.28, 1),
    H: new Color4(0.55, 0.55, 0.49, 1),
  },
  matrix: [
    "ABCCBCBACCCBBCAA",
    "BCCCBCCACCCBBCAB",
    "DDEFDDEEGDDEFFDE",
    "FEGDEHDFEGFDEGDF",
    "DGFEFDEGDFEHGDEE",
    "GDFEDGFEGDFEDGFE",
    "DEGFDEHFGDEGFDDE",
    "FDDEGFEDEGFDHGFE",
    "EGFDEGDFEDDEGFDE",
    "DDEHGFEGFDDEGFDE",
    "FDEGDFEHFDEGDFED",
    "GDFEDDEGFDEGFDHG",
    "DEGFDEGDFEDDEGFE",
    "FDEHGFEDGDFEGDFE",
    "GDFEDGFEHDFEDGFE",
    "DEGFDDEGFEGDFEHD",
  ],
};

export const grassTopTexture: BlockTextureDefinition = {
  palette: {
    A: new Color4(0.16, 0.43, 0.10, 1),
    B: new Color4(0.20, 0.56, 0.13, 1),
    C: new Color4(0.28, 0.68, 0.18, 1),
    D: new Color4(0.35, 0.76, 0.23, 1),
  },
  matrix: [
    "ABBCDCCBABBCDCCB",
    "BCCBDDBCBCCBDDBC",
    "CDBBCCADCDBBCCAD",
    "BBACDBBCBBACDBBC",
    "DCCBABBCDCCBABBC",
    "ADDBCCBDADDBCCBD",
    "BCCADCDBBCCADCDB",
    "CDBBCBACDDBBCBAC",
    "ABBCDCCBABBCDCCB",
    "BCCBDDBCBCCBDDBC",
    "CDBBCCADCDBBCCAD",
    "BBACDBBCBBACDBBC",
    "DCCBABBCDCCBABBC",
    "ADDBCCBDADDBCCBD",
    "BCCADCDBBCCADCDB",
    "CDBBCBACDDBBCBAC",
  ],
};
