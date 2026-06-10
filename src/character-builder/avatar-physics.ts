import { Mesh, Vector3 } from "@babylonjs/core";
import { EYE_HEIGHT, GRAVITY, PLAYER_HEIGHT, PLAYER_RADIUS } from "~/constants";
import { hasCollisionAtWithExtents } from "~/functions";
import type { PlayerPhysics, WorldChunks } from "~/types";

export type CharacterPhysicsOptions = {
  collisionRadius?: number;
  collisionHeight?: number;
  gravityEnabled?: boolean;
  collisionsEnabled?: boolean;
  externalControl?: boolean;
};

export type CharacterPhysicsUpdateParams = {
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  deltaTime: number;
};

export class CharacterPhysicsController {
  readonly mesh: Mesh;
  readonly collisionRadius: number;
  readonly collisionHeight: number;

  private velocity: Vector3 = Vector3.Zero();
  private grounded = false;
  private gravityEnabled: boolean;
  private collisionsEnabled: boolean;
  private externalControl: boolean;

  constructor(mesh: Mesh, options: CharacterPhysicsOptions = {}) {
    this.mesh = mesh;
    this.collisionRadius = options.collisionRadius ?? PLAYER_RADIUS;
    this.collisionHeight = options.collisionHeight ?? PLAYER_HEIGHT;
    this.gravityEnabled = options.gravityEnabled ?? true;
    this.collisionsEnabled = options.collisionsEnabled ?? true;
    this.externalControl = options.externalControl ?? false;
  }

  setExternalControl(enabled: boolean): void {
    this.externalControl = enabled;

    if (enabled) {
      this.velocity.setAll(0);
      this.grounded = false;
    }
  }

  setGravityEnabled(enabled: boolean): void {
    this.gravityEnabled = enabled;
  }

  setCollisionsEnabled(enabled: boolean): void {
    this.collisionsEnabled = enabled;
  }

  setVelocity(velocity: Vector3): void {
    this.velocity.copyFrom(velocity);
  }

  isGrounded(): boolean {
    return this.grounded;
  }

  teleport(position: Vector3): void {
    this.mesh.position.copyFrom(position);
    this.velocity.setAll(0);
    this.grounded = false;
  }

  update(params: CharacterPhysicsUpdateParams): void {
    if (this.externalControl) {
      return;
    }

    const { worldChunks, sizeX, sizeY, sizeZ, deltaTime } = params;

    if (this.gravityEnabled) {
      this.velocity.y += GRAVITY * deltaTime;
    }

    const deltaMove = this.velocity.scale(deltaTime);

    if (!this.collisionsEnabled) {
      this.mesh.position.addInPlace(deltaMove);
      return;
    }

    const nextX = this.mesh.position.add(new Vector3(deltaMove.x, 0, 0));

    if (!hasCollisionAtWithExtents(worldChunks, sizeX, sizeY, sizeZ, nextX, this.collisionRadius, this.collisionHeight)) {
      this.mesh.position.x = nextX.x;
    } else {
      this.velocity.x = 0;
    }

    const nextZ = this.mesh.position.add(new Vector3(0, 0, deltaMove.z));

    if (!hasCollisionAtWithExtents(worldChunks, sizeX, sizeY, sizeZ, nextZ, this.collisionRadius, this.collisionHeight)) {
      this.mesh.position.z = nextZ.z;
    } else {
      this.velocity.z = 0;
    }

    const nextY = this.mesh.position.add(new Vector3(0, deltaMove.y, 0));

    if (!hasCollisionAtWithExtents(worldChunks, sizeX, sizeY, sizeZ, nextY, this.collisionRadius, this.collisionHeight)) {
      this.mesh.position.y = nextY.y;
      this.grounded = false;
    } else {
      if (deltaMove.y < 0) {
        this.grounded = true;
      }

      this.velocity.y = 0;
    }
  }
}

export function resolvePlayerCharacterCollision(
  player: PlayerPhysics,
  character: CharacterPhysicsController,
): boolean {
  const charPos = character.mesh.position;
  const playerMinY = player.position.y;
  const playerMaxY = player.position.y + PLAYER_HEIGHT;
  const charMinY = charPos.y;
  const charMaxY = charPos.y + character.collisionHeight;

  if (playerMaxY <= charMinY || playerMinY >= charMaxY) {
    return false;
  }

  const dx = player.position.x - charPos.x;
  const dz = player.position.z - charPos.z;
  const minDistance = PLAYER_RADIUS + character.collisionRadius;
  const distanceSquared = (dx * dx) + (dz * dz);

  if (distanceSquared >= minDistance * minDistance) {
    return false;
  }

  const distance = Math.sqrt(distanceSquared);
  const safeDistance = distance > 1e-5 ? distance : 1e-5;
  const pushDistance = minDistance - safeDistance;

  const normalX = distance > 1e-5 ? dx / safeDistance : Math.sin(player.yaw);
  const normalZ = distance > 1e-5 ? dz / safeDistance : Math.cos(player.yaw);

  player.position.x += normalX * pushDistance;
  player.position.z += normalZ * pushDistance;
  player.velocity.x = 0;
  player.velocity.z = 0;

  return true;
}

export function syncCameraToPlayerPosition(player: PlayerPhysics, cameraPosition: Vector3): void {
  cameraPosition.copyFrom(player.position.add(new Vector3(0, EYE_HEIGHT, 0)));
}
