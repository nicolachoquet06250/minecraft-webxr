import { BlockId } from "../types";
import type { BlockDefinition, BlockTextureDefinition } from "./types";

const allFaces = (texture: BlockTextureDefinition) => ({
  top: texture,
  bottom: texture,
  front: texture,
  back: texture,
  right: texture,
  left: texture,
});

const logBarkMatrix = [
  "ABBCBBACBBCBBACB",
  "ABBCBBACBBCBBACB",
  "ACCBBDACCCBBDACB",
  "ABBCBBACBBCBBACB",
  "ABDCBBADBBCBBADB",
  "ABBCBBACBBCBBACB",
  "ACCBBDACCCBBDACB",
  "ABBCBBACBBCBBACB",
  "ABBCBBADBBCBBADB",
  "ACCBBDACCCBBDACB",
  "ABBCBBACBBCBBACB",
  "ABDCBBADBBCBBADB",
  "ABBCBBACBBCBBACB",
  "ACCBBDACCCBBDACB",
  "ABBCBBACBBCBBACB",
  "ABBCBBADBBCBBADB",
];

const logRingMatrix = [
  "DDDDAAAAAAAADDDD",
  "DDAABBBBBBBBAADD",
  "DABCCCCCCCCCCBAD",
  "ABCCBBAAAABBCCBA",
  "ABCBBAAAAABBCBBA",
  "ABCBBAEEEEABCBBA",
  "ABCAAEEFFEABCBA",
  "ABCBAEFGFEABCBA",
  "ABCBAEFGFEABCBA",
  "ABCAAEEFFEABCBA",
  "ABCBBAEEEEABCBBA",
  "ABCBBAAAAABBCBBA",
  "ABCCBBAAAABBCCBA",
  "DABCCCCCCCCCCBAD",
  "DDAABBBBBBBBAADD",
  "DDDDAAAAAAAADDDD",
];

const leavesMatrix = [
  "ABBCDACBBACDABBC",
  "BBCDABBCDACBBACD",
  "CDAEBCDACBBACDAB",
  "BCDACBBACDAEBCDA",
  "ACBBACDABBCDACBB",
  "CDABBCDACBBACDAE",
  "BBACDAEBCDACBBAC",
  "DABBCDACBBACDABB",
  "BCDACBBACDABBCDA",
  "ACBBACDAEBCDACBB",
  "CDABBCDACBBACDAB",
  "BBACDABBCDACBBAC",
  "DABBCDAEBCDACBBA",
  "BCDACBBACDABBCDA",
  "ACDABBCDACBBACDA",
  "BBACDABBCDAEBCDA",
];

const createLogTextures = (
  barkPalette: BlockTextureDefinition["palette"],
  ringPalette: BlockTextureDefinition["palette"],
) => {
  const side: BlockTextureDefinition = {
    palette: barkPalette,
    matrix: logBarkMatrix,
  };

  const end: BlockTextureDefinition = {
    palette: ringPalette,
    matrix: logRingMatrix,
  };

  return {
    top: end,
    bottom: end,
    front: side,
    back: side,
    right: side,
    left: side,
  };
};

const createLeavesTexture = (palette: BlockTextureDefinition["palette"]): BlockTextureDefinition => ({
  palette,
  matrix: leavesMatrix,
});

const oakLogTextures = createLogTextures(
  {
    A: [0.23, 0.14, 0.07, 1],
    B: [0.34, 0.22, 0.12, 1],
    C: [0.44, 0.30, 0.16, 1],
    D: [0.16, 0.09, 0.04, 1],
  },
  {
    A: [0.55, 0.38, 0.20, 1],
    B: [0.68, 0.50, 0.27, 1],
    C: [0.78, 0.61, 0.34, 1],
    D: [0.38, 0.24, 0.12, 1],
    E: [0.48, 0.31, 0.16, 1],
    F: [0.32, 0.19, 0.09, 1],
    G: [0.22, 0.13, 0.06, 1],
  },
);

const spruceLogTextures = createLogTextures(
  {
    A: [0.16, 0.09, 0.05, 1],
    B: [0.25, 0.15, 0.08, 1],
    C: [0.34, 0.22, 0.12, 1],
    D: [0.10, 0.06, 0.03, 1],
  },
  {
    A: [0.46, 0.31, 0.17, 1],
    B: [0.58, 0.42, 0.24, 1],
    C: [0.70, 0.53, 0.31, 1],
    D: [0.30, 0.18, 0.09, 1],
    E: [0.38, 0.24, 0.12, 1],
    F: [0.24, 0.14, 0.07, 1],
    G: [0.16, 0.09, 0.04, 1],
  },
);

const birchLogTextures = createLogTextures(
  {
    A: [0.76, 0.73, 0.62, 1],
    B: [0.88, 0.85, 0.72, 1],
    C: [0.58, 0.55, 0.47, 1],
    D: [0.16, 0.15, 0.13, 1],
  },
  {
    A: [0.69, 0.55, 0.32, 1],
    B: [0.80, 0.65, 0.40, 1],
    C: [0.90, 0.76, 0.50, 1],
    D: [0.42, 0.30, 0.16, 1],
    E: [0.56, 0.40, 0.22, 1],
    F: [0.35, 0.23, 0.12, 1],
    G: [0.24, 0.15, 0.07, 1],
  },
);

const jungleLogTextures = createLogTextures(
  {
    A: [0.28, 0.14, 0.08, 1],
    B: [0.42, 0.22, 0.13, 1],
    C: [0.56, 0.33, 0.20, 1],
    D: [0.19, 0.09, 0.05, 1],
  },
  {
    A: [0.62, 0.40, 0.24, 1],
    B: [0.74, 0.52, 0.32, 1],
    C: [0.84, 0.64, 0.41, 1],
    D: [0.42, 0.25, 0.14, 1],
    E: [0.52, 0.32, 0.18, 1],
    F: [0.33, 0.18, 0.10, 1],
    G: [0.22, 0.12, 0.06, 1],
  },
);

const acaciaLogTextures = createLogTextures(
  {
    A: [0.30, 0.28, 0.25, 1],
    B: [0.42, 0.39, 0.34, 1],
    C: [0.52, 0.48, 0.42, 1],
    D: [0.21, 0.19, 0.17, 1],
  },
  {
    A: [0.62, 0.30, 0.16, 1],
    B: [0.76, 0.40, 0.21, 1],
    C: [0.88, 0.52, 0.28, 1],
    D: [0.42, 0.19, 0.10, 1],
    E: [0.54, 0.25, 0.13, 1],
    F: [0.33, 0.14, 0.07, 1],
    G: [0.22, 0.09, 0.04, 1],
  },
);

const darkOakLogTextures = createLogTextures(
  {
    A: [0.12, 0.07, 0.03, 1],
    B: [0.19, 0.11, 0.05, 1],
    C: [0.28, 0.17, 0.08, 1],
    D: [0.07, 0.04, 0.02, 1],
  },
  {
    A: [0.36, 0.22, 0.11, 1],
    B: [0.48, 0.31, 0.16, 1],
    C: [0.60, 0.42, 0.23, 1],
    D: [0.22, 0.13, 0.06, 1],
    E: [0.30, 0.18, 0.09, 1],
    F: [0.18, 0.10, 0.05, 1],
    G: [0.10, 0.06, 0.03, 1],
  },
);

const mangroveLogTextures = createLogTextures(
  {
    A: [0.25, 0.08, 0.06, 1],
    B: [0.38, 0.13, 0.09, 1],
    C: [0.50, 0.20, 0.13, 1],
    D: [0.16, 0.05, 0.04, 1],
  },
  {
    A: [0.58, 0.27, 0.18, 1],
    B: [0.72, 0.38, 0.25, 1],
    C: [0.84, 0.50, 0.33, 1],
    D: [0.36, 0.15, 0.10, 1],
    E: [0.48, 0.21, 0.14, 1],
    F: [0.28, 0.11, 0.07, 1],
    G: [0.18, 0.07, 0.04, 1],
  },
);

const cherryLogTextures = createLogTextures(
  {
    A: [0.36, 0.20, 0.22, 1],
    B: [0.52, 0.31, 0.34, 1],
    C: [0.66, 0.43, 0.46, 1],
    D: [0.24, 0.13, 0.15, 1],
  },
  {
    A: [0.74, 0.47, 0.49, 1],
    B: [0.86, 0.60, 0.62, 1],
    C: [0.95, 0.72, 0.73, 1],
    D: [0.50, 0.28, 0.30, 1],
    E: [0.62, 0.37, 0.39, 1],
    F: [0.39, 0.21, 0.23, 1],
    G: [0.26, 0.14, 0.16, 1],
  },
);

const oakLeavesTexture = createLeavesTexture({
  A: [0.10, 0.34, 0.08, 0.9],
  B: [0.16, 0.50, 0.12, 0.9],
  C: [0.22, 0.62, 0.16, 0.9],
  D: [0.07, 0.24, 0.06, 0.9],
  E: [0.30, 0.72, 0.22, 0.9],
});

const spruceLeavesTexture = createLeavesTexture({
  A: [0.05, 0.20, 0.11, 0.9],
  B: [0.08, 0.32, 0.16, 0.9],
  C: [0.13, 0.42, 0.21, 0.9],
  D: [0.03, 0.14, 0.08, 0.9],
  E: [0.18, 0.50, 0.26, 0.9],
});

const birchLeavesTexture = createLeavesTexture({
  A: [0.26, 0.44, 0.08, 0.9],
  B: [0.38, 0.62, 0.14, 0.9],
  C: [0.52, 0.74, 0.20, 0.9],
  D: [0.18, 0.32, 0.06, 0.9],
  E: [0.66, 0.84, 0.28, 0.9],
});

const jungleLeavesTexture = createLeavesTexture({
  A: [0.07, 0.30, 0.08, 0.9],
  B: [0.12, 0.46, 0.12, 0.9],
  C: [0.18, 0.58, 0.18, 0.9],
  D: [0.04, 0.20, 0.05, 0.9],
  E: [0.28, 0.68, 0.24, 0.9],
});

const acaciaLeavesTexture = createLeavesTexture({
  A: [0.20, 0.38, 0.08, 0.9],
  B: [0.30, 0.52, 0.12, 0.9],
  C: [0.42, 0.64, 0.18, 0.9],
  D: [0.14, 0.26, 0.05, 0.9],
  E: [0.52, 0.74, 0.25, 0.9],
});

const darkOakLeavesTexture = createLeavesTexture({
  A: [0.05, 0.22, 0.04, 0.9],
  B: [0.09, 0.34, 0.07, 0.9],
  C: [0.14, 0.44, 0.10, 0.9],
  D: [0.03, 0.15, 0.03, 0.9],
  E: [0.20, 0.52, 0.15, 0.9],
});

const mangroveLeavesTexture = createLeavesTexture({
  A: [0.09, 0.30, 0.09, 0.9],
  B: [0.14, 0.42, 0.12, 0.9],
  C: [0.20, 0.54, 0.18, 0.9],
  D: [0.05, 0.21, 0.06, 0.9],
  E: [0.30, 0.62, 0.22, 0.9],
});

const cherryLeavesTexture = createLeavesTexture({
  A: [0.70, 0.34, 0.48, 0.9],
  B: [0.86, 0.48, 0.62, 0.9],
  C: [0.96, 0.64, 0.74, 0.9],
  D: [0.54, 0.24, 0.36, 0.9],
  E: [1.00, 0.76, 0.82, 0.9],
});

export const treeBlockDefinitions: BlockDefinition[] = [
  { id: BlockId.OakLog, name: "Oak Log", frenchName: "bûche de chêne", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: oakLogTextures },
  { id: BlockId.SpruceLog, name: "Spruce Log", frenchName: "bûche de sapin", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: spruceLogTextures },
  { id: BlockId.BirchLog, name: "Birch Log", frenchName: "bûche de bouleau", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: birchLogTextures },
  { id: BlockId.JungleLog, name: "Jungle Log", frenchName: "bûche d'acajou", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: jungleLogTextures },
  { id: BlockId.AcaciaLog, name: "Acacia Log", frenchName: "bûche d'acacia", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: acaciaLogTextures },
  { id: BlockId.DarkOakLog, name: "Dark Oak Log", frenchName: "bûche de chêne noir", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: darkOakLogTextures },
  { id: BlockId.MangroveLog, name: "Mangrove Log", frenchName: "bûche de palétuvier", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: mangroveLogTextures },
  { id: BlockId.CherryLog, name: "Cherry Log", frenchName: "bûche de cerisier", color: [0.25, 0.15, 0.05, 1.0], solid: true, transparentForMeshing: false, textures: cherryLogTextures },
  { id: BlockId.OakLeaves, name: "Oak Leaves", frenchName: "feuilles de chêne", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(oakLeavesTexture) },
  { id: BlockId.SpruceLeaves, name: "Spruce Leaves", frenchName: "feuilles de sapin", color: [0.08, 0.32, 0.16, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(spruceLeavesTexture) },
  { id: BlockId.BirchLeaves, name: "Birch Leaves", frenchName: "feuilles de bouleau", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(birchLeavesTexture) },
  { id: BlockId.JungleLeaves, name: "Jungle Leaves", frenchName: "feuilles d'acajou", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(jungleLeavesTexture) },
  { id: BlockId.AcaciaLeaves, name: "Acacia Leaves", frenchName: "feuilles d'acacia", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(acaciaLeavesTexture) },
  { id: BlockId.DarkOakLeaves, name: "Dark Oak Leaves", frenchName: "feuilles de chêne noir", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(darkOakLeavesTexture) },
  { id: BlockId.MangroveLeaves, name: "Mangrove Leaves", frenchName: "feuilles de palétuvier", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(mangroveLeavesTexture) },
  { id: BlockId.CherryLeaves, name: "Cherry Leaves", frenchName: "feuilles de cerisier", color: [0.16, 0.5, 0.12, 0.9], solid: true, transparentForMeshing: false, textures: allFaces(cherryLeavesTexture) },
  { id: BlockId.OakPlanks, name: "Oak Planks", frenchName: "planches de chêne", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.SprucePlanks, name: "Spruce Planks", frenchName: "planches de sapin", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.BirchPlanks, name: "Birch Planks", frenchName: "planches de bouleau", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.JunglePlanks, name: "Jungle Planks", frenchName: "planches d'acajou", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.AcaciaPlanks, name: "Acacia Planks", frenchName: "planches d'acacia", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.DarkOakPlanks, name: "Dark Oak Planks", frenchName: "planches de chêne noir", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.MangrovePlanks, name: "Mangrove Planks", frenchName: "planches de palétuvier", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
  { id: BlockId.CherryPlanks, name: "Cherry Planks", frenchName: "planches de cerisier", color: [0.58, 0.38, 0.18, 1.0], solid: true, transparentForMeshing: false },
];
