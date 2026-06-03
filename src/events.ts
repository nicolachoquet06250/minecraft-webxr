import type { Engine, Scene, StandardMaterial } from "@babylonjs/core";
import { MOUSE_SENSIBILITY, pressedKeys } from "./constants";
import type { PlayerPhysics, WorldChunks, DroppedItem } from "./types";
import { breakBlock } from "./functions";
import { isMobileMode } from "./mobile-controls";

function handleResize(engine: Engine) {
    return () => engine.resize();
}

function handleKeyDown(event: KeyboardEvent) {
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
      if (isMobileMode()) {
        console.log("Canvas click blocked on mobile");
        return;
      }
      handleClick(canvas, scene, player, worldChunks, sizeX, sizeY, sizeZ, material, droppedItems)(e);
    }
  );

  // Add touchstart listener to prevent default browser behavior that might trigger synthetic clicks
  canvas.addEventListener("touchstart", () => {
    if (isMobileMode()) {
        console.log("Canvas touchstart received - blocking destruction on mobile");
        // if (e.cancelable) {
        //     e.preventDefault();
        // }
    }
  }, { passive: true });
}