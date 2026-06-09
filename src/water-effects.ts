import { Effect, Mesh, Scene, ShaderMaterial, Vector2, Vector3 } from "@babylonjs/core";
import { getWorldBlock } from "./functions";
import { BlockId, type PlayerPhysics, type WorldChunks } from "./types";

type WaterSplashParams = {
  player: PlayerPhysics;
  previousPosition: Vector3;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
};

type WaterEffect = {
  material: ShaderMaterial;
  update: (deltaTime: number) => void;
  tryTriggerSplash: (params: WaterSplashParams) => void;
  dispose: () => void;
};

const WATER_MESH_SUFFIX = "-water";
const SPLASH_COOLDOWN_SECONDS = 0.35;
const SPLASH_MIN_FALL_SPEED = -0.45;
const PLAYER_WATER_PROBE_HEIGHT = 0.15;

let shadersRegistered = false;

export function createWaterEffect(scene: Scene): WaterEffect {
  registerWaterShaders();

  const material = new ShaderMaterial(
    "water-wave-shader",
    scene,
    {
      vertex: "waterWave",
      fragment: "waterWave",
    },
    {
      attributes: ["position", "color"],
      uniforms: ["worldViewProjection", "time", "splashCenter", "splashStartTime"],
      needAlphaBlending: true,
    },
  );

  material.backFaceCulling = false;
  material.setFloat("time", 0);
  material.setFloat("splashStartTime", -1000);
  material.setVector2("splashCenter", new Vector2(0, 0));

  let elapsedTime = 0;
  let wasInWater = false;
  let lastSplashTime = -SPLASH_COOLDOWN_SECONDS;

  const assignWaterMaterial = (mesh: Mesh): void => {
    if (!mesh.name.endsWith(WATER_MESH_SUFFIX)) {
      return;
    }

    mesh.material = material;
    mesh.hasVertexAlpha = true;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
  };

  for (const mesh of scene.meshes) {
    if (mesh instanceof Mesh) {
      assignWaterMaterial(mesh);
    }
  }

  const observer = scene.onNewMeshAddedObservable.add((mesh) => {
    if (mesh instanceof Mesh) {
      assignWaterMaterial(mesh);
    }
  });

  return {
    material,

    update(deltaTime: number): void {
      elapsedTime += deltaTime;
      material.setFloat("time", elapsedTime);
    },

    tryTriggerSplash(params: WaterSplashParams): void {
      const isInWater = isPlayerInWater(params);
      const enteredWater = isInWater && !wasInWater;
      const isFallingIntoWater = params.player.velocity.y <= SPLASH_MIN_FALL_SPEED || params.previousPosition.y > params.player.position.y;
      const canSplash = elapsedTime - lastSplashTime >= SPLASH_COOLDOWN_SECONDS;

      if (enteredWater && isFallingIntoWater && canSplash) {
        lastSplashTime = elapsedTime;
        material.setVector2("splashCenter", new Vector2(params.player.position.x, params.player.position.z));
        material.setFloat("splashStartTime", elapsedTime);
      }

      wasInWater = isInWater;
    },

    dispose(): void {
      scene.onNewMeshAddedObservable.remove(observer);
      material.dispose();
    },
  };
}

function isPlayerInWater(params: WaterSplashParams): boolean {
  const { player, worldChunks, sizeX, sizeY, sizeZ } = params;
  const probeY = player.position.y + PLAYER_WATER_PROBE_HEIGHT;
  const blockAtFeet = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, player.position.x, probeY, player.position.z);

  if (blockAtFeet === BlockId.Water) {
    return true;
  }

  const blockAtBody = getWorldBlock(worldChunks, sizeX, sizeY, sizeZ, player.position.x, probeY + 0.65, player.position.z);

  return blockAtBody === BlockId.Water;
}

function registerWaterShaders(): void {
  if (shadersRegistered) {
    return;
  }

  Effect.ShadersStore["waterWaveVertexShader"] = `
    precision highp float;

    attribute vec3 position;
    attribute vec4 color;

    uniform mat4 worldViewProjection;
    uniform float time;
    uniform vec2 splashCenter;
    uniform float splashStartTime;

    varying vec4 vColor;
    varying float vWaveLight;
    varying float vSplashLight;

    void main(void) {
      vec3 animatedPosition = position;

      float waveA = sin(position.x * 2.4 + time * 1.35) * 0.018;
      float waveB = sin(position.z * 3.1 + time * 1.65) * 0.014;
      float waveC = sin((position.x + position.z) * 1.7 + time * 0.85) * 0.01;
      float baseWave = waveA + waveB + waveC;

      float splashAge = max(0.0, time - splashStartTime);
      float splashDistance = distance(position.xz, splashCenter);
      float splashRadius = splashAge * 2.7;
      float splashRing = 1.0 - smoothstep(0.0, 0.55, abs(splashDistance - splashRadius));
      float splashFade = exp(-splashAge * 2.4) * (1.0 - smoothstep(1.15, 1.45, splashAge));
      float splashWave = sin((splashDistance - splashRadius) * 13.0) * 0.075 * splashRing * splashFade;

      animatedPosition.y += baseWave + splashWave;

      vColor = color;
      vWaveLight = baseWave;
      vSplashLight = abs(splashWave) * 7.5;

      gl_Position = worldViewProjection * vec4(animatedPosition, 1.0);
    }
  `;

  Effect.ShadersStore["waterWaveFragmentShader"] = `
    precision highp float;

    varying vec4 vColor;
    varying float vWaveLight;
    varying float vSplashLight;

    void main(void) {
      vec3 shallowBlue = vec3(0.12, 0.46, 0.92);
      vec3 deepBlue = vec3(0.04, 0.24, 0.72);
      vec3 baseColor = mix(deepBlue, shallowBlue, 0.55 + vWaveLight * 5.0);
      vec3 highlight = vec3(0.55, 0.85, 1.0) * clamp(vSplashLight, 0.0, 0.45);
      float alpha = max(vColor.a, 0.58);

      gl_FragColor = vec4(baseColor + highlight, alpha);
    }
  `;

  shadersRegistered = true;
}
