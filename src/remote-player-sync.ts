import type { Scene } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { createSteve } from "~/characters";
import type { PlayerPublicState, PlayerTransformPayload } from "./multiplayer-client";

const REMOTE_TRANSFORM_SMOOTHING_SPEED = 18;
const REMOTE_TRANSFORM_SNAP_DISTANCE_SQUARED = 16;
const REMOTE_PLAYER_STALE_MS = 10_000;
const REMOTE_WALK_SPEED_THRESHOLD = 0.05;
const REMOTE_WALK_DISTANCE_THRESHOLD_SQUARED = 0.0004;

type RemotePlayerVisual = {
  mesh: import("@babylonjs/core").Mesh;
  animator: {
    play: (animationName: string, loop?: boolean, speed?: number) => void;
    getCurrentAnimation: () => string | null;
    dispose: () => void;
  };
  current: PlayerTransformPayload;
  target: PlayerTransformPayload;
  previousAppliedPosition: [number, number, number];
  lastReceivedAtMs: number;
  lastAppliedAtMs: number;
};

export type RemotePlayerSyncManager = {
  upsert: (playerState: PlayerPublicState) => void;
  remove: (playerId: string) => void;
  reconcile: (players: PlayerPublicState[]) => void;
  update: (deltaTime: number) => void;
  dispose: () => void;
};

export function createRemotePlayerSyncManager(
  scene: Scene,
  getLocalPlayerId: () => string | null,
): RemotePlayerSyncManager {
  const remotePlayers = new Map<string, RemotePlayerVisual>();

  const upsert = (playerState: PlayerPublicState): void => {
    if (playerState.player_id === getLocalPlayerId()) {
      return;
    }

    const now = performance.now();
    let remote = remotePlayers.get(playerState.player_id);

    if (!remote) {
      const spawnPosition = transformPosition(playerState.transform);
      const { mesh, animator } = createSteve(scene, spawnPosition, {
        physics: {
          externalControl: true,
          gravityEnabled: false,
          collisionsEnabled: false,
        },
      });

      remote = {
        mesh,
        animator,
        current: cloneTransform(playerState.transform),
        target: cloneTransform(playerState.transform),
        previousAppliedPosition: [...playerState.transform.position] as [number, number, number],
        lastReceivedAtMs: now,
        lastAppliedAtMs: now,
      };
      remotePlayers.set(playerState.player_id, remote);
      applyTransform(remote, remote.current);
      updateAnimation(remote);
      return;
    }

    remote.target = cloneTransform(playerState.transform);
    remote.lastReceivedAtMs = now;
  };

  const remove = (playerId: string): void => {
    const remote = remotePlayers.get(playerId);

    if (!remote) {
      return;
    }

    remote.animator.dispose();
    remote.mesh.dispose();
    remotePlayers.delete(playerId);
  };

  const reconcile = (players: PlayerPublicState[]): void => {
    const alivePlayerIds = new Set<string>();

    for (const playerState of players) {
      alivePlayerIds.add(playerState.player_id);
      upsert(playerState);
    }

    for (const playerId of [...remotePlayers.keys()]) {
      if (!alivePlayerIds.has(playerId)) {
        remove(playerId);
      }
    }
  };

  const update = (deltaTime: number): void => {
    const now = performance.now();
    const amount = Math.min(1, deltaTime * REMOTE_TRANSFORM_SMOOTHING_SPEED);

    for (const [playerId, remote] of [...remotePlayers.entries()]) {
      if (now - remote.lastReceivedAtMs > REMOTE_PLAYER_STALE_MS) {
        remove(playerId);
        continue;
      }

      if (squaredDistance(remote.current.position, remote.target.position) > REMOTE_TRANSFORM_SNAP_DISTANCE_SQUARED) {
        remote.current = cloneTransform(remote.target);
      } else {
        remote.current = interpolateTransform(remote.current, remote.target, amount);
      }

      remote.lastAppliedAtMs = now;
      applyTransform(remote, remote.current);
      updateAnimation(remote);
      remote.previousAppliedPosition = [...remote.current.position] as [number, number, number];
    }
  };

  const dispose = (): void => {
    for (const playerId of [...remotePlayers.keys()]) {
      remove(playerId);
    }
  };

  return {
    upsert,
    remove,
    reconcile,
    update,
    dispose,
  };
}

function transformPosition(transform: PlayerTransformPayload): Vector3 {
  return new Vector3(
    transform.position[0],
    transform.position[1],
    transform.position[2],
  );
}

function cloneTransform(transform: PlayerTransformPayload): PlayerTransformPayload {
  return {
    position: [...transform.position] as [number, number, number],
    rotation: [...transform.rotation] as [number, number],
    velocity: [...transform.velocity] as [number, number, number],
  };
}

function applyTransform(remote: RemotePlayerVisual, transform: PlayerTransformPayload): void {
  remote.mesh.position.copyFromFloats(
    transform.position[0],
    transform.position[1],
    transform.position[2],
  );
  remote.mesh.rotation.y = transform.rotation[0];
}

function updateAnimation(remote: RemotePlayerVisual): void {
  const horizontalVelocitySpeed = Math.hypot(remote.target.velocity[0], remote.target.velocity[2]);
  const targetDistanceSquared = squaredDistance(remote.current.position, remote.target.position);
  const appliedDistanceSquared = squaredDistance(remote.previousAppliedPosition, remote.current.position);
  const isMoving = horizontalVelocitySpeed > REMOTE_WALK_SPEED_THRESHOLD
    || targetDistanceSquared > REMOTE_WALK_DISTANCE_THRESHOLD_SQUARED
    || appliedDistanceSquared > REMOTE_WALK_DISTANCE_THRESHOLD_SQUARED;
  const targetAnimation = isMoving ? "walk" : "idle";

  if (remote.animator.getCurrentAnimation() !== targetAnimation) {
    remote.animator.play(targetAnimation, true);
  }
}

function interpolateTransform(
  current: PlayerTransformPayload,
  target: PlayerTransformPayload,
  amount: number,
): PlayerTransformPayload {
  return {
    position: [
      lerp(current.position[0], target.position[0], amount),
      lerp(current.position[1], target.position[1], amount),
      lerp(current.position[2], target.position[2], amount),
    ],
    rotation: [
      lerpAngle(current.rotation[0], target.rotation[0], amount),
      lerpAngle(current.rotation[1], target.rotation[1], amount),
    ],
    velocity: [
      lerp(current.velocity[0], target.velocity[0], amount),
      lerp(current.velocity[1], target.velocity[1], amount),
      lerp(current.velocity[2], target.velocity[2], amount),
    ],
  };
}

function squaredDistance(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];

  return dx * dx + dy * dy + dz * dz;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function lerpAngle(from: number, to: number, amount: number): number {
  return from + shortestAngleDelta(from, to) * amount;
}

function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);

  if (delta > Math.PI) {
    delta -= Math.PI * 2;
  } else if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }

  return delta;
}
