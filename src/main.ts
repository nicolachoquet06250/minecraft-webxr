import "./style.css";
import init, * as wasmModule from "../public/wasm/voxel_wasm"

import {
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  Scene,
  StandardMaterial,
  UniversalCamera,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";

type PlayerPhysics = {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
};

type VoxelWasmModule = {
  default: () => Promise<void>;
  generate_chunk: (chunkX: number, chunkZ: number, seed: number) => Uint8Array;
  chunk_size_x: () => number;
  chunk_size_y: () => number;
  chunk_size_z: () => number;
};

type UpdatePlayerPhysicsParams = {
  player: PlayerPhysics;
  camera: UniversalCamera;
  blocks: Uint8Array;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  deltaTime: number;
};

enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
}

async function loadVoxelWasm(): Promise<VoxelWasmModule> {
  await init();

  return wasmModule as unknown as VoxelWasmModule;
}

type CreateChunkMeshParams = {
  scene: Scene;
  name: string;
  blocks: Uint8Array;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  chunkX: number;
  chunkZ: number;
  material: StandardMaterial;
};

function createChunkMesh(params: CreateChunkMeshParams): Mesh {
  const {
    scene,
    name,
    blocks,
    sizeX,
    sizeY,
    sizeZ,
    chunkX,
    chunkZ,
    material,
  } = params;

  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];

  const worldOffsetX = chunkX * sizeX;
  const worldOffsetZ = chunkZ * sizeZ;

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const block = getBlock(blocks, sizeX, sizeY, sizeZ, x, y, z);

        if (block === BlockId.Air) {
          continue;
        }

        const worldX = worldOffsetX + x;
        const worldY = y;
        const worldZ = worldOffsetZ + z;

        for (const face of FACES) {
          const neighbor = getBlock(
            blocks,
            sizeX,
            sizeY,
            sizeZ,
            x + face.normal[0],
            y + face.normal[1],
            z + face.normal[2],
          );

          if (isTransparentForMeshing(neighbor)) {
            addFace({
              positions,
              indices,
              normals,
              colors,
              x: worldX,
              y: worldY,
              z: worldZ,
              face,
              block,
            });
          }
        }
      }
    }
  }

  const mesh = new Mesh(name, scene);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.colors = colors;
  vertexData.applyToMesh(mesh);

  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
  mesh.material = material;

  return mesh;
}

type FaceDefinition = {
  normal: [number, number, number];
  vertices: [number, number, number][];
};

const FACES: FaceDefinition[] = [
  // Haut
  {
    normal: [0, 1, 0],
    vertices: [
      [0, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },

  // Bas
  {
    normal: [0, -1, 0],
    vertices: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
      [0, 0, 0],
    ],
  },

  // Avant
  {
    normal: [0, 0, 1],
    vertices: [
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
      [1, 0, 1],
    ],
  },

  // Arrière
  {
    normal: [0, 0, -1],
    vertices: [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
  },

  // Droite
  {
    normal: [1, 0, 0],
    vertices: [
      [1, 0, 1],
      [1, 1, 1],
      [1, 1, 0],
      [1, 0, 0],
    ],
  },

  // Gauche
  {
    normal: [-1, 0, 0],
    vertices: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
  },
];

type AddFaceParams = {
  positions: number[];
  indices: number[];
  normals: number[];
  colors: number[];
  x: number;
  y: number;
  z: number;
  face: FaceDefinition;
  block: BlockId;
};

function addFace(params: AddFaceParams): void {
  const { positions, indices, normals, colors, x, y, z, face, block } = params;

  const vertexIndex = positions.length / 3;
  const color = getBlockColor(block);

  for (const vertex of face.vertices) {
    positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    normals.push(face.normal[0], face.normal[1], face.normal[2]);
    colors.push(color.r, color.g, color.b, color.a);
  }

  indices.push(
    vertexIndex,
    vertexIndex + 1,
    vertexIndex + 2,
    vertexIndex,
    vertexIndex + 2,
    vertexIndex + 3,
  );
}

function getBlock(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  x: number,
  y: number,
  z: number,
): BlockId {
  if (x < 0 || x >= sizeX) return BlockId.Air;
  if (y < 0 || y >= sizeY) return BlockId.Air;
  if (z < 0 || z >= sizeZ) return BlockId.Air;

  const index = x + sizeX * (z + sizeZ * y);

  return blocks[index] as BlockId;
}

function isSolidBlock(block: BlockId): boolean {
  return (
    block !== BlockId.Air &&
    block !== BlockId.Water
  );
}

function getWorldBlock(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  worldX: number,
  worldY: number,
  worldZ: number,
): BlockId {
  const x = Math.floor(worldX);
  const y = Math.floor(worldY);
  const z = Math.floor(worldZ);

  return getBlock(blocks, sizeX, sizeY, sizeZ, x, y, z);
}

function findTerrainSpawnY(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  x: number,
  z: number,
): number {
  const blockX = Math.floor(x);
  const blockZ = Math.floor(z);

  for (let y = sizeY - 1; y >= 0; y--) {
    const block = getBlock(blocks, sizeX, sizeY, sizeZ, blockX, y, blockZ);

    if (isSolidBlock(block)) {
      return y + 1;
    }
  }

  return sizeY + 4;
}

function hasCollisionAt(
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  position: Vector3,
): boolean {
  const minX = position.x - PLAYER_RADIUS;
  const maxX = position.x + PLAYER_RADIUS;
  const minY = position.y;
  const maxY = position.y + PLAYER_HEIGHT;
  const minZ = position.z - PLAYER_RADIUS;
  const maxZ = position.z + PLAYER_RADIUS;

  for (let y = Math.floor(minY); y <= Math.floor(maxY); y++) {
    for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++) {
      for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
        const block = getWorldBlock(blocks, sizeX, sizeY, sizeZ, x, y, z);

        if (isSolidBlock(block)) {
          return true;
        }
      }
    }
  }

  return false;
}

function moveWithCollision(
  player: PlayerPhysics,
  deltaMove: Vector3,
  blocks: Uint8Array,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): void {
  const nextX = player.position.add(new Vector3(deltaMove.x, 0, 0));

  if (!hasCollisionAt(blocks, sizeX, sizeY, sizeZ, nextX)) {
    player.position.x = nextX.x;
  } else {
    player.velocity.x = 0;
  }

  const nextZ = player.position.add(new Vector3(0, 0, deltaMove.z));

  if (!hasCollisionAt(blocks, sizeX, sizeY, sizeZ, nextZ)) {
    player.position.z = nextZ.z;
  } else {
    player.velocity.z = 0;
  }

  const nextY = player.position.add(new Vector3(0, deltaMove.y, 0));

  if (!hasCollisionAt(blocks, sizeX, sizeY, sizeZ, nextY)) {
    player.position.y = nextY.y;
    player.grounded = false;
  } else {
    if (deltaMove.y < 0) {
      player.grounded = true;
    }

    player.velocity.y = 0;
  }
}

function isTransparentForMeshing(block: BlockId): boolean {
  return block === BlockId.Air || block === BlockId.Water;
}

function getBlockColor(block: BlockId): Color4 {
  switch (block) {
    case BlockId.Grass:
      return new Color4(0.25, 0.65, 0.2, 1.0);

    case BlockId.Dirt:
      return new Color4(0.45, 0.28, 0.12, 1.0);

    case BlockId.Stone:
      return new Color4(0.45, 0.45, 0.45, 1.0);

    case BlockId.Sand:
      return new Color4(0.82, 0.72, 0.42, 1.0);

    case BlockId.Water:
      return new Color4(0.1, 0.35, 0.85, 0.65);

    case BlockId.Air:
    default:
      return new Color4(1.0, 1.0, 1.0, 0.0);
  }
}

function updatePlayerPhysics(params: UpdatePlayerPhysicsParams): void {
  const {
    player,
    camera,
    blocks,
    sizeX,
    sizeY,
    sizeZ,
    deltaTime,
  } = params;

  const forward = new Vector3(
    Math.sin(player.yaw),
    0,
    Math.cos(player.yaw),
  );

  const right = new Vector3(
    Math.cos(player.yaw),
    0,
    -Math.sin(player.yaw),
  );

  const moveDirection = Vector3.Zero();

  if (
  pressedKeys.has("KeyW") ||
  pressedKeys.has("KeyZ") ||
  pressedKeys.has("ArrowUp")
) {
  moveDirection.addInPlace(forward);
}

if (
  pressedKeys.has("KeyS") ||
  pressedKeys.has("ArrowDown")
) {
  moveDirection.subtractInPlace(forward);
}

if (
  pressedKeys.has("KeyD") ||
  pressedKeys.has("ArrowRight")
) {
  moveDirection.addInPlace(right);
}

if (
  pressedKeys.has("KeyA") ||
  pressedKeys.has("KeyQ") ||
  pressedKeys.has("ArrowLeft")
) {
  moveDirection.subtractInPlace(right);
}

  if (moveDirection.lengthSquared() > 0) {
    moveDirection.normalize();
  }

  player.velocity.x = moveDirection.x * MOVE_SPEED;
  player.velocity.z = moveDirection.z * MOVE_SPEED;

  if (player.grounded && pressedKeys.has("Space")) {
    player.velocity.y = JUMP_VELOCITY;
    player.grounded = false;
  }

  player.velocity.y += GRAVITY * deltaTime;

  const deltaMove = player.velocity.scale(deltaTime);

  moveWithCollision(
    player,
    deltaMove,
    blocks,
    sizeX,
    sizeY,
    sizeZ,
  );

  camera.position.copyFrom(
    player.position.add(new Vector3(0, EYE_HEIGHT, 0)),
  );

  camera.rotation.x = player.pitch;
  camera.rotation.y = player.yaw;
  camera.rotation.z = 0;
}

const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.32;
const EYE_HEIGHT = 1.62;

const GRAVITY = -28;
const JUMP_VELOCITY = 9;
const MOVE_SPEED = 6;
const MOUSE_SENSIBILITY = 0.0025;

const canvas = document.getElementById("minecraft");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #minecraft introuvable");
}

const engine = new Engine(canvas, true);
const scene = new Scene(engine);

scene.clearColor = new Color4(0.55, 0.75, 1.0, 1.0);

new HemisphericLight("sun", new Vector3(0.3, 1.0, 0.4), scene);

const lightMaterial = new StandardMaterial("terrain-material", scene);
lightMaterial.specularColor = Color3.Black();

const wasm = await loadVoxelWasm();

const chunkX = 0;
const chunkZ = 0;
const seed = 12345;

const blocks = wasm.generate_chunk(chunkX, chunkZ, seed);

const sizeX = wasm.chunk_size_x();
const sizeY = wasm.chunk_size_y();
const sizeZ = wasm.chunk_size_z();

const spawnX = 8;
const spawnZ = 8;
const spawnY = findTerrainSpawnY(blocks, sizeX, sizeY, sizeZ, spawnX, spawnZ);

const player: PlayerPhysics = {
  position: new Vector3(spawnX + 0.5, spawnY, spawnZ + 0.5),
  velocity: Vector3.Zero(),
  yaw: Math.PI / 4,
  pitch: 0,
  grounded: false,
};

const camera = new UniversalCamera(
  "fps-camera",
  player.position.add(new Vector3(0, EYE_HEIGHT, 0)),
  scene,
);

camera.minZ = 0.05;
camera.maxZ = 500;
camera.fov = 1.1;

camera.inputs.clear();

scene.activeCamera = camera;

const pressedKeys = new Set<string>();

createChunkMesh({
  scene,
  name: "chunk-0-0",
  blocks,
  sizeX,
  sizeY,
  sizeZ,
  chunkX,
  chunkZ,
  material: lightMaterial,
});

await scene.createDefaultXRExperienceAsync({
  floorMeshes: [],
});

engine.runRenderLoop(() => {
  const deltaTime = Math.min(engine.getDeltaTime() / 1000, 0.05);

  updatePlayerPhysics({
    player,
    camera,
    blocks,
    sizeX,
    sizeY,
    sizeZ,
    deltaTime,
  });

  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});

window.addEventListener("keydown", (event) => {
  pressedKeys.add(event.code);

  if (
    event.code === "Space" ||
    event.code === "ArrowUp" ||
    event.code === "ArrowDown" ||
    event.code === "ArrowLeft" ||
    event.code === "ArrowRight"
  ) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) {
    return;
  }

  player.yaw += event.movementX * MOUSE_SENSIBILITY;
  player.pitch += event.movementY * MOUSE_SENSIBILITY;
});

canvas.addEventListener("click", async () => {
  await canvas.requestPointerLock();
});