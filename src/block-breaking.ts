import {
  Effect,
  Mesh,
  Scene,
  ShaderMaterial,
  StandardMaterial,
  Vector3,
  VertexData,
} from "@babylonjs/core";
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
  const stage = Math.floor(progress * 9);

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
      needAlphaBlending: true,
    },
  );

  shader.backFaceCulling = false;
  shader.setFloat("progress", 0);
  shader.setFloat("stage", 0);

  return shader;
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

    float crackLine(vec2 uv, float angle, float offset, float thickness) {
      vec2 direction = vec2(cos(angle), sin(angle));
      float distanceToLine = abs(dot(uv - 0.5, direction) + offset);
      return 1.0 - smoothstep(thickness, thickness + 0.012, distanceToLine);
    }

    float gridCrack(vec2 uv, float scale, float thickness) {
      vec2 grid = abs(fract(uv * scale) - 0.5);
      float line = min(grid.x, grid.y);
      return 1.0 - smoothstep(thickness, thickness + 0.01, line);
    }

    void main(void) {
      float normalizedStage = clamp(stage / 9.0, 0.0, 1.0);
      float thickness = mix(0.006, 0.035, normalizedStage);
      float visibility = smoothstep(0.02, 0.16, progress);

      float cracks = 0.0;
      cracks = max(cracks, crackLine(vUV, 0.55, -0.15, thickness));
      cracks = max(cracks, crackLine(vUV, 2.15, 0.08, thickness * 0.9));
      cracks = max(cracks, crackLine(vUV, -0.95, 0.22, thickness * 0.75));
      cracks = max(cracks, gridCrack(vUV + vec2(0.03, 0.07), 3.0 + stage * 0.55, thickness * 0.45));

      float centerMask = smoothstep(0.62, 0.12, distance(vUV, vec2(0.5)));
      float crackMask = cracks * centerMask * visibility;
      float alpha = crackMask * mix(0.35, 0.9, normalizedStage);

      if (alpha < 0.03) {
        discard;
      }

      gl_FragColor = vec4(0.02, 0.018, 0.015, alpha);
    }
  `;

  shadersRegistered = true;
}
