import fs from "node:fs";
import path from "node:path";

function rgbaToCss([r, g, b, a]) {
  const red = Math.round(r * 255);
  const green = Math.round(g * 255);
  const blue = Math.round(b * 255);

  return `rgba(${red}, ${green}, ${blue}, ${a})`;
}

function generateTextureSvg(texture, size = 900) {
  const rows = texture.matrix.length;
  const cols = texture.matrix[0]?.length ?? 0;

  if (rows === 0 || cols === 0) {
    throw new Error("La matrice est vide.");
  }

  const cellWidth = size / cols;
  const cellHeight = size / rows;

  const rects = [];

  for (let y = 0; y < rows; y++) {
    const row = texture.matrix[y];

    if (row.length !== cols) {
      throw new Error(`La ligne ${y} n'a pas la meme largeur que les autres.`);
    }

    for (let x = 0; x < cols; x++) {
      const colorKey = row[x];
      const color = texture.palette[colorKey];

      if (!color) {
        throw new Error(`Couleur inconnue "${colorKey}" en position ${x}, ${y}.`);
      }

      rects.push(
        `<rect x="${x * cellWidth}" y="${y * cellHeight}" width="${cellWidth}" height="${cellHeight}" fill="${rgbaToCss(color)}" />`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    ...rects,
    "</svg>",
  ].join("\n");
}

const planksMatrix = [
  "ABBBBBBBAAAABBBA",
  "CCCDDDACDDDDDDCC",
  "EEEEBFGCBEEEEEEE",
  "HHFFHHGFFFHHHFFH",
  "AAAABBBBBAABBBBA",
  "CCCDDDDCCCCGDDDC",
  "FEEEEEEEEBCAEBEF",
  "HHHHHHHHFFFAFFFH",
  "AAAAAABBBBBBBBAA",
  "DDDGCDDDDDCCCCDD",
  "EBCAEBEEEEEEEEEE",
  "HEEGHHFFFFFFHHHH",
  "AABBBBBBBAAAAAAA",
  "CDDDCCCCDADDDDCC",
  "EEEEEEEBFACBEEEE",
  "HHHHHHHFFGHHHFFF",
];

const textures = {
  "oak-planks": {
    palette: {
      A: [0.6745, 0.5216, 0.3569, 1],
      B: [0.6667, 0.5569, 0.3529, 1],
      C: [0.7843, 0.6784, 0.4471, 1],
      D: [0.8235, 0.7176, 0.4824, 1],
      E: [0.7765, 0.6471, 0.4392, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "spruce-planks": {
    palette: {
      A: [0.43, 0.31, 0.19, 1],
      B: [0.50, 0.37, 0.23, 1],
      C: [0.58, 0.44, 0.28, 1],
      D: [0.34, 0.24, 0.14, 1],
      E: [0.25, 0.17, 0.10, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "birch-planks": {
    palette: {
      A: [0.80, 0.74, 0.52, 1],
      B: [0.86, 0.80, 0.58, 1],
      C: [0.92, 0.86, 0.66, 1],
      D: [0.70, 0.62, 0.42, 1],
      E: [0.58, 0.49, 0.32, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "jungle-planks": {
    palette: {
      A: [0.71, 0.50, 0.27, 1],
      B: [0.77, 0.56, 0.31, 1],
      C: [0.84, 0.63, 0.37, 1],
      D: [0.60, 0.41, 0.22, 1],
      E: [0.48, 0.32, 0.17, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "acacia-planks": {
    palette: {
      A: [0.71, 0.42, 0.23, 1],
      B: [0.78, 0.47, 0.27, 1],
      C: [0.86, 0.55, 0.33, 1],
      D: [0.60, 0.34, 0.18, 1],
      E: [0.46, 0.25, 0.13, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "dark-oak-planks": {
    palette: {
      A: [0.30, 0.20, 0.12, 1],
      B: [0.35, 0.24, 0.14, 1],
      C: [0.42, 0.30, 0.18, 1],
      D: [0.23, 0.15, 0.09, 1],
      E: [0.17, 0.10, 0.06, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "mangrove-planks": {
    palette: {
      A: [0.45, 0.24, 0.17, 1],
      B: [0.52, 0.29, 0.20, 1],
      C: [0.60, 0.36, 0.25, 1],
      D: [0.36, 0.19, 0.13, 1],
      E: [0.27, 0.13, 0.09, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "cherry-planks": {
    palette: {
      A: [0.76, 0.53, 0.49, 1],
      B: [0.83, 0.60, 0.56, 1],
      C: [0.90, 0.69, 0.65, 1],
      D: [0.64, 0.42, 0.38, 1],
      E: [0.50, 0.31, 0.28, 1],
      F: [0.7804, 0.6235, 0.3843, 1],
      G: [0.6667, 0.549, 0.3569, 1],
      H: [0.7647, 0.6039, 0.3804, 1],
    },
    matrix: planksMatrix,
  },
  "crafting-table-top": {
    palette: {
      A: [0.0549, 0.0431, 0.0235, 1],
      B: [0.098, 0.0784, 0.0471, 1],
      C: [0.102, 0.0824, 0.051, 1],
      D: [0.2549, 0.1373, 0.0549, 1],
      E: [0.2941, 0.1686, 0.0941, 1],
      F: [0.3333, 0.2196, 0.1412, 1],
      G: [0.451, 0.2235, 0.1255, 1],
      H: [0.6196, 0.349, 0.1961, 1],
      I: [0.6824, 0.4118, 0.2353, 1],
      J: [0.7373, 0.5961, 0.3843, 1],
    },
    matrix: [
      "BAABDGGGGGGDCACB",
      "AJJDHIIIIIIHDJJA",
      "AJDIIIIIIIIIIDJA",
      "BDIFEFFFEEEEFIDB",
      "DHIFHIFIIEIIFIHD",
      "GIIFIIEHIFHIFIIG",
      "GIIFFEFFEFFEFIIG",
      "GIIFIIFIIFIIFIIG",
      "GIIFIIFIIFIIFIIG",
      "GIIEEEFEEFFEFIIG",
      "GIIEHIEIHEIIFIIG",
      "DHIFHIEIIEHIFIHD",
      "CDIFFEFFFFFFFIDC",
      "AJDIIIIIIIIIIDJA",
      "CJJDHIIIIIIHDJJC",
      "BCACDGGGGGGDBAAB",
    ],
  },
  "crafting-table-front": {
    palette: {
      A: [0.0667, 0.0549, 0.0314, 1],
      B: [0.098, 0.0784, 0.0471, 1],
      C: [0.1059, 0.0863, 0.051, 1],
      D: [0.1569, 0.1176, 0.0431, 1],
      E: [0.2196, 0.1294, 0.0863, 1],
      F: [0.2549, 0.1373, 0.0549, 1],
      G: [0.2941, 0.1686, 0.0941, 1],
      H: [0.451, 0.2235, 0.1255, 1],
      I: [0.4039, 0.3137, 0.1725, 1],
      J: [0.4941, 0.3843, 0.2157, 1],
      K: [0.5882, 0.4549, 0.2549, 1],
      L: [0.651, 0.5098, 0.302, 1],
      M: [0.7098, 0.5529, 0.3137, 1],
      N: [0.7216, 0.5804, 0.3725, 1],
      O: [0.7569, 0.6235, 0.4157, 1],
      P: [0.7098, 0.7098, 0.7098, 1],
      Q: [0.8471, 0.8471, 0.8471, 1],
      R: [1, 1, 1, 1],
    },
    matrix: [
      "BMNNNEHGGHENNNNB",
      "BNMMKLEGGEMMNNLB",
      "BNNNNNNEEMOOOOOB",
      "BKJKKJICCJIFFFIB",
      "BOLOOOOGGNNDMDLB",
      "BNNFLMLEEMMDDDNB",
      "BNMDNNNEENNPPPNB",
      "BIJDJJJCCKKRQQKB",
      "BLLDMMOGGNNRQQNB",
      "BNQQQNMEEMMLQQLB",
      "BNPQROOEENNNRQNB",
      "BIIIIJIAAKKKJQIB",
      "BLNNNNNGGOMKMRNB",
      "BMNNLLMEENNNNLLB",
      "BNNNNNNEEONNNNNB",
      "CIIIJJKBCJJJIJIC",
    ],
  },
  "crafting-table-back": {
    palette: {
      A: [0.0667, 0.0549, 0.0314, 1],
      B: [0.098, 0.0784, 0.0471, 1],
      C: [0.1059, 0.0863, 0.051, 1],
      D: [0.1569, 0.1176, 0.0431, 1],
      E: [0.2196, 0.1294, 0.0863, 1],
      F: [0.2549, 0.1373, 0.0549, 1],
      G: [0.2941, 0.1686, 0.0941, 1],
      H: [0.451, 0.2235, 0.1255, 1],
      I: [0.4039, 0.3137, 0.1725, 1],
      J: [0.4941, 0.3843, 0.2157, 1],
      K: [0.5882, 0.4549, 0.2549, 1],
      L: [0.651, 0.5098, 0.302, 1],
      M: [0.7098, 0.5529, 0.3137, 1],
      N: [0.7216, 0.5804, 0.3725, 1],
      O: [0.7569, 0.6235, 0.4157, 1],
      P: [0.7098, 0.7098, 0.7098, 1],
      Q: [0.8471, 0.8471, 0.8471, 1],
      R: [1, 1, 1, 1],
    },
    matrix: [
      "BMNNNEHGGHENNNNB",
      "BNMMKLEGGEMMNNLB",
      "BNNNNNNEEMOOOOOB",
      "BKJKKJICCJIFFFIB",
      "BOLOOOOGGNNDMDLB",
      "BNNFLMLEEMMDDDNB",
      "BNMDNNNEENNPPPNB",
      "BIJDJJJCCKKRQQKB",
      "BLLDMMOGGNNRQQNB",
      "BNQQQNMEEMMLQQLB",
      "BNPQROOEENNNRQNB",
      "BIIIIJIAAKKKJQIB",
      "BLNNNNNGGOMKMRNB",
      "BMNNLLMEENNNNLLB",
      "BNNNNNNEEONNNNNB",
      "CIIIJJKBCJJJIJIC",
    ],
  },
  "crafting-table-left": {
    palette: {
      A: [0.0667, 0.0549, 0.0314, 1],
      B: [0.098, 0.0784, 0.0471, 1],
      C: [0.1059, 0.0863, 0.051, 1],
      D: [0.1569, 0.1176, 0.0431, 1],
      E: [0.149, 0.1255, 0.0706, 1],
      F: [0.2196, 0.1294, 0.0863, 1],
      G: [0.2549, 0.1373, 0.0549, 1],
      H: [0.2941, 0.1686, 0.0941, 1],
      I: [0.451, 0.2235, 0.1255, 1],
      J: [0.4039, 0.3137, 0.1725, 1],
      K: [0.4941, 0.3843, 0.2157, 1],
      L: [0.5882, 0.4549, 0.2549, 1],
      M: [0.651, 0.5098, 0.302, 1],
      N: [0.7098, 0.5529, 0.3137, 1],
      O: [0.7216, 0.5804, 0.3725, 1],
      P: [0.7569, 0.6235, 0.4157, 1],
      Q: [0.7098, 0.7098, 0.7098, 1],
      R: [0.8471, 0.8471, 0.8471, 1],
    },
    matrix: [
      "BNOOOFIHHIFOOOOB",
      "BONNLMFHHFNNOOMB",
      "BOOOOOOEENPPPPPB",
      "BLKLLKJCCKJKJJJB",
      "BPMPPPPHHOOONNMB",
      "BOOGMGMFFNNOOOOB",
      "BONDODOFFOONNMOB",
      "BJKJRKKCCLLKKLLB",
      "BMMRNRPHHOOOOOOB",
      "BOOQOQNFFNNMNMMB",
      "BOPPPPPFFOOOOOOB",
      "BJJJJKJAALLLKKJB",
      "BMOOOOOHHPNLNOOB",
      "BNOOMMNFFOOOOMMB",
      "BOOOOOOFFPOOOOOB",
      "CJJJKKLBCKKKJKJC",
    ],
  },
  "crafting-table-right": {
    palette: {
      A: [0.0667, 0.0549, 0.0314, 1],
      B: [0.098, 0.0784, 0.0471, 1],
      C: [0.1059, 0.0863, 0.051, 1],
      D: [0.1569, 0.1176, 0.0431, 1],
      E: [0.149, 0.1255, 0.0706, 1],
      F: [0.2196, 0.1294, 0.0863, 1],
      G: [0.2549, 0.1373, 0.0549, 1],
      H: [0.2941, 0.1686, 0.0941, 1],
      I: [0.451, 0.2235, 0.1255, 1],
      J: [0.4039, 0.3137, 0.1725, 1],
      K: [0.4941, 0.3843, 0.2157, 1],
      L: [0.5882, 0.4549, 0.2549, 1],
      M: [0.651, 0.5098, 0.302, 1],
      N: [0.7098, 0.5529, 0.3137, 1],
      O: [0.7216, 0.5804, 0.3725, 1],
      P: [0.7569, 0.6235, 0.4157, 1],
      Q: [0.7098, 0.7098, 0.7098, 1],
      R: [0.8471, 0.8471, 0.8471, 1],
    },
    matrix: [
      "BNOOOFIHHIFOOOOB",
      "BONNLMFHHFNNOOMB",
      "BOOOOOOEENPPPPPB",
      "BLKLLKJCCKJKJJJB",
      "BPMPPPPHHOOONNMB",
      "BOOGMGMFFNNOOOOB",
      "BONDODOFFOONNMOB",
      "BJKJRKKCCLLKKLLB",
      "BMMRNRPHHOOOOOOB",
      "BOOQOQNFFNNMNMMB",
      "BOPPPPPFFOOOOOOB",
      "BJJJJKJAALLLKKJB",
      "BMOOOOOHHPNLNOOB",
      "BNOOMMNFFOOOOMMB",
      "BOOOOOOFFPOOOOOB",
      "CJJJKKLBCKKKJKJC",
    ],
  },
  "crafting-table-bottom": {
    palette: {
      A: [0.4039, 0.3137, 0.1725, 1],
      B: [0.4941, 0.3843, 0.2157, 1],
      C: [0.5882, 0.4549, 0.2549, 1],
      D: [0.6235, 0.5176, 0.302, 1],
      E: [0.6863, 0.5608, 0.3333, 1],
      F: [0.7216, 0.5804, 0.3725, 1],
      G: [0.7608, 0.6157, 0.3843, 1],
    },
    matrix: [
      "FEFGGGGGFGGGGGFC",
      "FFEECDEFFFEEFFDD",
      "EFFFEFEDDDDEEFFC",
      "CBBCCBAABBABAABA",
      "FGDGGGGDGGGFEEDF",
      "EFFEDEDCDEEFFFFE",
      "DDEFEEECFFFEEDDD",
      "AABBCBAAAABBBCBA",
      "FGGFEEGGGGGGGGFD",
      "FEFFFFEDDDEDEDDC",
      "GFEEDDDDEEEEDDFD",
      "AABCCBAAABCBBAAA",
      "GDFGGFFDGGGDGFGG",
      "EEFFDDEDDFFEFEEE",
      "EDDEFEDCFFEDDDDD",
      "ABBAABCCCBABAAAA",
    ],
  },
};

const outputDir = path.resolve("docs/blocks/visuels");
fs.mkdirSync(outputDir, { recursive: true });

for (const [name, texture] of Object.entries(textures)) {
  const svg = generateTextureSvg(texture);
  fs.writeFileSync(path.join(outputDir, `${name}.svg`), `${svg}\n`, "utf8");
}

console.log(`Generated ${Object.keys(textures).length} SVG files in ${outputDir}`);
