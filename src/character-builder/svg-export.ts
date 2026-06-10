import {
  DynamicTexture,
  Matrix,
  Mesh,
  MultiMaterial,
  Ray,
  StandardMaterial,
  Vector2,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { CharacterModel } from "./types";
import {
  buildCharacter,
  getAllBodyParts,
  type BuildCharacterOptions,
} from "./character-builder";

type Vector3Update = {
  x?: number;
  y?: number;
  z?: number;
};

export type CharacterPartPose = {
  rotation?: Vector3Update;
  position?: Vector3Update;
};

export type CharacterPoseOptions = {
  parts?: Record<string, CharacterPartPose>;
  headYaw?: number;
  headPartName?: string;
};

export type CharacterSvgRenderOptions = {
  width?: number;
  height?: number;
  padding?: number;
  fov?: number;
  yaw?: number;
  pitch?: number;
  distanceFactor?: number;
  background?: string | null;
  stroke?: string;
  strokeWidth?: number;
  cellOverlap?: number;
  occlusion?: boolean;
  pose?: CharacterPoseOptions;
};

type Polygon2D = {
  points: Vector3[];
  depth: number;
  fill: string;
};

type FaceCorners = {
  p00: Vector3;
  p10: Vector3;
  p01: Vector3;
  p11: Vector3;
};

type TextureMatrixMetadata = {
  matrixWidth?: number;
  matrixHeight?: number;
  pixelScale?: number;
};

const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 512;
const DEFAULT_PADDING = 20;
const DEFAULT_FOV = 0.9;
const DEFAULT_YAW = -Math.PI / 4;
const DEFAULT_PITCH = 0.35;
const DEFAULT_DISTANCE_FACTOR = 2.6;

/**
 * Génère un SVG en perspective depuis un mesh de personnage déjà construit.
 */
export function generateCharacterPerspectiveSvg(
  characterMesh: Mesh,
  options: CharacterSvgRenderOptions = {},
): string {
  const restorePose = applyPoseForSvg(characterMesh, options.pose);

  try {
  const scene = characterMesh.getScene();
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const padding = options.padding ?? DEFAULT_PADDING;
  const fov = options.fov ?? DEFAULT_FOV;
  const yaw = options.yaw ?? DEFAULT_YAW;
  const pitch = options.pitch ?? DEFAULT_PITCH;
  const distanceFactor = options.distanceFactor ?? DEFAULT_DISTANCE_FACTOR;
  const stroke = options.stroke ?? "none";
  const strokeWidth = options.strokeWidth ?? 0;
  const cellOverlap = options.cellOverlap ?? 0.6;
  const useOcclusion = options.occlusion ?? false;

  const sourceMeshes = [characterMesh, ...characterMesh.getChildMeshes()]
    .filter((mesh): mesh is Mesh => mesh instanceof Mesh);
  const sourceMeshSet = useOcclusion ? new Set<Mesh>(sourceMeshes) : null;

  const worldFaces: Array<{ mesh: Mesh; subMeshIndex: number; corners: FaceCorners }> = [];
  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const mesh of sourceMeshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
    const indices = mesh.getIndices();

    if (!positions || !uvs || !indices || indices.length < 3 || mesh.subMeshes.length === 0) {
      continue;
    }

    const world = mesh.computeWorldMatrix(true);

    const getWorldVertex = (index: number): Vector3 => {
      const offset = index * 3;
      const local = new Vector3(positions[offset], positions[offset + 1], positions[offset + 2]);
      const worldVertex = Vector3.TransformCoordinates(local, world);

      min = Vector3.Minimize(min, worldVertex);
      max = Vector3.Maximize(max, worldVertex);
      return worldVertex;
    };

    for (let subMeshIndex = 0; subMeshIndex < mesh.subMeshes.length; subMeshIndex++) {
      const subMesh = mesh.subMeshes[subMeshIndex];
      const start = subMesh.indexStart;
      const end = start + subMesh.indexCount;
      const uniqueIndices = [...new Set(indices.slice(start, end))];

      if (uniqueIndices.length < 4) {
        continue;
      }

      const vertices = uniqueIndices.map((index) => ({
        world: getWorldVertex(index),
        uv: new Vector2(uvs[index * 2], uvs[index * 2 + 1]),
      }));

      const corners = resolveFaceCorners(vertices);
      if (!corners) {
        continue;
      }

      worldFaces.push({
        mesh,
        subMeshIndex,
        corners,
      });
    }
  }

  if (worldFaces.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
  }

  const center = min.add(max).scale(0.5);
  const size = max.subtract(min);
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

  const cameraOffset = new Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ).scale(radius * distanceFactor);

  const cameraPosition = center.add(cameraOffset);
  const view = Matrix.LookAtLH(cameraPosition, center, Vector3.Up());
  const projection = Matrix.PerspectiveFovLH(fov, width / height, 0.01, radius * 100);
  const viewProjection = view.multiply(projection);

  const lightDirection = new Vector3(0.35, 0.8, -0.45).normalize();
  const polygons: Polygon2D[] = [];

  for (const face of worldFaces) {
    const material = getSubMaterial(face.mesh, face.subMeshIndex);
    if (!material) {
      continue;
    }

    const texture = material.diffuseTexture;
    const textureInfo = getTextureGrid(texture);

    if (!textureInfo) {
      continue;
    }

    const faceNormal = computeFaceNormal(face.corners);
    if (faceNormal.lengthSquared() < 1e-8) {
      continue;
    }

    faceNormal.normalize();
    const faceCenter = bilinearFacePoint(face.corners, 0.5, 0.5);

    // Oriente explicitement la normale vers l'extérieur du mesh.
    const meshCenter = face.mesh.getBoundingInfo().boundingBox.centerWorld;
    const outward = faceCenter.subtract(meshCenter);
    if (Vector3.Dot(faceNormal, outward) < 0) {
      faceNormal.scaleInPlace(-1);
    }

    const toCamera = cameraPosition.subtract(faceCenter).normalize();

    // Ignore les faces dos caméra.
    if (Vector3.Dot(faceNormal, toCamera) <= 0) {
      continue;
    }

    if (
      useOcclusion
      && sourceMeshSet
      && !isSurfacePointVisibleFromCamera(scene, cameraPosition, faceCenter, face.mesh, sourceMeshSet)
    ) {
      continue;
    }

    const diffuse = Math.max(0.1, Vector3.Dot(faceNormal, lightDirection));
    const lighting = 0.35 + diffuse * 0.65;

    for (let ty = 0; ty < textureInfo.gridHeight; ty++) {
      for (let tx = 0; tx < textureInfo.gridWidth; tx++) {
        const u0 = tx / textureInfo.gridWidth;
        const v0 = ty / textureInfo.gridHeight;
        const u1 = (tx + 1) / textureInfo.gridWidth;
        const v1 = (ty + 1) / textureInfo.gridHeight;

        const w00 = bilinearFacePoint(face.corners, u0, v0);
        const w10 = bilinearFacePoint(face.corners, u1, v0);
        const w11 = bilinearFacePoint(face.corners, u1, v1);
        const w01 = bilinearFacePoint(face.corners, u0, v1);

        const p00 = projectToScreen(w00, viewProjection, width, height);
        const p10 = projectToScreen(w10, viewProjection, width, height);
        const p11 = projectToScreen(w11, viewProjection, width, height);
        const p01 = projectToScreen(w01, viewProjection, width, height);

        const center3D = w00.add(w10).add(w11).add(w01).scale(0.25);

        const viewCenter = Vector3.TransformCoordinates(center3D, view);
        const baseColor = sampleTextureCell(textureInfo.texture, tx, ty, textureInfo.gridWidth, textureInfo.gridHeight);
        const shaded = {
          r: Math.round(baseColor.r * lighting),
          g: Math.round(baseColor.g * lighting),
          b: Math.round(baseColor.b * lighting),
        };

        polygons.push({
          points: [p00, p10, p11, p01],
          depth: viewCenter.z,
          fill: `rgb(${shaded.r},${shaded.g},${shaded.b})`,
        });
      }
    }
  }

  if (polygons.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
  }

  polygons.sort((a, b) => b.depth - a.depth);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const polygon of polygons) {
    for (const point of polygon.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
  }

  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight);
  const offsetX = (width - contentWidth * scale) * 0.5;
  const offsetY = (height - contentHeight * scale) * 0.5;

  const polygonElements = polygons.map((polygon) => {
    const mappedPoints = polygon.points
      .map((point) => {
        const x = (point.x - minX) * scale + offsetX;
        const y = (point.y - minY) * scale + offsetY;
        return new Vector2(x, y);
      })
      ;

    const expandedPoints = expandPolygon2D(mappedPoints, cellOverlap);
    const points = expandedPoints
      .map((point) => `${formatNumber(point.x)},${formatNumber(point.y)}`)
      .join(" ");

    return `<polygon points="${points}" fill="${polygon.fill}" stroke="${stroke}" stroke-width="${formatNumber(strokeWidth)}" stroke-linejoin="round"/>`;
  });

  const background = options.background === null
    ? ""
    : `<rect width="100%" height="100%" fill="${options.background ?? "#f8fafc"}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
    background,
    ...polygonElements,
    "</svg>",
  ].join("\n");
  } finally {
    restorePose();
  }
}

/**
 * Construit un personnage puis retourne son rendu SVG en perspective.
 */
export function buildCharacterPerspectiveSvg(
  scene: Scene,
  model: CharacterModel,
  position: Vector3,
  buildOptions?: BuildCharacterOptions,
  svgOptions?: CharacterSvgRenderOptions,
): string {
  const mesh = buildCharacter(scene, model, position, buildOptions);

  try {
    return generateCharacterPerspectiveSvg(mesh, svgOptions);
  } finally {
    mesh.dispose(false, true);
  }
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function resolveFaceCorners(vertices: Array<{ world: Vector3; uv: Vector2 }>): FaceCorners | null {
  const p00 = nearestByUv(vertices, 0, 0);
  const p10 = nearestByUv(vertices, 1, 0);
  const p01 = nearestByUv(vertices, 0, 1);
  const p11 = nearestByUv(vertices, 1, 1);

  if (!p00 || !p10 || !p01 || !p11) {
    return null;
  }

  return { p00, p10, p01, p11 };
}

function nearestByUv(
  vertices: Array<{ world: Vector3; uv: Vector2 }>,
  targetU: number,
  targetV: number,
): Vector3 | null {
  let best: Vector3 | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const vertex of vertices) {
    const du = vertex.uv.x - targetU;
    const dv = vertex.uv.y - targetV;
    const distance = du * du + dv * dv;

    if (distance < bestDistance) {
      bestDistance = distance;
      best = vertex.world;
    }
  }

  return best;
}

function bilinearFacePoint(corners: FaceCorners, u: number, v: number): Vector3 {
  const top = Vector3.Lerp(corners.p00, corners.p10, u);
  const bottom = Vector3.Lerp(corners.p01, corners.p11, u);
  return Vector3.Lerp(top, bottom, v);
}

function projectToScreen(point: Vector3, viewProjection: Matrix, width: number, height: number): Vector3 {
  const projected = Vector3.TransformCoordinates(point, viewProjection);
  return new Vector3(
    (projected.x * 0.5 + 0.5) * width,
    (1 - (projected.y * 0.5 + 0.5)) * height,
    projected.z,
  );
}

function computeFaceNormal(corners: FaceCorners): Vector3 {
  return Vector3.Cross(
    corners.p10.subtract(corners.p00),
    corners.p01.subtract(corners.p00),
  );
}

function getSubMaterial(mesh: Mesh, subMeshIndex: number): StandardMaterial | null {
  const multi = mesh.material;

  if (!(multi instanceof MultiMaterial)) {
    return mesh.material instanceof StandardMaterial ? mesh.material : null;
  }

  const subMesh = mesh.subMeshes[subMeshIndex];
  if (!subMesh) return null;

  const material = multi.subMaterials[subMesh.materialIndex];
  return material instanceof StandardMaterial ? material : null;
}

function getTextureGrid(texture: unknown): {
  texture: DynamicTexture;
  gridWidth: number;
  gridHeight: number;
} | null {
  if (!(texture instanceof DynamicTexture)) {
    return null;
  }

  const size = texture.getSize();
  const metadata = (texture.metadata ?? {}) as TextureMatrixMetadata;
  const matrixWidth = metadata.matrixWidth ?? Math.max(1, Math.round(size.width / Math.max(1, metadata.pixelScale ?? 16)));
  const matrixHeight = metadata.matrixHeight ?? Math.max(1, Math.round(size.height / Math.max(1, metadata.pixelScale ?? 16)));

  return {
    texture,
    gridWidth: Math.max(1, matrixWidth),
    gridHeight: Math.max(1, matrixHeight),
  };
}

function sampleTextureCell(
  texture: DynamicTexture,
  cellX: number,
  cellY: number,
  gridWidth: number,
  gridHeight: number,
): { r: number; g: number; b: number } {
  const ctx = texture.getContext();
  const size = texture.getSize();

  const sampleU = clamp01((cellX + 0.5) / gridWidth);
  const sampleV = clamp01((cellY + 0.5) / gridHeight);
  const x = Math.min(size.width - 1, Math.max(0, Math.round(sampleU * (size.width - 1))));
  const y = Math.min(size.height - 1, Math.max(0, Math.round((1 - sampleV) * (size.height - 1))));
  const pixel = ctx.getImageData(x, y, 1, 1).data;

  return {
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function applyPoseForSvg(
  characterMesh: Mesh,
  pose?: CharacterPoseOptions,
): () => void {
  if (!pose) {
    return () => {};
  }

  const bodyParts = getAllBodyParts(characterMesh);
  const snapshots = new Map<Mesh, { position: Vector3; rotation: Vector3 }>();

  const snapshot = (part: Mesh): void => {
    if (snapshots.has(part)) {
      return;
    }

    snapshots.set(part, {
      position: part.position.clone(),
      rotation: part.rotation.clone(),
    });
  };

  const applyVectorUpdate = (target: Vector3, update?: Vector3Update): void => {
    if (!update) {
      return;
    }

    if (update.x !== undefined) target.x = update.x;
    if (update.y !== undefined) target.y = update.y;
    if (update.z !== undefined) target.z = update.z;
  };

  if (pose.parts) {
    for (const [partName, partPose] of Object.entries(pose.parts)) {
      const resolvedPartName = resolvePosePartName(partName);
      const part = bodyParts.get(resolvedPartName) ?? bodyParts.get(partName);
      if (!part) {
        continue;
      }

      snapshot(part);
      applyVectorUpdate(part.rotation, partPose.rotation);
      applyVectorUpdate(part.position, partPose.position);
    }
  }

  if (pose.headYaw !== undefined) {
    const head = bodyParts.get(pose.headPartName ?? "head");
    if (head) {
      snapshot(head);
      head.rotation.y = pose.headYaw;
    }
  }

  characterMesh.computeWorldMatrix(true);
  for (const part of bodyParts.values()) {
    part.computeWorldMatrix(true);
  }

  return () => {
    for (const [part, state] of snapshots) {
      part.position.copyFrom(state.position);
      part.rotation.copyFrom(state.rotation);
      part.computeWorldMatrix(true);
    }

    characterMesh.computeWorldMatrix(true);
  };
}

function resolvePosePartName(partName: string): string {
  switch (partName) {
    case "rightArm":
      return "leftArm";
    case "leftArm":
      return "rightArm";
    default:
      return partName;
  }
}

function expandPolygon2D(points: Vector2[], overlap: number): Vector2[] {
  if (overlap <= 0 || points.length === 0) {
    return points;
  }

  let cx = 0;
  let cy = 0;

  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }

  cx /= points.length;
  cy /= points.length;

  return points.map((point) => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const length = Math.hypot(dx, dy);

    if (length < 1e-5) {
      return point.clone();
    }

    const nx = dx / length;
    const ny = dy / length;

    return new Vector2(point.x + nx * overlap, point.y + ny * overlap);
  });
}

function isSurfacePointVisibleFromCamera(
  scene: Scene,
  cameraPosition: Vector3,
  point: Vector3,
  ownerMesh: Mesh,
  sourceMeshSet: Set<Mesh>,
): boolean {
  const direction = point.subtract(cameraPosition);
  const distance = direction.length();

  if (distance <= 1e-5) {
    return true;
  }

  const ray = new Ray(
    cameraPosition,
    direction.scale(1 / distance),
    Math.max(0, distance - 1e-4),
  );

  const pick = scene.pickWithRay(
    ray,
    (mesh) => sourceMeshSet.has(mesh as Mesh),
    true,
  );

  if (!pick?.hit || pick.distance === undefined) {
    return true;
  }

  if (pick.pickedMesh !== ownerMesh) {
    return false;
  }

  return pick.distance >= distance - 0.02;
}
