import { DynamicTexture, Scene } from "@babylonjs/core";
import type { TextureMatrix } from "./types";

/**
 * Crée une texture dynamique à partir d'une matrice de couleurs
 * @param scene La scène Babylon.js
 * @param name Le nom de la texture
 * @param textureData La définition de la texture (palette, dimensions, matrice)
 * @param scale Le facteur d'échelle pour les pixels (par défaut 16)
 * @returns La texture créée
 */
export function createTextureFromMatrix(
  scene: Scene,
  name: string,
  textureData: TextureMatrix,
  scale: number = 16
): DynamicTexture {
  const { width, height, matrix, palette } = textureData;

  const texture = new DynamicTexture(
    name,
    { width: width * scale, height: height * scale },
    scene,
    false
  );
  const ctx = texture.getContext();

  for (let y = 0; y < height; y++) {
    const row = matrix[y];
    for (let x = 0; x < width; x++) {
      const char = row[x];
      const color = palette[char];

      if (!color) {
        console.warn(`Color not found in palette for character: ${char}`);
        continue;
      }

      ctx.fillStyle = `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(color[2] * 255)}, ${color[3]})`;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  texture.update();
  texture.hasAlpha = true;
  texture.updateSamplingMode(1); // Nearest neighbor pour effet pixelisé
  texture.metadata = {
    ...(texture.metadata ?? {}),
    matrixWidth: width,
    matrixHeight: height,
    pixelScale: scale,
  };
  return texture;
}
