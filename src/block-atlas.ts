import { DynamicTexture, Scene, StandardMaterial, Texture } from "@babylonjs/core";
import { blockDefinitions, getBlockDefinition, type BlockFaceName, type BlockTextureDefinition, type RgbaColor } from "./blocks";
import type { BlockId } from "./types";

const TILE_SIZE = 16;
const FALLBACK_TEXTURE_ID = "__fallback-white__";

type TextureTile = {
  readonly id: string;
  readonly texture: BlockTextureDefinition | null;
};

type FaceUv = readonly [number, number, number, number, number, number, number, number];

const textureTiles: TextureTile[] = collectTextureTiles();
const textureTileIndexById = new Map<string, number>(
  textureTiles.map((tile, index) => [tile.id, index]),
);

function collectTextureTiles(): TextureTile[] {
  const tiles: TextureTile[] = [{ id: FALLBACK_TEXTURE_ID, texture: null }];
  const knownTextureIds = new Set<string>([FALLBACK_TEXTURE_ID]);

  for (const block of blockDefinitions) {
    if (!block.textures) continue;

    for (const texture of Object.values(block.textures)) {
      if (!texture) continue;

      const id = getTextureId(texture);

      if (knownTextureIds.has(id)) continue;

      knownTextureIds.add(id);
      tiles.push({ id, texture });
    }
  }

  return tiles;
}

function getTextureId(texture: BlockTextureDefinition): string {
  return `${Object.keys(texture.palette).sort().join("")}:${texture.matrix.join("|")}`;
}

function rgbaToCss(color: RgbaColor): string {
  const [r, g, b, a] = color;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

function getTileIndexForTexture(texture: BlockTextureDefinition | null): number {
  if (!texture) return 0;

  return textureTileIndexById.get(getTextureId(texture)) ?? 0;
}

function getTileUv(tileIndex: number): { u0: number; u1: number; v0: number; v1: number } {
  const tileWidth = 1 / textureTiles.length;
  const u0 = tileIndex * tileWidth;
  const u1 = u0 + tileWidth;

  return { u0, u1, v0: 0, v1: 1 };
}

export function getBlockFaceTextureUv(blockId: BlockId, faceName: BlockFaceName): FaceUv | null {
  const texture = getBlockDefinition(blockId)?.textures?.[faceName] ?? null;

  if (!texture) return null;

  return getFaceUvFromTile(getTileIndexForTexture(texture), faceName);
}

export function getFallbackTextureUv(): FaceUv {
  return getFaceUvFromTile(0, "front");
}

function getFaceUvFromTile(tileIndex: number, faceName: BlockFaceName): FaceUv {
  const { u0, u1, v0, v1 } = getTileUv(tileIndex);

  if (faceName === "front" || faceName === "back" || faceName === "right" || faceName === "left") {
    // Les faces latérales de FACES sont ordonnées comme suit :
    // bottom-left, top-left, top-right, bottom-right.
    // On mappe donc la première ligne de la matrice sur les vertices du haut.
    return [u0, v1, u0, v0, u1, v0, u1, v1];
  }

  return [u0, v0, u1, v0, u1, v1, u0, v1];
}

export function applyProceduralBlockAtlasMaterial(scene: Scene, material: StandardMaterial): void {
  const width = textureTiles.length * TILE_SIZE;
  const height = TILE_SIZE;
  const texture = new DynamicTexture(
    "procedural-block-atlas",
    { width, height },
    scene,
    false,
    Texture.NEAREST_SAMPLINGMODE,
  );
  const context = texture.getContext();

  context.clearRect(0, 0, width, height);

  for (let tileIndex = 0; tileIndex < textureTiles.length; tileIndex++) {
    const tile = textureTiles[tileIndex];
    const originX = tileIndex * TILE_SIZE;

    if (!tile.texture) {
      context.fillStyle = "white";
      context.fillRect(originX, 0, TILE_SIZE, TILE_SIZE);
      continue;
    }

    for (let y = 0; y < TILE_SIZE; y++) {
      const row = tile.texture.matrix[y];

      for (let x = 0; x < TILE_SIZE; x++) {
        const color = tile.texture.palette[row[x]];

        if (!color) continue;

        context.fillStyle = rgbaToCss(color);
        context.fillRect(originX + x, y, 1, 1);
      }
    }
  }

  texture.update(false);
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  material.diffuseTexture = texture;
  material.backFaceCulling = false;
}