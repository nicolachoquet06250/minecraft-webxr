import {
  DynamicTexture,
  Effect,
  Mesh,
  Scene,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import { BREAKING_SPRITE_MASKS, BREAKING_SPRITE_TILE_SIZE } from "./block-breaking-sprite";
import { EYE_HEIGHT, FACES } from "./constants";
import { getWorldBlock } from "./functions";
import { breakBlock } from "./tree-decay";
import { BlockId, type DroppedItem, type FaceDefinition, type PlayerPhysics, type WorldChunks } from "./types";

export const BLOCK_BREAKING_TIMES_MS: Partial<Record<BlockId, number>> = {
  [BlockId.Dirt]: 1000,
  [BlockId.GrassBlock]: 1000,
  [BlockId.Sand]: 500,
  [BlockId.Stone]: 3000,
};

const BREAKING_REACH = 3;
const BREAKING_OVERLAY_OFFSET = 0.003;
const BREAKING_STAGE_COUNT = 4;

type BlockBreakingParams = {
  scene: Scene;
  player: PlayerPhysics;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  material: StandardMaterial;
  droppedItems: DroppedItem[];
};

type TargetBlock = {
  x: number;
  y: number;
  z: number;
  block: BlockId;
};

type BreakingState = {
  params: BlockBreakingParams;
  target: TargetBlock;
  durationMs: number;
  elapsedMs: number;
  overlay: Mesh;
  shader: ShaderMaterial;
};

let activeBreaking: BreakingState | null = null;
let shadersRegistered = false;
const breakingSpriteTextures = new WeakMap<Scene, DynamicTexture>();

export function startBlockBreaking(params: BlockBreakingParams): void {
  const target = findTargetBlock(params);

  if (!target) {
    cancelBlockBreaking();
    return;
  }

  const durationMs = BLOCK_BREAKING_TIMES_MS[target.block];

  if (!durationMs) {
    cancelBlockBreaking();
    breakBlock(params);
    return;
  }

  if (activeBreaking && isSameTarget(activeBreaking.target, target)) {
    return;
  }

  cancelBlockBreaking();
  registerBlockBreakingShaders();

  const shader = createBreakingShader(params.scene);
  const overlay = createBreakingOverlayMesh(params.scene, target, shader);

  activeBreaking = {
    params,
    target,
    durationMs,
    elapsedMs: 0,
    overlay,
    shader,
  };
}

export function updateBlockBreaking(deltaTimeSeconds: number): void {
  if (!activeBreaking) {
    return;
  }

  const currentTarget = findTargetBlock(activeBreaking.params);

  if (
    !currentTarget ||
    !isSameTarget(activeBreaking.target, currentTarget) ||
    currentTarget.block !== activeBreaking.target.block
  ) {
    cancelBlockBreaking();
    return;
  }

  activeBreaking.elapsedMs += deltaTimeSeconds * 1000;

  const progress = Math.min(activeBreaking.elapsedMs / activeBreaking.durationMs, 1);
  const stage = Math.min(BREAKING_STAGE_COUNT - 1, Math.floor(progress * BREAKING_STAGE_COUNT));

  activeBreaking.shader.setFloat("progress", progress);
  activeBreaking.shader.setFloat("stage", stage);

  if (progress >= 1) {
    const params = activeBreaking.params;
    disposeActiveBreaking();
    breakBlock(params);
  }
}

export function cancelBlockBreaking(): void {
  disposeActiveBreaking();
}

export function isBlockBreakingActive(): boolean {
  return activeBreaking !== null;
}

function disposeActiveBreaking(): void {
  if (!activeBreaking) {
    return;
  }

  activeBreaking.overlay.dispose();
  activeBreaking.shader.dispose();
  activeBreaking = null;
}

function findTargetBlock(params: BlockBreakingParams): TargetBlock | null {
  const { scene, player, worldChunks, sizeX, sizeY, sizeZ } = params;
  const ray = scene.createPickingRay(
    scene.getEngine().getRenderWidth() / 2,
    scene.getEngine().getRenderHeight() / 2,
    null,
    scene.activeCamera,
  );
  const start = player.position.add(new Vector3(0, EYE_HEIGHT, 0));
  const direction = ray.direction.normalize();

  for (let distance = 0.1; distance <= BREAKING_REACH; distance += 0.1) {
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

function isSameTarget(a: TargetBlock, b: TargetBlock): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function createBreakingOverlayMesh(
  scene: Scene,
  target: TargetBlock,
  shader: ShaderMaterial,
): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const face of FACES) {
    addOverlayFace({ positions, indices, normals, uvs, face, target });
  }

  const mesh = new Mesh(`breaking-overlay-${target.x}-${target.y}-${target.z}`, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh);

  mesh.material = shader;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;

  return mesh;
}

function addOverlayFace(params: {
  positions: number[];
  indices: number[];
  normals: number[];
  uvs: number[];
  face: FaceDefinition;
  target: TargetBlock;
}): void {
  const { positions, indices, normals, uvs, face, target } = params;
  const vertexIndex = positions.length / 3;
  const [nx, ny, nz] = face.normal;

  for (const vertex of face.vertices) {
    positions.push(
      target.x + vertex[0] + nx * BREAKING_OVERLAY_OFFSET,
      target.y + vertex[1] + ny * BREAKING_OVERLAY_OFFSET,
      target.z + vertex[2] + nz * BREAKING_OVERLAY_OFFSET,
    );
    normals.push(nx, ny, nz);
  }

  uvs.push(0, 1, 0, 0, 1, 0, 1, 1);
  indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3);
}

function createBreakingShader(scene: Scene): ShaderMaterial {
  const shader = new ShaderMaterial(
    "block-breaking-shader",
    scene,
    {
      vertex: "blockBreaking",
      fragment: "blockBreaking",
    },
    {
      attributes: ["position", "normal", "uv"],
      uniforms: ["worldViewProjection", "progress", "stage"],
      samplers: ["breakingSprite"],
      needAlphaBlending: true,
    },
  );

  shader.backFaceCulling = false;
  shader.setFloat("progress", 0);
  shader.setFloat("stage", 0);
  shader.setTexture("breakingSprite", getBreakingSpriteTexture(scene));

  return shader;
}

function getBreakingSpriteTexture(scene: Scene): DynamicTexture {
  const cachedTexture = breakingSpriteTextures.get(scene);

  if (cachedTexture) {
    return cachedTexture;
  }

  const width = BREAKING_SPRITE_TILE_SIZE * BREAKING_STAGE_COUNT;
  const height = BREAKING_SPRITE_TILE_SIZE;
  const texture = new DynamicTexture(
    "block-breaking-sprite",
    { width, height },
    scene,
    false,
    Texture.NEAREST_SAMPLINGMODE,
  );
  const context = texture.getContext();

  context.clearRect(0, 0, width, height);

  for (let stageIndex = 0; stageIndex < BREAKING_STAGE_COUNT; stageIndex++) {
    const mask = BREAKING_SPRITE_MASKS[stageIndex];
    const originX = stageIndex * BREAKING_SPRITE_TILE_SIZE;

    for (let y = 0; y < BREAKING_SPRITE_TILE_SIZE; y++) {
      const row = mask[y];

      for (let x = 0; x < BREAKING_SPRITE_TILE_SIZE; x++) {
        const alpha = parseInt(row[x], 16) / 15;

        if (alpha <= 0) {
          continue;
        }

        context.fillStyle = `rgba(8, 8, 8, ${Math.min(1, alpha * 1.25)})`;
        context.fillRect(originX + x, y, 1, 1);
      }
    }
  }

  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.update(false);
  breakingSpriteTextures.set(scene, texture);

  return texture;
}

function registerBlockBreakingShaders(): void {
  if (shadersRegistered) {
    return;
  }

  Effect.ShadersStore["blockBreakingVertexShader"] = `
    precision highp float;

    attribute vec3 position;
    attribute vec2 uv;

    uniform mat4 worldViewProjection;

    varying vec2 vUV;

    void main(void) {
      vUV = uv;
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

  Effect.ShadersStore["blockBreakingFragmentShader"] = `
    precision highp float;

    varying vec2 vUV;

    uniform float progress;
    uniform float stage;
    uniform sampler2D breakingSprite;

    void main(void) {
      float tileCount = 4.0;
      vec2 spriteUV = vec2((vUV.x + stage) / tileCount, vUV.y);
      vec4 crack = texture2D(breakingSprite, spriteUV);
      float fadeIn = smoothstep(0.01, 0.08, progress);
      float alpha = crack.a * fadeIn;

      if (alpha < 0.03) {
        discard;
      }

      gl_FragColor = vec4(crack.rgb, alpha);
    }
  `;

  shadersRegistered = true;
}
