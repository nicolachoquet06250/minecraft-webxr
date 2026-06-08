import { Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { getBlockDefinition } from "./blocks";
import { EYE_HEIGHT } from "./constants";
import { getWorldBlock } from "./functions";
import { isMobileMode } from "./mobile-controls";
import { BlockId, type PlayerPhysics, type WorldChunks } from "./types";

const POINTED_BLOCK_REACH = 3;
const POINTED_BLOCK_STEP = 0.1;

type PointedBlockLabelParams = {
  readonly scene: Scene;
  readonly player: PlayerPhysics;
  readonly worldChunks: WorldChunks;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly isVisible: boolean;
};

type PointedBlockLabelControls = {
  readonly update: (params: PointedBlockLabelParams) => void;
};

type TargetBlock = {
  readonly block: BlockId;
};

export function initializePointedBlockLabel(scene: Scene): PointedBlockLabelControls {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("pointed-block-label-ui", true, scene);
  const isMobile = isMobileMode();

  if (isMobile) {
    ui.renderAtIdealSize = true;
    ui.idealWidth = 1280;
    ui.idealHeight = 720;
  }

  const container = new Rectangle("pointed-block-label-container");
  container.width = isMobile ? "520px" : "420px";
  container.height = isMobile ? "30px" : "26px";
  container.thickness = 1;
  container.cornerRadius = 6;
  container.color = "rgba(255, 255, 255, 0.22)";
  container.background = "rgba(0, 0, 0, 0.46)";
  container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  container.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  container.top = isMobile ? "-2px" : "-4px";
  container.isPointerBlocker = false;
  container.isVisible = false;

  const text = new TextBlock("pointed-block-label-text");
  text.color = "white";
  text.fontSize = isMobile ? 18 : 15;
  text.fontWeight = "bold";
  text.text = "";
  text.shadowBlur = 3;
  text.shadowColor = "black";
  text.isPointerBlocker = false;

  container.addControl(text);
  ui.addControl(container);

  return {
    update(params) {
      if (!params.isVisible) {
        container.isVisible = false;
        text.text = "";
        return;
      }

      const target = findPointedBlock(params);

      if (!target) {
        container.isVisible = false;
        text.text = "";
        return;
      }

      const definition = getBlockDefinition(target.block);

      if (!definition) {
        const fallbackName = BlockId[target.block] ?? `Block ${target.block}`;
        text.text = `${fallbackName} / ${fallbackName}`;
        container.isVisible = true;
        return;
      }

      text.text = `${definition.name} / ${definition.frenchName}`;
      container.isVisible = true;
    },
  };
}

function findPointedBlock(params: PointedBlockLabelParams): TargetBlock | null {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ } = params;
  const ray = scene.createPickingRay(
    scene.getEngine().getRenderWidth() / 2,
    scene.getEngine().getRenderHeight() / 2,
    null,
    scene.activeCamera,
  );
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();

  for (let distance = POINTED_BLOCK_STEP; distance <= POINTED_BLOCK_REACH; distance += POINTED_BLOCK_STEP) {
    const point = start.add(direction.scale(distance));
    const block = getWorldBlock(
      worldChunks,
      sizeX,
      sizeY,
      sizeZ,
      Math.floor(point.x),
      Math.floor(point.y),
      Math.floor(point.z),
    );

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { block };
    }
  }

  return null;
}
