import { Image, Rectangle } from "@babylonjs/gui";
import { getBlockColor } from "../functions";
import type { BlockId } from "../types";
import { getItemDefinition } from "./index";

function color4ToCssRgba(color: { r: number; g: number; b: number; a: number }, alpha = color.a): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
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
    icon.thickness = 0;
    icon.background = "transparent";

    const image = new Image(`${icon.name}-image`, itemDefinition.icon.src);
    image.width = "100%";
    image.height = "100%";
    image.stretch = Image.STRETCH_UNIFORM;
    image.isPointerBlocker = false;
    icon.addControl(image);
    return;
  }

  const blockId = itemDefinition?.icon.type === "block-color" ? itemDefinition.icon.blockId : itemId;
  const color = getBlockColor(blockId);

  icon.thickness = 1;
  icon.color = "rgba(255, 255, 255, 0.35)";
  icon.background = color4ToCssRgba(color, color.a);
}
