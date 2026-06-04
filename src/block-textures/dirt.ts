import { Color4 } from "@babylonjs/core";
import type { BlockTextureDefinition } from "./types";

export const dirtTexture: BlockTextureDefinition = {
  palette: {
    A: new Color4(0.42, 0.27, 0.16, 1),
    B: new Color4(0.50, 0.34, 0.20, 1),
    C: new Color4(0.35, 0.22, 0.13, 1),
    D: new Color4(0.60, 0.43, 0.27, 1),
    E: new Color4(0.28, 0.18, 0.11, 1),
    F: new Color4(0.68, 0.52, 0.34, 1),
    G: new Color4(0.56, 0.56, 0.50, 1),
  },
  matrix: [
    "BCDBBFACBBDCABGB",
    "DDBBBBAFBCBAABCD",
    "DDFBCFBAABDDCBAA",
    "FFBBAAABBBFDDAEE",
    "ABFDDAECBFDAABFD",
    "DGFFAEFDABFDBDCA",
    "BFFFEADBBFADBAAA",
    "DDBBBDDBCABBAAAB",
    "ABFFFBDBABADFFBB",
    "FFGDBFDBBAFFFDDB",
    "DADBBDFFFFBCDBBF",
    "FAAABABCDDDGABFD",
    "FFDABAEFDBFDCBBD",
    "DGEABDDBAFFBABFD",
    "ABBFDDBFBAAADDBF",
    "FBFDDABBFDDBDDBF",
  ],
};
