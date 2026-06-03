import {
  PointerEventTypes,
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

const MOVE_JOYSTICK_WIDTH = 58;
const MOVE_JOYSTICK_HEIGHT = 114;
const MOVE_JOYSTICK_RADIUS_Y = 50;
// @ts-ignore
const MOVE_JOYSTICK_IDLE_THUMB_Y = -34;
const MOVE_JOYSTICK_LEFT = 28;
const MOVE_JOYSTICK_BOTTOM = 88;

const LOOK_JOYSTICK_SIZE = 112;
const LOOK_JOYSTICK_RADIUS = 46;
const LOOK_JOYSTICK_RIGHT = 22;
const LOOK_JOYSTICK_BOTTOM = 106;

const JUMP_BUTTON_SIZE = 58;
const JUMP_BUTTON_RIGHT = 49;
const JUMP_BUTTON_BOTTOM = 8;

// @ts-ignore
const MOVE_THUMB_SIZE = 50;
const LOOK_THUMB_SIZE = 42;
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

type EllipseZone = {
  center: Point;
  radiusX: number;
  radiusY: number;
};

function isMobileMode(): boolean {
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia(MOBILE_MEDIA_QUERY).matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getViewportSize(scene: Scene): { width: number; height: number } {
  const engine = scene.getEngine();
  const canvas = engine.getRenderingCanvas();

  if (canvas) {
    const rect = canvas.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight(),
  };
}

function getPointerPosition(scene: Scene, event: PointerEvent): Point | null {
  const canvas = scene.getEngine().getRenderingCanvas();

  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function containsPoint(zone: EllipseZone, point: Point): boolean {
  const normalizedX = (point.x - zone.center.x) / zone.radiusX;
  const normalizedY = (point.y - zone.center.y) / zone.radiusY;

  return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
}

function getMoveJoystickZone(scene: Scene): EllipseZone {
  const viewport = getViewportSize(scene);

  return {
    center: {
      x: MOVE_JOYSTICK_LEFT + MOVE_JOYSTICK_WIDTH / 2,
      y: viewport.height - MOVE_JOYSTICK_BOTTOM - MOVE_JOYSTICK_HEIGHT / 2,
    },
    radiusX: MOVE_JOYSTICK_WIDTH / 2,
    radiusY: MOVE_JOYSTICK_HEIGHT / 2,
  };
}

function getLookJoystickZone(scene: Scene): EllipseZone {
  const viewport = getViewportSize(scene);

  return {
    center: {
      x: viewport.width - LOOK_JOYSTICK_RIGHT - LOOK_JOYSTICK_SIZE / 2,
      y: viewport.height - LOOK_JOYSTICK_BOTTOM - LOOK_JOYSTICK_SIZE / 2,
    },
    radiusX: LOOK_JOYSTICK_SIZE / 2,
    radiusY: LOOK_JOYSTICK_SIZE / 2,
  };
}

function getJumpButtonZone(scene: Scene): EllipseZone {
  const viewport = getViewportSize(scene);

  return {
    center: {
      x: viewport.width - JUMP_BUTTON_RIGHT - JUMP_BUTTON_SIZE / 2,
      y: viewport.height - JUMP_BUTTON_BOTTOM - JUMP_BUTTON_SIZE / 2,
    },
    radiusX: JUMP_BUTTON_SIZE / 2,
    radiusY: JUMP_BUTTON_SIZE / 2,
  };
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
  root.isPointerBlocker = false;

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

function createMoveJoystick(): { root: Rectangle; thumb: Ellipse } {
  const root = new Rectangle(`${name}-root`);
  root.cornerRadius = 20;
  root.width = `${LOOK_JOYSTICK_SIZE / 2}px`;
  root.height = `${LOOK_JOYSTICK_SIZE}px`;
  root.thickness = 2;
  root.color = "rgba(255, 255, 255, 0.45)";
  root.background = "rgba(0, 0, 0, 0.22)";
  root.alpha = 0.92;
  root.isPointerBlocker = false;

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
  button.isPointerBlocker = false;

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
  ui.idealWidth = 1920;
  ui.idealHeight = 1080;

  const moveJoystick = createMoveJoystick();
  moveJoystick.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  moveJoystick.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  moveJoystick.root.left = `${MOVE_JOYSTICK_LEFT}px`;
  moveJoystick.root.top = `-${MOVE_JOYSTICK_BOTTOM}px`;
  ui.addControl(moveJoystick.root);

  const lookJoystick = createLookJoystick("mobile-look-joystick");
  lookJoystick.root.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  lookJoystick.root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  lookJoystick.root.left = `-${LOOK_JOYSTICK_RIGHT}px`;
  lookJoystick.root.top = `-${LOOK_JOYSTICK_BOTTOM - 15}px`;
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

  scene.onPointerObservable.add((pointerInfo) => {
    const event = pointerInfo.event as PointerEvent;
    const position = getPointerPosition(scene, event);

    if (!position) {
      return;
    }

    if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
      if (moveState.pointerId === null && containsPoint(getMoveJoystickZone(scene), position)) {
        moveState.pointerId = event.pointerId;
        moveState.origin = position;
        event.preventDefault();
        return;
      }

      if (lookState.pointerId === null && containsPoint(getLookJoystickZone(scene), position)) {
        lookState.pointerId = event.pointerId;
        lookState.origin = position;
        event.preventDefault();
        return;
      }

      if (jumpPointerId === null && containsPoint(getJumpButtonZone(scene), position)) {
        jumpPointerId = event.pointerId;
        pressedKeys.add("Space");
        event.preventDefault();
      }

      return;
    }

    if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
      if (moveState.pointerId === event.pointerId) {
        const y = clamp(
          (position.y - moveState.origin.y) / MOVE_JOYSTICK_RADIUS_Y,
          -1,
          1,
        );

        moveState.x = 0;
        moveState.y = y;
        updateMoveKeys(moveState.y);
        moveThumb(moveJoystick.thumb, 0, moveState.y, 0, MOVE_JOYSTICK_RADIUS_Y);
        event.preventDefault();
        return;
      }

      if (lookState.pointerId === event.pointerId) {
        const rawX = (position.x - lookState.origin.x) / LOOK_JOYSTICK_RADIUS;
        const rawY = (position.y - lookState.origin.y) / LOOK_JOYSTICK_RADIUS;
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
        event.preventDefault();
      }

      return;
    }

    if (
      pointerInfo.type === PointerEventTypes.POINTERUP ||
      pointerInfo.type === PointerEventTypes.POINTERDOUBLETAP
    ) {
      if (moveState.pointerId === event.pointerId) {
        resetMoveState(moveJoystick.thumb, moveState);
        event.preventDefault();
      }

      if (lookState.pointerId === event.pointerId) {
        resetLookState(lookJoystick.thumb, lookState);
        event.preventDefault();
      }

      if (jumpPointerId === event.pointerId) {
        jumpPointerId = null;
        pressedKeys.delete("Space");
        event.preventDefault();
      }
    }
  });

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
