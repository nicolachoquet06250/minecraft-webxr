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
import type { PlayerPublicState } from "./multiplayer-client";
import { createTextureFromMatrix, getAllBodyParts, type ColorPalette, type TextureMatrix } from "~/character-builder";

const DEFAULT_CENTRAL_AUTH_API_BASE_URL = "https://central.voxicraft.fr/api";
const MATRIX_COLOR_ENDPOINT_SUFFIX = "/matrix-color";
const NAMEPLATE_WIDTH = 1.35;
const NAMEPLATE_HEIGHT = 0.34;
const NAMEPLATE_Y = 2.35;

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
type NameplateContext = ReturnType<DynamicTexture["getContext"]>;
type MatrixCandidate = {
  readonly value: unknown;
  readonly palette?: ColorPalette;
};

const queuedRemotePlayerStates: PlayerPublicState[] = [];

export function queueRemotePlayerAppearanceState(playerState: PlayerPublicState): void {
  queuedRemotePlayerStates.push(playerState);
}

export function decorateNextRemotePlayerMesh(scene: Scene, rootMesh: Mesh): void {
  const playerState = queuedRemotePlayerStates.shift();

  if (!playerState) {
    return;
  }

  createRemotePlayerNameplate(scene, playerState.nickname, rootMesh);

  const matrixColorUserId = resolveMatrixColorUserId(playerState);

  if (!matrixColorUserId) {
    console.warn(
      "[Voxicraft] Impossible de charger la matrice de couleur: identifiant central manquant",
      playerState.player_id,
      playerState.nickname,
    );
    return;
  }

  void loadRemotePlayerMatrixColor(matrixColorUserId)
    .then((payload) => {
      if (payload && !applyRemotePlayerMatrixColor(scene, rootMesh, payload)) {
        console.warn(
          "[Voxicraft] texture_data.parts ne contient aucune matrice de couleur applicable",
          matrixColorUserId,
          payload,
        );
      }
    })
    .catch((error: unknown) => {
      console.warn("[Voxicraft] Matrice de couleur distante indisponible", matrixColorUserId, error);
    });
}

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
      const matrixData = faces[faceName];
      const material = partMesh.material instanceof MultiMaterial
        ? partMesh.material.subMaterials[faceIndex]
        : null;

      if (!matrixData || !(material instanceof StandardMaterial)) {
        return;
      }

      const texture = createTextureFromMatrix(
        scene,
        `${rootMesh.name}_${partName}_${faceName}_remote_matrix`,
        matrixData,
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
  context.shadowColor = "rgba(0, 0, 0, 0.85)";
  context.shadowBlur = 4;
  context.fillText(label, 48, 78, 416);
  texture.hasAlpha = true;
  texture.update();
  texture.updateSamplingMode(1);

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

function resolveMatrixColorUserId(playerState: PlayerPublicState): string | null {
  const userId = playerState.user_id?.trim();
  return userId && userId.length > 0 ? userId : null;
}

function extractBodyPartTextures(payload: unknown): BodyPartTextureMap {
  const textureMap: BodyPartTextureMap = new Map();

  for (const candidate of getTextureDataCandidates(payload)) {
    collectCharacterModelTextures(candidate.value, textureMap, candidate.palette);
    collectNestedTextures(candidate.value, textureMap, candidate.palette);
    collectFlatTextures(candidate.value, textureMap, candidate.palette);
  }

  return textureMap;
}

function getTextureDataCandidates(payload: unknown): MatrixCandidate[] {
  const candidates: MatrixCandidate[] = [];
  const root = parseMaybeJson(payload);

  if (!isRecord(root)) {
    candidates.push({ value: root });
    return candidates;
  }

  const textureData = parseMaybeJson(root.texture_data ?? root.textureData);
  const avatar = isRecord(root.avatar) ? root.avatar : null;
  const avatarTextureData = avatar ? parseMaybeJson(avatar.texture_data ?? avatar.textureData) : null;

  pushMatrixCandidates(candidates, textureData);
  pushMatrixCandidates(candidates, avatarTextureData);
  pushMatrixCandidates(candidates, root.matrix_color ?? root.matrixColor ?? root.color_matrix ?? root.colorMatrix);
  pushMatrixCandidates(candidates, avatar?.matrix_color ?? avatar?.matrixColor);
  pushMatrixCandidates(candidates, root);

  return candidates;
}

function pushMatrixCandidates(candidates: MatrixCandidate[], value: unknown): void {
  const parsedValue = parseMaybeJson(value);

  if (parsedValue === undefined || parsedValue === null) {
    return;
  }

  if (!isRecord(parsedValue)) {
    candidates.push({ value: parsedValue });
    return;
  }

  const palette = extractPalette(parsedValue);

  candidates.push({ value: parsedValue.parts, palette });
  candidates.push({ value: parsedValue, palette });
  candidates.push({ value: parsedValue.steveModelTextures, palette });
  candidates.push({ value: parsedValue.alexModelTextures, palette });
  candidates.push({ value: parsedValue.steve_model_textures, palette });
  candidates.push({ value: parsedValue.alex_model_textures, palette });
  candidates.push({ value: parsedValue.modelTextures, palette });
  candidates.push({ value: parsedValue.model_textures, palette });
  candidates.push({ value: parsedValue.textures, palette });
}

function collectCharacterModelTextures(
  candidate: unknown,
  textureMap: BodyPartTextureMap,
  fallbackPalette?: ColorPalette,
): void {
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

    collectFaces(partName, part.textures, textureMap, extractPalette(part) ?? fallbackPalette);
  }
}

function collectNestedTextures(
  candidate: unknown,
  textureMap: BodyPartTextureMap,
  fallbackPalette?: ColorPalette,
): void {
  if (!isRecord(candidate)) {
    return;
  }

  const palette = extractPalette(candidate) ?? fallbackPalette;

  for (const partName of BODY_PART_NAMES) {
    const faces = candidate[partName];

    if (isRecord(faces)) {
      collectFaces(partName, faces, textureMap, extractPalette(faces) ?? palette);
    }
  }
}

function collectFlatTextures(
  candidate: unknown,
  textureMap: BodyPartTextureMap,
  fallbackPalette?: ColorPalette,
): void {
  if (!isRecord(candidate)) {
    return;
  }

  const palette = extractPalette(candidate) ?? fallbackPalette;

  for (const [key, value] of Object.entries(candidate)) {
    const [partName, faceName] = key.split(".");
    const parsedPartName = parseBodyPartName(partName);
    const parsedFaceName = parseFaceName(faceName);

    if (!parsedPartName || !parsedFaceName) {
      continue;
    }

    const texture = normalizeTextureMatrix(value, palette);

    if (!texture) {
      continue;
    }

    setFaceTexture(textureMap, parsedPartName, parsedFaceName, texture);
  }
}

function collectFaces(
  partName: BodyPartName,
  faces: Record<string, unknown>,
  textureMap: BodyPartTextureMap,
  fallbackPalette?: ColorPalette,
): void {
  const palette = extractPalette(faces) ?? fallbackPalette;

  for (const faceName of FACE_NAMES) {
    const texture = normalizeTextureMatrix(faces[faceName], palette);

    if (texture) {
      setFaceTexture(textureMap, partName, faceName, texture);
    }
  }
}

function normalizeTextureMatrix(value: unknown, fallbackPalette?: ColorPalette): TextureMatrix | null {
  if (!isRecord(value) || !Array.isArray(value.matrix)) {
    return null;
  }

  const palette = extractPalette(value) ?? fallbackPalette;

  if (!palette) {
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
    palette,
    width,
    height,
    matrix,
  };
}

function extractPalette(value: unknown): ColorPalette | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const palette = value.palette ?? value.stevePalette ?? value.alexPalette;

  return isRecord(palette) ? palette as ColorPalette : undefined;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
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
  context: NameplateContext,
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
  context: NameplateContext,
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
  context: NameplateContext,
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
