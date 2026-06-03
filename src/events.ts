import type { Engine } from "@babylonjs/core";
import { MOUSE_SENSIBILITY, pressedKeys } from "./constants";
import type { PlayerPhysics } from "./types";

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

function handleClick(canvas: HTMLCanvasElement): (e: MouseEvent) => any {
    return async function () {
        await canvas.requestPointerLock();
    }
}

export default function (engine: Engine, player: PlayerPhysics, canvas: HTMLCanvasElement) {
    new ResizeObserver(handleResize(engine)).observe(window.document.body);
    
    window.addEventListener("keydown", handleKeyDown);
    
    window.addEventListener("keyup", handleKeyUp);
    
    window.addEventListener("mousemove", handleMouseMove(canvas, player));
    
    canvas.addEventListener("click", handleClick(canvas));
}