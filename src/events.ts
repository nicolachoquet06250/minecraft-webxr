import type { Engine, Scene, StandardMaterial } from "@babylonjs/core";
import { MOUSE_SENSIBILITY, pressedKeys } from "./constants";
import type { PlayerPhysics, WorldChunks, DroppedItem } from "./types";
import {
  cancelBlockBreaking,
  startBlockBreaking,
} from "./block-breaking";
import { placeBlock } from "./textured-world";
import { isMobileMode } from "./mobile-controls";
import { isCraftingOverlayOpen } from "./ui-state";

const MIN_PITCH = -Math.PI / 2 + 0.05;
const MAX_PITCH = Math.PI / 2 - 0.05;
const MAX_MOUSE_DELTA = 80;
const MAX_TRUSTED_MOUSE_DELTA = 500;

function handleResize(engine: Engine) {
    return () => engine.resize();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function sanitizeMouseDelta(delta: number): number {
  if (!Number.isFinite(delta)) {
    return 0;
  }

  if (Math.abs(delta) > MAX_TRUSTED_MOUSE_DELTA) {
    return 0;
  }

  return clamp(delta, -MAX_MOUSE_DELTA, MAX_MOUSE_DELTA);
}

function clearMovementKeys(): void {
  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyA");
  pressedKeys.delete("KeyS");
  pressedKeys.delete("KeyD");
  pressedKeys.delete("Space");
  pressedKeys.delete("ArrowUp");
  pressedKeys.delete("ArrowDown");
  pressedKeys.delete("ArrowLeft");
  pressedKeys.delete("ArrowRight");
}

function handleKeyDown(event: KeyboardEvent) {
  if (isCraftingOverlayOpen()) {
    clearMovementKeys();
    cancelBlockBreaking();

    if (event.code !== "KeyE" && event.code !== "Escape") {
      event.preventDefault();
    }

    return;
  }

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
}

function handleKeyUp(event: KeyboardEvent) {
    pressedKeys.delete(event.code);
}

function handleMouseMove(canvas: HTMLCanvasElement, player: PlayerPhysics): (e: MouseEvent) => any {
    return function (event) {
        if (isCraftingOverlayOpen()) {
            return;
        }

        if (document.pointerLockElement !== canvas) {
            return;
        }

        const movementX = sanitizeMouseDelta(event.movementX);
        const movementY = sanitizeMouseDelta(event.movementY);

        player.yaw = normalizeAngle(player.yaw + movementX * MOUSE_SENSIBILITY);
        player.pitch = clamp(
          player.pitch + movementY * MOUSE_SENSIBILITY,
          MIN_PITCH,
          MAX_PITCH,
        );
    }
}

function getBreakingParams(
  scene: Scene,
  player: PlayerPhysics,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
  droppedItems: DroppedItem[],
) {
  return {
    scene,
    player,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    material,
    droppedItems,
    onBlockMutated: (player as PlayerPhysics & {
      _onLocalBlockMutated?: (worldX: number, worldY: number, worldZ: number, blockId: number) => void;
    })._onLocalBlockMutated,
  };
}

export default function (
  engine: Engine,
  player: PlayerPhysics,
  canvas: HTMLCanvasElement,
  scene: Scene,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
  droppedItems: DroppedItem[],
) {
  new ResizeObserver(handleResize(engine)).observe(window.document.body);

  const breakingParams = getBreakingParams(
    scene,
    player,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    material,
    droppedItems,
  );
  let primaryBreakButtonPressed = false;

  window.addEventListener("keydown", handleKeyDown);

  window.addEventListener("keyup", handleKeyUp);

  window.addEventListener("mousemove", handleMouseMove(canvas, player));

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== canvas) {
      cancelBlockBreaking();
      return;
    }

    if (primaryBreakButtonPressed && !isCraftingOverlayOpen() && !isMobileMode()) {
      startBlockBreaking(breakingParams);
    }
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("pointerdown", async (event) => {
    if (isCraftingOverlayOpen()) {
      clearMovementKeys();
      cancelBlockBreaking();
      return;
    }

    if (isMobileMode()) {
      return;
    }

    if (event.button === 2) {
      event.preventDefault();

      if (document.pointerLockElement !== canvas) {
        return;
      }

      placeBlock(breakingParams);
      return;
    }

    if (event.button !== 0) {
      return;
    }

    primaryBreakButtonPressed = true;

    if (document.pointerLockElement !== canvas) {
      await canvas.requestPointerLock();
      return;
    }

    startBlockBreaking(breakingParams);
  });

  window.addEventListener("pointerup", (event) => {
    if (event.button === 0) {
      primaryBreakButtonPressed = false;
      cancelBlockBreaking();
    }
  });

  window.addEventListener("blur", () => {
    primaryBreakButtonPressed = false;
    cancelBlockBreaking();
  });

  canvas.addEventListener("touchstart", (e) => {
    if (isCraftingOverlayOpen()) {
      clearMovementKeys();
      cancelBlockBreaking();
      if (e.cancelable) {
        e.preventDefault();
      }
      return;
    }

    if (isMobileMode()) {
        console.log("Canvas touchstart received - blocking destruction on mobile");
        if (e.cancelable) {
            e.preventDefault();
        }
    }
  }, { passive: false });
}
