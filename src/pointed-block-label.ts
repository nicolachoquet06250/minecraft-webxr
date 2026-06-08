import { Color3, LinesMesh, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { getBlockDefinition } from "./blocks";
import { EYE_HEIGHT } from "./constants";
import { getWorldBlock } from "./functions";
import { isMobileMode } from "./mobile-controls";
import { BlockId, type PlayerPhysics, type WorldChunks } from "./types";

const POINTED_BLOCK_REACH = 3;
const POINTED_BLOCK_STEP = 0.1;
const HIGHLIGHT_OFFSET = 0.002;

const HIGHLIGHT_COLOR = new Color3(0, 0, 0);

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
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly block: BlockId;
};

export function initializePointedBlockLabel(scene: Scene): PointedBlockLabelControls {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("pointed-block-label-ui", true, scene);
  const isMobile = isMobileMode();
  let highlightedBlock: TargetBlock | null = null;
  let highlightEdges: LinesMesh | null = null;

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

  const clearTarget = (): void => {
    container.isVisible = false;
    text.text = "";
    highlightedBlock = null;

    if (highlightEdges) {
      highlightEdges.dispose();
      highlightEdges = null;
    }
  };

  const updateHighlight = (target: TargetBlock): void => {
    if (highlightedBlock && isSameTarget(highlightedBlock, target)) {
      return;
    }

    highlightedBlock = target;

    if (highlightEdges) {
      highlightEdges.dispose();
    }

    highlightEdges = createBlockHighlightEdges(scene, target);
  };

  return {
    update(params) {
      if (!params.isVisible) {
        clearTarget();
        return;
      }

      const target = findPointedBlock(params);

      if (!target) {
        clearTarget();
        return;
      }

      const definition = getBlockDefinition(target.block);

      if (!definition) {
        const fallbackName = BlockId[target.block] ?? `Block ${target.block}`;
        text.text = `${fallbackName} / ${fallbackName}`;
      } else {
        text.text = `${definition.name} / ${definition.frenchName}`;
      }

      container.isVisible = true;
      updateHighlight(target);
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
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);
    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z);

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { x, y, z, block };
    }
  }

  return null;
}

function createBlockHighlightEdges(scene: Scene, target: TargetBlock): LinesMesh {
  const minX = target.x - HIGHLIGHT_OFFSET;
  const minY = target.y - HIGHLIGHT_OFFSET;
  const minZ = target.z - HIGHLIGHT_OFFSET;
  const maxX = target.x + 1 + HIGHLIGHT_OFFSET;
  const maxY = target.y + 1 + HIGHLIGHT_OFFSET;
  const maxZ = target.z + 1 + HIGHLIGHT_OFFSET;

  const p000 = new Vector3(minX, minY, minZ);
  const p001 = new Vector3(minX, minY, maxZ);
  const p010 = new Vector3(minX, maxY, minZ);
  const p011 = new Vector3(minX, maxY, maxZ);
  const p100 = new Vector3(maxX, minY, minZ);
  const p101 = new Vector3(maxX, minY, maxZ);
  const p110 = new Vector3(maxX, maxY, minZ);
  const p111 = new Vector3(maxX, maxY, maxZ);

  const lines = MeshBuilder.CreateLineSystem(
    `pointed-block-highlight-${target.x}-${target.y}-${target.z}`,
    {
      lines: [
        [p000, p100],
        [p100, p101],
        [p101, p001],
        [p001, p000],
        [p010, p110],
        [p110, p111],
        [p111, p011],
        [p011, p010],
        [p000, p010],
        [p100, p110],
        [p101, p111],
        [p001, p011],
      ],
    },
    scene,
  );

  lines.color = HIGHLIGHT_COLOR;
  lines.isPickable = false;
  lines.alwaysSelectAsActiveMesh = true;
  lines.renderingGroupId = 1;

  return lines;
}

function isSameTarget(a: TargetBlock, b: TargetBlock): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.block === b.block;
}
