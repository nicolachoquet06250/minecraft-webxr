import {
  type Scene,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { pressedKeys } from "./constants";
import type { PlayerPhysics } from "./types";

const MOBILE_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

const MOVE_JOYSTICK_RADIUS_Y = 80;
// @ts-ignore
const MOVE_JOYSTICK_IDLE_THUMB_Y = -50;
const MOVE_JOYSTICK_LEFT = 30;
const MOVE_JOYSTICK_BOTTOM = 140;

const LOOK_JOYSTICK_SIZE = 180;
const LOOK_JOYSTICK_RADIUS = 75;
const LOOK_JOYSTICK_RIGHT = 30;
const LOOK_JOYSTICK_BOTTOM = 140;

const JUMP_BUTTON_SIZE = 90;
const JUMP_BUTTON_RIGHT = 60;
const JUMP_BUTTON_BOTTOM = 40;

// @ts-ignore
const MOVE_THUMB_SIZE = 60;
const LOOK_THUMB_SIZE = 60;
const MOVE_DEAD_ZONE = 0.18;
const LOOK_DEAD_ZONE = 0.08;
const LOOK_SPEED = 2.6;
const MIN_PITCH = -Math.PI / 2 + 0.05;
const MAX_PITCH = Math.PI / 2 - 0.05;

type Point = {
  x: number;
  y: number;
};

type JoystickState = {
  pointerId: number | null;
  origin: Point;
  x: number;
  y: number;
};

export function isMobileMode(): boolean {
  const isMobile = (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia(MOBILE_MEDIA_QUERY).matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );

  // On exclut les casques VR (ex: Oculus/Meta Quest) de la détection mobile pour garder le bouton VR
  const isVRHeadset = /Oculus|Quest|Pico|Vive|Hololens/i.test(navigator.userAgent);

  return isMobile && !isVRHeadset;
}

export function isVRMode(): boolean {
  const isMobile = (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia(MOBILE_MEDIA_QUERY).matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );

  // On exclut les casques VR (ex: Oculus/Meta Quest) de la détection mobile pour garder le bouton VR
  const isVRHeadset = /Oculus|Quest|Pico|Vive|Hololens/i.test(navigator.userAgent);

  return isMobile && isVRHeadset;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moveThumb(thumb: Control, x: number, y: number, radiusX: number, radiusY: number): void {
  thumb.left = `${x * radiusX}px`;
  thumb.top = `${y * radiusY}px`;
}

function createLookJoystick(name: string): { root: Ellipse; thumb: Ellipse } {
  const root = new Ellipse(`${name}-root`);
  root.width = `${LOOK_JOYSTICK_SIZE}px`;
  root.height = `${LOOK_JOYSTICK_SIZE}px`;
  root.thickness = 2;
  root.color = "rgba(255, 255, 255, 0.45)";
  root.background = "rgba(0, 0, 0, 0.22)";
  root.alpha = 0.92;
  root.isPointerBlocker = true;

  const thumb = new Ellipse(`${name}-thumb`);
  thumb.width = `${LOOK_THUMB_SIZE}px`;
  thumb.height = `${LOOK_THUMB_SIZE}px`;
  thumb.thickness = 2;
  thumb.color = "rgba(255, 255, 255, 0.55)";
  thumb.background = "rgba(255, 255, 255, 0.28)";
  thumb.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  thumb.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  thumb.isPointerBlocker = false;

  root.addControl(thumb);

  return { root, thumb };
}

function createMoveJoystick(name: string): { root: Rectangle; thumb: Ellipse } {
  const root = new Rectangle(`${name}-root`);
  root.cornerRadius = 20;
  root.width = `${LOOK_JOYSTICK_SIZE / 2}px`;
  root.height = `${LOOK_JOYSTICK_SIZE}px`;
  root.thickness = 2;
  root.color = "rgba(255, 255, 255, 0.45)";
  root.background = "rgba(0, 0, 0, 0.22)";
  root.alpha = 0.92;
  root.isPointerBlocker = true;

  const thumb = new Ellipse(`${name}-thumb`);
  thumb.width = `${LOOK_THUMB_SIZE}px`;
  thumb.height = `${LOOK_THUMB_SIZE}px`;
  thumb.thickness = 2;
  thumb.color = "rgba(255, 255, 255, 0.55)";
  thumb.background = "rgba(255, 255, 255, 0.28)";
  thumb.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  thumb.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  thumb.isPointerBlocker = false;

  root.addControl(thumb);

  return { root, thumb };
}

function createJumpButton(): Ellipse {
  const button = new Ellipse("mobile-jump-button");
  button.width = `${JUMP_BUTTON_SIZE}px`;
  button.height = `${JUMP_BUTTON_SIZE}px`;
  button.thickness = 2;
  button.color = "rgba(255, 255, 255, 0.5)";
  button.background = "rgba(0, 0, 0, 0.3)";
  button.alpha = 0.94;
  button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  button.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  button.left = `-${JUMP_BUTTON_RIGHT}px`;
  button.top = `-${JUMP_BUTTON_BOTTOM}px`;
  button.isPointerBlocker = true;

  const label = new TextBlock("mobile-jump-label");
  label.text = "↥";
  label.color = "white";
  label.fontSize = 32;
  label.fontWeight = "700";
  label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  label.isPointerBlocker = false;

  button.addControl(label);

  return button;
}

function resetMoveState(thumb: Control, state: JoystickState): void {
  state.pointerId = null;
  state.x = 0;
  state.y = 0;
  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyS");
  thumb.left = "0px";
  thumb.top = "0px";
}

function updateMoveKeys(y: number): void {
  if (y < -MOVE_DEAD_ZONE) {
    pressedKeys.add("KeyW");
    pressedKeys.delete("KeyS");
    return;
  }

  if (y > MOVE_DEAD_ZONE) {
    pressedKeys.add("KeyS");
    pressedKeys.delete("KeyW");
    return;
  }

  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyS");
}

function resetLookState(thumb: Control, state: JoystickState): void {
  state.pointerId = null;
  state.x = 0;
  state.y = 0;
  moveThumb(thumb, 0, 0, LOOK_JOYSTICK_RADIUS, LOOK_JOYSTICK_RADIUS);
}

export default function initializeMobileControls(
  scene: Scene,
  player: PlayerPhysics,
): void {
  if (!isMobileMode()) {
    return;
  }

  const ui = AdvancedDynamicTexture.CreateFullscreenUI(
    "mobile-controls-ui",
    true,
    scene,
  );
  ui.renderAtIdealSize = true;
  ui.idealWidth = 1280;
  ui.idealHeight = 720;

  const moveJoystick = createMoveJoystick("mobile-move-joystick");
  moveJoystick.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  moveJoystick.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  moveJoystick.root.left = `${MOVE_JOYSTICK_LEFT}px`;
  moveJoystick.root.top = `-${MOVE_JOYSTICK_BOTTOM}px`;
  ui.addControl(moveJoystick.root);

  const lookJoystick = createLookJoystick("mobile-look-joystick");
  lookJoystick.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  lookJoystick.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  lookJoystick.root.left = `-${LOOK_JOYSTICK_RIGHT}px`;
  lookJoystick.root.top = `-${LOOK_JOYSTICK_BOTTOM}px`;
  ui.addControl(lookJoystick.root);

  const jumpButton = createJumpButton();
  ui.addControl(jumpButton);

  const moveState: JoystickState = {
    pointerId: null,
    origin: { x: 0, y: 0 },
    x: 0,
    y: 0,
  };

  const lookState: JoystickState = {
    pointerId: null,
    origin: { x: 0, y: 0 },
    x: 0,
    y: 0,
  };

  let jumpPointerId: number | null = null;

  // Jump Button Events
  jumpButton.onPointerDownObservable.add((coordinates: any) => {
    if (jumpPointerId === null) {
      jumpPointerId = coordinates.pointerId;
      pressedKeys.add("Space");
      jumpButton.background = "rgba(255, 255, 255, 0.4)";
    }
  });

  const resetJump = (pointerId: number) => {
    if (jumpPointerId === pointerId) {
      jumpPointerId = null;
      pressedKeys.delete("Space");
      jumpButton.background = "rgba(0, 0, 0, 0.3)";
    }
  };

  jumpButton.onPointerUpObservable.add((coordinates: any) => {
    resetJump(coordinates.pointerId);
  });

  jumpButton.onPointerOutObservable.add((coordinates: any) => {
    resetJump(coordinates.pointerId);
  });

  // Move Joystick Events
  moveJoystick.root.onPointerDownObservable.add((coordinates: any) => {
    if (moveState.pointerId === null) {
      moveState.pointerId = coordinates.pointerId;
      moveState.origin = { x: coordinates.x, y: coordinates.y };
    }
  });

  moveJoystick.root.onPointerMoveObservable.add((coordinates: any) => {
    if (moveState.pointerId === coordinates.pointerId) {
      const y = clamp(
        (coordinates.y - moveState.origin.y) / MOVE_JOYSTICK_RADIUS_Y,
        -1,
        1,
      );
      moveState.x = 0;
      moveState.y = y;
      updateMoveKeys(moveState.y);
      moveThumb(moveJoystick.thumb, 0, moveState.y, 0, MOVE_JOYSTICK_RADIUS_Y);
    }
  });

  const endMove = (pointerId: number) => {
    if (moveState.pointerId === pointerId) {
      resetMoveState(moveJoystick.thumb, moveState);
    }
  };

  moveJoystick.root.onPointerUpObservable.add((coordinates: any) => endMove(coordinates.pointerId));

  // Look Joystick Events
  lookJoystick.root.onPointerDownObservable.add((coordinates: any) => {
    if (lookState.pointerId === null) {
      lookState.pointerId = coordinates.pointerId;
      lookState.origin = { x: coordinates.x, y: coordinates.y };
    }
  });

  lookJoystick.root.onPointerMoveObservable.add((coordinates: any) => {
    if (lookState.pointerId === coordinates.pointerId) {
      const rawX = (coordinates.x - lookState.origin.x) / LOOK_JOYSTICK_RADIUS;
      const rawY = (coordinates.y - lookState.origin.y) / LOOK_JOYSTICK_RADIUS;
      const length = Math.hypot(rawX, rawY);
      const normalizedLength = Math.min(length, 1);

      if (length > 0) {
        lookState.x = (rawX / length) * normalizedLength;
        lookState.y = (rawY / length) * normalizedLength;
      } else {
        lookState.x = 0;
        lookState.y = 0;
      }

      moveThumb(lookJoystick.thumb, lookState.x, lookState.y, LOOK_JOYSTICK_RADIUS, LOOK_JOYSTICK_RADIUS);
    }
  });

  const endLook = (pointerId: number) => {
    if (lookState.pointerId === pointerId) {
      resetLookState(lookJoystick.thumb, lookState);
    }
  };

  lookJoystick.root.onPointerUpObservable.add((coordinates: any) => endLook(coordinates.pointerId));

  scene.onBeforeRenderObservable.add(() => {
    const deltaTime = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);

    if (
      lookState.pointerId !== null &&
      (Math.abs(lookState.x) > LOOK_DEAD_ZONE || Math.abs(lookState.y) > LOOK_DEAD_ZONE)
    ) {
      player.yaw += lookState.x * LOOK_SPEED * deltaTime;
      player.pitch = clamp(
        player.pitch + lookState.y * LOOK_SPEED * deltaTime,
        MIN_PITCH,
        MAX_PITCH,
      );
    }
  });
}
