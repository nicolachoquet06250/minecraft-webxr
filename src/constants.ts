import type { FaceDefinition } from "./types";

export const PLAYER_HEIGHT = 1.8;
export const PLAYER_RADIUS = 0.32;
export const EYE_HEIGHT = 1.62;

export const GRAVITY = -28;
export const JUMP_VELOCITY = 9;
export const MOVE_SPEED = 6;
export const MOUSE_SENSIBILITY = 0.0025;

export const CHUNK_X = 0;
export const CHUNK_Z = 0;
export const SEED = 12345;

export const SPAWN_X = 8;
export const SPAWN_Z = 8;

export const pressedKeys = new Set<string>();

export const FACES: FaceDefinition[] = [
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

export const INITIAL_CHUNK_RADIUS = 3;