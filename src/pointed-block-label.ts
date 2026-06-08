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

type VisibleFaceName = "left" | "right" | "bottom" | "top" | "back" | "front";

type EdgeName =
  | "bottom-back"
  | "bottom-front"
  | "bottom-left"
  | "bottom-right"
  | "top-back"
  | "top-front"
  | "top-left"
  | "top-right"
  | "back-left"
  | "back-right"
  | "front-left"
  | "front-right";

export function initializePointedBlockLabel(scene: Scene): PointedBlockLabelControls {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("pointed-block-label-ui", true, scene);
  const isMobile = isMobileMode();
  let highlightedBlock: TargetBlock | null = null;
  let highlightedEdgesKey: string | null = null;
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
    highlightedEdgesKey = null;

    if (highlightEdges) {
      highlightEdges.dispose();
      highlightEdges = null;
    }
  };

  const updateHighlight = (target: TargetBlock): void => {
    const visibleFaces = getVisibleFaces(scene, target);
    const definition = getBlockDefinition(target.block);
    const highlightColor = getHighContrastColor(definition?.color ?? [0, 0, 0, 1]);
    const nextEdgesKey = `${visibleFaces.join("|")}:${highlightColor.toHexString()}`;

    if (highlightedBlock && isSameTarget(highlightedBlock, target) && highlightedEdgesKey === nextEdgesKey) {
      return;
    }

    highlightedBlock = target;
    highlightedEdgesKey = nextEdgesKey;

    if (highlightEdges) {
      highlightEdges.dispose();
    }

    highlightEdges = createBlockHighlightEdges(scene, target, visibleFaces, highlightColor);
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

function createBlockHighlightEdges(
  scene: Scene,
  target: TargetBlock,
  visibleFaces: readonly VisibleFaceName[],
  color: Color3,
): LinesMesh {
  const minX = target.x - HIGHLIGHT_OFFSET;
  const minY = target.y - HIGHLIGHT_OFFSET;
  const minZ = target.z - HIGHLIGHT_OFFSET;
  const maxX = target.x + 1 + HIGHLIGHT_OFFSET;
  const maxY = target.y + 1 + HIGHLIGHT_OFFSET;
  const maxZ = target.z + 1 + HIGHLIGHT_OFFSET;

  const points: Record<string, Vector3> = {
    p000: new Vector3(minX, minY, minZ),
    p001: new Vector3(minX, minY, maxZ),
    p010: new Vector3(minX, maxY, minZ),
    p011: new Vector3(minX, maxY, maxZ),
    p100: new Vector3(maxX, minY, minZ),
    p101: new Vector3(maxX, minY, maxZ),
    p110: new Vector3(maxX, maxY, minZ),
    p111: new Vector3(maxX, maxY, maxZ),
  };

  const edgePoints: Record<EdgeName, [Vector3, Vector3]> = {
    "bottom-back": [points.p000, points.p100],
    "bottom-front": [points.p001, points.p101],
    "bottom-left": [points.p000, points.p001],
    "bottom-right": [points.p100, points.p101],
    "top-back": [points.p010, points.p110],
    "top-front": [points.p011, points.p111],
    "top-left": [points.p010, points.p011],
    "top-right": [points.p110, points.p111],
    "back-left": [points.p000, points.p010],
    "back-right": [points.p100, points.p110],
    "front-left": [points.p001, points.p011],
    "front-right": [points.p101, points.p111],
  };

  const visibleEdgeNames = getVisibleEdgeNames(visibleFaces);
  const lines = MeshBuilder.CreateLineSystem(
    `pointed-block-highlight-${target.x}-${target.y}-${target.z}`,
    {
      lines: visibleEdgeNames.map((edgeName) => edgePoints[edgeName]),
    },
    scene,
  );

  lines.color = color;
  lines.isPickable = false;
  lines.alwaysSelectAsActiveMesh = true;
  lines.renderingGroupId = 1;

  return lines;
}

function getVisibleFaces(scene: Scene, target: TargetBlock): VisibleFaceName[] {
  const cameraPosition = scene.activeCamera?.globalPosition ?? scene.activeCamera?.position;
  const center = new Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5);

  if (!cameraPosition) {
    return ["front", "top", "right"];
  }

  const delta = cameraPosition.subtract(center);
  const visibleFaces: VisibleFaceName[] = [];

  if (delta.x < 0) visibleFaces.push("left");
  if (delta.x > 0) visibleFaces.push("right");
  if (delta.y < 0) visibleFaces.push("bottom");
  if (delta.y > 0) visibleFaces.push("top");
  if (delta.z < 0) visibleFaces.push("back");
  if (delta.z > 0) visibleFaces.push("front");

  return visibleFaces;
}

function getVisibleEdgeNames(visibleFaces: readonly VisibleFaceName[]): EdgeName[] {
  const edges = new Set<EdgeName>();

  for (const face of visibleFaces) {
    for (const edge of getFaceEdges(face)) {
      edges.add(edge);
    }
  }

  return [...edges];
}

function getFaceEdges(face: VisibleFaceName): readonly EdgeName[] {
  switch (face) {
    case "left":
      return ["bottom-left", "top-left", "back-left", "front-left"];
    case "right":
      return ["bottom-right", "top-right", "back-right", "front-right"];
    case "bottom":
      return ["bottom-back", "bottom-front", "bottom-left", "bottom-right"];
    case "top":
      return ["top-back", "top-front", "top-left", "top-right"];
    case "back":
      return ["bottom-back", "top-back", "back-left", "back-right"];
    case "front":
      return ["bottom-front", "top-front", "front-left", "front-right"];
  }
}

function getHighContrastColor(color: readonly [number, number, number, number]): Color3 {
  const [r, g, b] = color;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.45 ? new Color3(0.02, 0.02, 0.02) : new Color3(1, 1, 1);
}

function isSameTarget(a: TargetBlock, b: TargetBlock): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.block === b.block;
}
