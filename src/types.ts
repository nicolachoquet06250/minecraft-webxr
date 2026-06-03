import type { Scene, StandardMaterial, UniversalCamera, Vector3 } from "@babylonjs/core";

export type PlayerPhysics = {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
};

export type VoxelWasmModule = {
  default: () => Promise<void>;
  generate_chunk: (chunkX: number, chunkZ: number, seed: number) => Uint8Array;
  chunk_size_x: () => number;
  chunk_size_y: () => number;
  chunk_size_z: () => number;
};

export type UpdatePlayerPhysicsParams = {
  player: PlayerPhysics;
  camera: UniversalCamera;
  blocks: Uint8Array;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  deltaTime: number;
};

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Water = 5,
}

export type CreateChunkMeshParams = {
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

export type FaceDefinition = {
  normal: [number, number, number];
  vertices: [number, number, number][];
};

export type AddFaceParams = {
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
