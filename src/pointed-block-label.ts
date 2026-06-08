import { Color3, LinesMesh, MeshBuilder, Ray, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { getBlockDefinition, isTransparentForMeshingDefinition } from "./blocks";
import { EYE_HEIGHT } from "./constants";
import { getWorldBlock } from "./functions";
import { isMobileMode } from "./mobile-controls";
import { BlockId, type PlayerPhysics, type WorldChunks } from "./types";

const POINTED_BLOCK_REACH = 3;
const CONTROLLER_BLOCK_REACH = 8;
const POINTED_BLOCK_STEP = 0.1;
const HIGHLIGHT_OFFSET = 0.002;
const FACE_VISIBILITY_EPSILON = 0.01;

const VR_LABEL_WIDTH = 1.45;
const VR_LABEL_HEIGHT = 0.24;
const VR_LABEL_DISTANCE = 2.05;
const VR_LABEL_VERTICAL_OFFSET = -0.42;

type PointedBlockLabelParams = {
  readonly scene: Scene;
  readonly player: PlayerPhysics;
  readonly worldChunks: WorldChunks;
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly isVisible: boolean;
  readonly isVR?: boolean;
  readonly controllerRays?: readonly (Ray | null)[];
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

type TargetBlockHit = TargetBlock & {
  readonly distance: number;
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

type FaceDefinition = {
  readonly name: VisibleFaceName;
  readonly normal: Vector3;
  readonly center: (target: TargetBlock) => Vector3;
  readonly neighbor: (target: TargetBlock) => readonly [number, number, number];
  readonly edges: readonly EdgeName[];
};

const FACE_DEFINITIONS: readonly FaceDefinition[] = [
  {
    name: "left",
    normal: new Vector3(-1, 0, 0),
    center: (target) => new Vector3(target.x, target.y + 0.5, target.z + 0.5),
    neighbor: (target) => [target.x - 1, target.y, target.z],
    edges: ["bottom-left", "top-left", "back-left", "front-left"],
  },
  {
    name: "right",
    normal: new Vector3(1, 0, 0),
    center: (target) => new Vector3(target.x + 1, target.y + 0.5, target.z + 0.5),
    neighbor: (target) => [target.x + 1, target.y, target.z],
    edges: ["bottom-right", "top-right", "back-right", "front-right"],
  },
  {
    name: "bottom",
    normal: new Vector3(0, -1, 0),
    center: (target) => new Vector3(target.x + 0.5, target.y, target.z + 0.5),
    neighbor: (target) => [target.x, target.y - 1, target.z],
    edges: ["bottom-back", "bottom-front", "bottom-left", "bottom-right"],
  },
  {
    name: "top",
    normal: new Vector3(0, 1, 0),
    center: (target) => new Vector3(target.x + 0.5, target.y + 1, target.z + 0.5),
    neighbor: (target) => [target.x, target.y + 1, target.z],
    edges: ["top-back", "top-front", "top-left", "top-right"],
  },
  {
    name: "back",
    normal: new Vector3(0, 0, -1),
    center: (target) => new Vector3(target.x + 0.5, target.y + 0.5, target.z),
    neighbor: (target) => [target.x, target.y, target.z - 1],
    edges: ["bottom-back", "top-back", "back-left", "back-right"],
  },
  {
    name: "front",
    normal: new Vector3(0, 0, 1),
    center: (target) => new Vector3(target.x + 0.5, target.y + 0.5, target.z + 1),
    neighbor: (target) => [target.x, target.y, target.z + 1],
    edges: ["bottom-front", "top-front", "front-left", "front-right"],
  },
];

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
  container.top = isMobile ? "-80px" : "-90px";
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

  const vrLabelPlane = MeshBuilder.CreatePlane(
    "vr-pointed-block-label-plane",
    {
      width: VR_LABEL_WIDTH,
      height: VR_LABEL_HEIGHT,
    },
    scene,
  );
  vrLabelPlane.isPickable = false;
  vrLabelPlane.isVisible = false;
  vrLabelPlane.alwaysSelectAsActiveMesh = true;

  const vrUi = AdvancedDynamicTexture.CreateForMesh(vrLabelPlane, 1024, 256, false);
  const vrContainer = new Rectangle("vr-pointed-block-label-container");
  vrContainer.width = 0.96;
  vrContainer.height = 0.82;
  vrContainer.thickness = 2;
  vrContainer.cornerRadius = 16;
  vrContainer.color = "rgba(255, 255, 255, 0.28)";
  vrContainer.background = "rgba(0, 0, 0, 0.58)";
  vrContainer.isPointerBlocker = false;

  const vrText = new TextBlock("vr-pointed-block-label-text");
  vrText.color = "white";
  vrText.fontSize = 44;
  vrText.fontWeight = "bold";
  vrText.text = "";
  vrText.shadowBlur = 6;
  vrText.shadowColor = "black";
  vrText.isPointerBlocker = false;

  vrContainer.addControl(vrText);
  vrUi.addControl(vrContainer);

  const clearTarget = (): void => {
    container.isVisible = false;
    text.text = "";
    vrLabelPlane.isVisible = false;
    vrText.text = "";
    highlightedBlock = null;
    highlightedEdgesKey = null;

    if (highlightEdges) {
      highlightEdges.dispose();
      highlightEdges = null;
    }
  };

  const updateHighlight = (params: PointedBlockLabelParams, target: TargetBlock): void => {
    const visibleFaces = getCameraVisibleFaces(params, target);

    if (visibleFaces.length === 0) {
      highlightedBlock = null;
      highlightedEdgesKey = null;

      if (highlightEdges) {
        highlightEdges.dispose();
        highlightEdges = null;
      }

      return;
    }

    const definition = getBlockDefinition(target.block);
    const highlightColor = getHighContrastColor(definition?.color ?? [0, 0, 0, 1]);
    const nextEdgesKey = `${visibleFaces.map((face) => face.name).join("|")}:${highlightColor.toHexString()}`;

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

  const updateVRLabelPosition = (): void => {
    const activeCamera = scene.activeCamera;

    if (!activeCamera) {
      vrLabelPlane.isVisible = false;
      return;
    }

    if (vrLabelPlane.parent !== activeCamera) {
      vrLabelPlane.parent = activeCamera;
    }

    vrLabelPlane.position.set(0, VR_LABEL_VERTICAL_OFFSET, VR_LABEL_DISTANCE);
    vrLabelPlane.rotation.set(0, 0, 0);
  };

  return {
    update(params) {
      if (!params.isVisible) {
        clearTarget();
        return;
      }

      const isVR = params.isVR === true;
      const target = isVR
        ? findClosestControllerPointedBlock(params)
        : findPointedBlock(params);

      if (!target) {
        clearTarget();
        return;
      }

      const label = getBlockLabel(target);

      if (isVR) {
        container.isVisible = false;
        text.text = "";
        vrText.text = label;
        updateVRLabelPosition();
        vrLabelPlane.isVisible = true;
      } else {
        vrLabelPlane.isVisible = false;
        vrText.text = "";
        text.text = label;
        container.isVisible = true;
      }

      updateHighlight(params, target);
    },
  };
}

function getBlockLabel(target: TargetBlock): string {
  const definition = getBlockDefinition(target.block);

  if (!definition) {
    const fallbackName = BlockId[target.block] ?? `Block ${target.block}`;
    return `${fallbackName} / ${fallbackName}`;
  }

  return `${definition.name} / ${definition.frenchName}`;
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

function findClosestControllerPointedBlock(params: PointedBlockLabelParams): TargetBlock | null {
  let closestHit: TargetBlockHit | null = null;

  for (const ray of params.controllerRays ?? []) {
    const hit = ray ? findPointedBlockFromRay(params, ray) : null;

    if (!hit) {
      continue;
    }

    if (!closestHit || hit.distance < closestHit.distance) {
      closestHit = hit;
    }
  }

  return closestHit;
}

function findPointedBlockFromRay(params: PointedBlockLabelParams, ray: Ray): TargetBlockHit | null {
  const { worldChunks, sizeX, sizeY, sizeZ } = params;
  const direction = ray.direction.normalize();
  const maxDistance = getRayReach(ray);

  for (let distance = POINTED_BLOCK_STEP; distance <= maxDistance; distance += POINTED_BLOCK_STEP) {
    const point = ray.origin.add(direction.scale(distance));
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);
    const block = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z);

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return { x, y, z, block, distance };
    }
  }

  return null;
}

function getRayReach(ray: Ray): number {
  return Number.isFinite(ray.length) && ray.length > 0
    ? Math.min(ray.length, CONTROLLER_BLOCK_REACH)
    : CONTROLLER_BLOCK_REACH;
}

function createBlockHighlightEdges(
  scene: Scene,
  target: TargetBlock,
  visibleFaces: readonly FaceDefinition[],
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

function getCameraVisibleFaces(params: PointedBlockLabelParams, target: TargetBlock): FaceDefinition[] {
  const cameraPosition = params.scene.activeCamera?.globalPosition ?? params.scene.activeCamera?.position;

  if (!cameraPosition) {
    return [];
  }

  return FACE_DEFINITIONS.filter((face) => {
    if (!isFaceExposed(params, target, face)) {
      return false;
    }

    const faceCenter = face.center(target);
    const toCamera = cameraPosition.subtract(faceCenter);

    if (Vector3.Dot(face.normal, toCamera) <= 0) {
      return false;
    }

    return isFaceVisibleFromCamera(params, target, cameraPosition, faceCenter);
  });
}

function isFaceExposed(params: PointedBlockLabelParams, target: TargetBlock, face: FaceDefinition): boolean {
  const [x, y, z] = face.neighbor(target);
  const neighbor = getWorldBlock(params.worldChunks, params.sizeX, params.sizeY, params.sizeZ, x, y, z);

  return isTransparentForMeshingDefinition(neighbor);
}

function isFaceVisibleFromCamera(
  params: PointedBlockLabelParams,
  target: TargetBlock,
  cameraPosition: Vector3,
  faceCenter: Vector3,
): boolean {
  const direction = faceCenter.subtract(cameraPosition);
  const distanceToFace = direction.length();

  if (distanceToFace <= 0) {
    return true;
  }

  direction.normalize();

  for (let distance = FACE_VISIBILITY_EPSILON; distance < distanceToFace - FACE_VISIBILITY_EPSILON; distance += POINTED_BLOCK_STEP) {
    const point = cameraPosition.add(direction.scale(distance));
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    const z = Math.floor(point.z);

    if (x === target.x && y === target.y && z === target.z) {
      return true;
    }

    const block = getWorldBlock(params.worldChunks, params.sizeX, params.sizeY, params.sizeZ, x, y, z);

    if (block !== BlockId.Air && block !== BlockId.Water) {
      return false;
    }
  }

  return true;
}

function getVisibleEdgeNames(visibleFaces: readonly FaceDefinition[]): EdgeName[] {
  const edges = new Set<EdgeName>();

  for (const face of visibleFaces) {
    for (const edge of face.edges) {
      edges.add(edge);
    }
  }

  return [...edges];
}

function getHighContrastColor(color: readonly [number, number, number, number]): Color3 {
  const [r, g, b] = color;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luminance > 0.45 ? new Color3(0.02, 0.02, 0.02) : new Color3(1, 1, 1);
}

function isSameTarget(a: TargetBlock, b: TargetBlock): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z && a.block === b.block;
}
