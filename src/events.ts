import type { Engine, Scene, StandardMaterial } from "@babylonjs/core";
import { MOUSE_SENSIBILITY, pressedKeys } from "./constants";
import type { PlayerPhysics, WorldChunks, DroppedItem } from "./types";
import { breakBlock } from "./textured-world";
import { isMobileMode } from "./mobile-controls";
import { isCraftingOverlayOpen } from "./ui-state";

function handleResize(engine: Engine) {
    return () => engine.resize();
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

        player.yaw += event.movementX * MOUSE_SENSIBILITY;
        player.pitch += event.movementY * MOUSE_SENSIBILITY;
    }
}

function handleClick(
  canvas: HTMLCanvasElement,
  scene: Scene,
  player: PlayerPhysics,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
  droppedItems: DroppedItem[],
): (e: MouseEvent) => any {
  return async function () {
    if (isCraftingOverlayOpen()) {
      clearMovementKeys();
      return;
    }

    if (document.pointerLockElement !== canvas) {
      await canvas.requestPointerLock();
    } else {
      breakBlock({
        scene,
        player,
        worldChunks,
        sizeX,
        sizeY,
        sizeZ,
        material,
        droppedItems,
      });
    }
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

  window.addEventListener("keydown", handleKeyDown);

  window.addEventListener("keyup", handleKeyUp);

  window.addEventListener("mousemove", handleMouseMove(canvas, player));

  canvas.addEventListener(
    "click",
    (e) => {
      if (isCraftingOverlayOpen()) {
        clearMovementKeys();
        return;
      }

      if (isMobileMode()) {
        console.log("Canvas click blocked on mobile");
        return;
      }
      handleClick(canvas, scene, player, worldChunks, sizeX, sizeY, sizeZ, material, droppedItems)(e);
    }
  );

  canvas.addEventListener("touchstart", (e) => {
    if (isCraftingOverlayOpen()) {
      clearMovementKeys();
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
