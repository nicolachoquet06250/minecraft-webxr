import { Image, Rectangle } from "@babylonjs/gui";
import { getBlockDefinition, type BlockFaceName, type BlockTextureDefinition, type RgbaColor } from "../blocks";
import { getBlockColor } from "../functions";
import type { BlockId } from "../types";
import { getItemDefinition } from "./index";

const TEXTURE_ICON_SIZE = 16;
const PREFERRED_ICON_FACES: BlockFaceName[] = ["front", "right", "left", "back", "top", "bottom"];
const blockTextureIconSrcByCacheKey = new Map<string, string>();

function color4ToCssRgba(color: { r: number; g: number; b: number; a: number }, alpha = color.a): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function rgbaToCss(color: RgbaColor): string {
  const [r, g, b, a] = color;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

function getTextureCacheKey(texture: BlockTextureDefinition): string {
  return `${Object.keys(texture.palette).sort().join("")}:${texture.matrix.join("|")}`;
}

function getBlockInventoryTexture(blockId: BlockId): BlockTextureDefinition | null {
  const textures = getBlockDefinition(blockId)?.textures;

  if (!textures) return null;

  for (const face of PREFERRED_ICON_FACES) {
    const texture = textures[face];

    if (texture) return texture;
  }

  return null;
}

function getTextureIconSrc(texture: BlockTextureDefinition): string {
  const cacheKey = getTextureCacheKey(texture);
  const cachedSrc = blockTextureIconSrcByCacheKey.get(cacheKey);

  if (cachedSrc) return cachedSrc;

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_ICON_SIZE;
  canvas.height = TEXTURE_ICON_SIZE;

  const context = canvas.getContext("2d");

  if (!context) {
    return "";
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, TEXTURE_ICON_SIZE, TEXTURE_ICON_SIZE);

  for (let y = 0; y < TEXTURE_ICON_SIZE; y++) {
    const row = texture.matrix[y];

    for (let x = 0; x < TEXTURE_ICON_SIZE; x++) {
      const color = texture.palette[row[x]];

      if (!color) continue;

      context.fillStyle = rgbaToCss(color);
      context.fillRect(x, y, 1, 1);
    }
  }

  const src = canvas.toDataURL("image/png");
  blockTextureIconSrcByCacheKey.set(cacheKey, src);
  return src;
}

function renderImageIcon(icon: Rectangle, src: string): void {
  icon.thickness = 0;
  icon.background = "transparent";

  const image = new Image(`${icon.name}-image`, src);
  image.width = "100%";
  image.height = "100%";
  image.stretch = Image.STRETCH_UNIFORM;
  image.isPointerBlocker = false;
  icon.addControl(image);
}

export function renderItemIconControl(icon: Rectangle, itemId: BlockId | null): void {
  icon.children.slice().forEach((child) => icon.removeControl(child));

  if (itemId === null) {
    icon.isVisible = false;
    return;
  }

  const itemDefinition = getItemDefinition(itemId);
  icon.isVisible = true;

  if (itemDefinition?.icon.type === "image") {
    renderImageIcon(icon, itemDefinition.icon.src);
    return;
  }

  const blockId = itemDefinition?.icon.type === "block-color" ? itemDefinition.icon.blockId : itemId;
  const texture = getBlockInventoryTexture(blockId);

  if (texture) {
    renderImageIcon(icon, getTextureIconSrc(texture));
    return;
  }

  const color = getBlockColor(blockId);

  icon.thickness = 1;
  icon.color = "rgba(255, 255, 255, 0.35)";
  icon.background = color4ToCssRgba(color, color.a);
}