import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";
import { getAuthSession } from "./auth-client";
import { createTextureFromMatrix, getAllBodyParts, type TextureMatrix } from "~/character-builder";

const DEFAULT_CENTRAL_AUTH_API_BASE_URL = "https://central.voxicraft.fr/api";
const MATRIX_COLOR_ENDPOINT_SUFFIX = "/matrix-color";
const NAMEPLATE_WIDTH = 1.35;
const NAMEPLATE_HEIGHT = 0.34;
const NAMEPLATE_Y = 2.35;
const TEXTURE_SCALE = 16;

const BODY_PART_NAMES = [
  "head",
  "torso",
  "rightArm",
  "leftArm",
  "rightLeg",
  "leftLeg",
] as const;

const FACE_NAMES = ["front", "back", "top", "bottom", "right", "left"] as const;

type BodyPartName = typeof BODY_PART_NAMES[number];
type FaceName = typeof FACE_NAMES[number];
type BodyPartTextureMap = Map<BodyPartName, Partial<Record<FaceName, TextureMatrix>>>;

export async function loadRemotePlayerMatrixColor(userId: string): Promise<unknown | null> {
  const session = getAuthSession();

  if (!session?.token) {
    return null;
  }

  const url = `${resolveCentralAuthApiBaseUrl()}/users/${encodeURIComponent(userId)}${MATRIX_COLOR_ENDPOINT_SUFFIX}?t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Impossible de récupérer la matrice de couleur du joueur ${userId} (${response.status})`);
  }

  return response.json();
}

export function applyRemotePlayerMatrixColor(scene: Scene, rootMesh: Mesh, payload: unknown): boolean {
  const textureMap = extractBodyPartTextures(payload);

  if (textureMap.size === 0) {
    return false;
  }

  const parts = getAllBodyParts(rootMesh);
  let applied = false;

  for (const [partName, faces] of textureMap) {
    const partMesh = parts.get(partName);

    if (!partMesh || !(partMesh.material instanceof MultiMaterial)) {
      continue;
    }

    FACE_NAMES.forEach((faceName, faceIndex) => {
      const textureData = faces[faceName];
      const material = partMesh.material instanceof MultiMaterial
        ? partMesh.material.subMaterials[faceIndex]
        : null;

      if (!textureData || !(material instanceof StandardMaterial)) {
        return;
      }

      const texture = createTextureFromMatrix(
        scene,
        `${rootMesh.name}_${partName}_${faceName}_remote_custom`,
        textureData,
      );
      const previousDiffuseTexture = material.diffuseTexture;
      const previousOpacityTexture = material.opacityTexture;

      material.diffuseTexture = texture;
      material.opacityTexture = texture;
      material.useAlphaFromDiffuseTexture = true;

      previousDiffuseTexture?.dispose();
      if (previousOpacityTexture && previousOpacityTexture !== previousDiffuseTexture) {
        previousOpacityTexture.dispose();
      }

      applied = true;
    });
  }

  return applied;
}

export function createRemotePlayerNameplate(scene: Scene, nickname: string, parent: Mesh): Mesh {
  const label = sanitizeNameplateText(nickname);
  const texture = new DynamicTexture(
    `remote-player-nameplate-texture-${parent.uniqueId}`,
    { width: 512, height: 128 },
    scene,
    true,
  );
  const context = texture.getContext();

  context.clearRect(0, 0, 512, 128);
  drawRoundedRect(context, 12, 22, 488, 84, 18, "rgba(0, 0, 0, 0.58)");
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 4;
  strokeRoundedRect(context, 12, 22, 488, 84, 18);
  context.fillStyle = "#ffffff";
  context.font = "700 42px Arial, Helvetica, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(0, 0, 0, 0.85)";
  context.shadowBlur = 4;
  context.fillText(label, 256, 65, 448);
  texture.hasAlpha = true;
  texture.update();
  texture.updateSamplingMode(TEXTURE_SCALE);

  const material = new StandardMaterial(`remote-player-nameplate-material-${parent.uniqueId}`, scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.backFaceCulling = false;

  const plane = MeshBuilder.CreatePlane(
    `remote-player-nameplate-${parent.uniqueId}`,
    { width: NAMEPLATE_WIDTH, height: NAMEPLATE_HEIGHT },
    scene,
  );
  plane.parent = parent;
  plane.position.set(0, NAMEPLATE_Y, 0);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.material = material;
  plane.isPickable = false;

  return plane;
}

function extractBodyPartTextures(payload: unknown): BodyPartTextureMap {
  const textureMap: BodyPartTextureMap = new Map();

  for (const candidate of getPayloadCandidates(payload)) {
    collectCharacterModelTextures(candidate, textureMap);
    collectNestedTextures(candidate, textureMap);
    collectFlatTextures(candidate, textureMap);
  }

  return textureMap;
}

function getPayloadCandidates(payload: unknown): unknown[] {
  if (!isRecord(payload)) {
    return [payload];
  }

  return [
    payload,
    payload.matrix_color,
    payload.matrixColor,
    payload.color_matrix,
    payload.colorMatrix,
    payload.avatar,
    isRecord(payload.avatar) ? payload.avatar.matrix_color : undefined,
    isRecord(payload.avatar) ? payload.avatar.matrixColor : undefined,
    payload.character,
    payload.model,
    payload.textures,
  ].filter((candidate) => candidate !== undefined && candidate !== null);
}

function collectCharacterModelTextures(candidate: unknown, textureMap: BodyPartTextureMap): void {
  const bodyParts = Array.isArray(candidate)
    ? candidate
    : isRecord(candidate) && Array.isArray(candidate.bodyParts)
      ? candidate.bodyParts
      : null;

  if (!bodyParts) {
    return;
  }

  for (const part of bodyParts) {
    if (!isRecord(part) || typeof part.name !== "string" || !isRecord(part.textures)) {
      continue;
    }

    const partName = parseBodyPartName(part.name);

    if (!partName) {
      continue;
    }

    collectFaces(partName, part.textures, textureMap);
  }
}

function collectNestedTextures(candidate: unknown, textureMap: BodyPartTextureMap): void {
  if (!isRecord(candidate)) {
    return;
  }

  for (const partName of BODY_PART_NAMES) {
    const faces = candidate[partName];

    if (isRecord(faces)) {
      collectFaces(partName, faces, textureMap);
    }
  }
}

function collectFlatTextures(candidate: unknown, textureMap: BodyPartTextureMap): void {
  if (!isRecord(candidate)) {
    return;
  }

  for (const [key, value] of Object.entries(candidate)) {
    const [partName, faceName] = key.split(".");
    const parsedPartName = parseBodyPartName(partName);
    const parsedFaceName = parseFaceName(faceName);

    if (!parsedPartName || !parsedFaceName) {
      continue;
    }

    const texture = normalizeTextureMatrix(value);

    if (!texture) {
      continue;
    }

    setFaceTexture(textureMap, parsedPartName, parsedFaceName, texture);
  }
}

function collectFaces(partName: BodyPartName, faces: Record<string, unknown>, textureMap: BodyPartTextureMap): void {
  for (const faceName of FACE_NAMES) {
    const texture = normalizeTextureMatrix(faces[faceName]);

    if (texture) {
      setFaceTexture(textureMap, partName, faceName, texture);
    }
  }
}

function normalizeTextureMatrix(value: unknown): TextureMatrix | null {
  if (!isRecord(value) || !isRecord(value.palette) || !Array.isArray(value.matrix)) {
    return null;
  }

  const matrix = value.matrix.filter((row): row is string => typeof row === "string");

  if (matrix.length === 0 || matrix.some((row) => row.length === 0)) {
    return null;
  }

  const width = typeof value.width === "number" ? value.width : matrix[0].length;
  const height = typeof value.height === "number" ? value.height : matrix.length;

  if (height !== matrix.length || matrix.some((row) => row.length !== width)) {
    return null;
  }

  return {
    palette: value.palette as TextureMatrix["palette"],
    width,
    height,
    matrix,
  };
}

function setFaceTexture(
  textureMap: BodyPartTextureMap,
  partName: BodyPartName,
  faceName: FaceName,
  texture: TextureMatrix,
): void {
  const faces = textureMap.get(partName) ?? {};
  faces[faceName] = texture;
  textureMap.set(partName, faces);
}

function parseBodyPartName(value: string | undefined): BodyPartName | null {
  return BODY_PART_NAMES.find((partName) => partName === value) ?? null;
}

function parseFaceName(value: string | undefined): FaceName | null {
  return FACE_NAMES.find((faceName) => faceName === value) ?? null;
}

function sanitizeNameplateText(nickname: string): string {
  const trimmed = nickname.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 24) : "joueur";
}

function resolveCentralAuthApiBaseUrl(): string {
  const customUrl = import.meta.env.VITE_AUTH_API_URL as string | undefined;

  if (customUrl && customUrl.trim().length > 0) {
    return customUrl.trim().replace(/\/$/, "");
  }

  return DEFAULT_CENTRAL_AUTH_API_BASE_URL;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
): void {
  context.fillStyle = fillStyle;
  roundedRectPath(context, x, y, width, height, radius);
  context.fill();
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundedRectPath(context, x, y, width, height, radius);
  context.stroke();
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
