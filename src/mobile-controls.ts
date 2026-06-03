import { pressedKeys } from "./constants";
import type { PlayerPhysics } from "./types";

const MOBILE_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";
const MOVE_JOYSTICK_RADIUS = 70;
const LOOK_JOYSTICK_RADIUS = 58;
const MOVE_DEAD_ZONE = 0.18;
const LOOK_DEAD_ZONE = 0.08;
const LOOK_SPEED = 2.6;
const MIN_PITCH = -Math.PI / 2 + 0.05;
const MAX_PITCH = Math.PI / 2 - 0.05;

type JoystickState = {
  pointerId: number | null;
  originX: number;
  originY: number;
  x: number;
  y: number;
};

function isMobileMode(): boolean {
  return (
    navigator.maxTouchPoints > 0 &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function setJoystickThumb(
  thumb: HTMLElement,
  x: number,
  y: number,
  radius: number,
): void {
  thumb.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
}

function createControlElement(className: string, label: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;
  element.setAttribute("aria-label", label);
  element.setAttribute("role", "button");

  return element;
}

function resetMoveState(thumb: HTMLElement, state: JoystickState): void {
  state.pointerId = null;
  state.x = 0;
  state.y = 0;
  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyS");
  setJoystickThumb(thumb, 0, 0, MOVE_JOYSTICK_RADIUS);
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

function bindVerticalMoveJoystick(root: HTMLElement): void {
  const thumb = root.querySelector<HTMLElement>(".mobile-controls__thumb");

  if (!thumb) {
    throw new Error("Thumb du joystick mobile gauche introuvable");
  }

  const state: JoystickState = {
    pointerId: null,
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
  };

  root.addEventListener("pointerdown", (event) => {
    state.pointerId = event.pointerId;
    state.originX = event.clientX;
    state.originY = event.clientY;
    root.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    const rawY = clamp(
      (event.clientY - state.originY) / MOVE_JOYSTICK_RADIUS,
      -1,
      1,
    );

    state.y = rawY;
    updateMoveKeys(state.y);
    setJoystickThumb(thumb, 0, state.y, MOVE_JOYSTICK_RADIUS);
    event.preventDefault();
  });

  root.addEventListener("pointerup", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    resetMoveState(thumb, state);
    event.preventDefault();
  });

  root.addEventListener("pointercancel", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    resetMoveState(thumb, state);
    event.preventDefault();
  });
}

function resetLookState(thumb: HTMLElement, state: JoystickState): void {
  state.pointerId = null;
  state.x = 0;
  state.y = 0;
  setJoystickThumb(thumb, 0, 0, LOOK_JOYSTICK_RADIUS);
}

function bindCircularLookJoystick(root: HTMLElement, player: PlayerPhysics): void {
  const thumb = root.querySelector<HTMLElement>(".mobile-controls__thumb");

  if (!thumb) {
    throw new Error("Thumb du joystick mobile droit introuvable");
  }

  const state: JoystickState = {
    pointerId: null,
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
  };

  let previousTime = performance.now();

  function updateCamera(currentTime: number): void {
    const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
    previousTime = currentTime;

    if (
      state.pointerId !== null &&
      (Math.abs(state.x) > LOOK_DEAD_ZONE || Math.abs(state.y) > LOOK_DEAD_ZONE)
    ) {
      player.yaw += state.x * LOOK_SPEED * deltaTime;
      player.pitch = clamp(
        player.pitch + state.y * LOOK_SPEED * deltaTime,
        MIN_PITCH,
        MAX_PITCH,
      );
    }

    requestAnimationFrame(updateCamera);
  }

  requestAnimationFrame(updateCamera);

  root.addEventListener("pointerdown", (event) => {
    state.pointerId = event.pointerId;
    state.originX = event.clientX;
    state.originY = event.clientY;
    root.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  root.addEventListener("pointermove", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    const rawX = (event.clientX - state.originX) / LOOK_JOYSTICK_RADIUS;
    const rawY = (event.clientY - state.originY) / LOOK_JOYSTICK_RADIUS;
    const length = Math.hypot(rawX, rawY);
    const normalizedLength = Math.min(length, 1);

    if (length > 0) {
      state.x = (rawX / length) * normalizedLength;
      state.y = (rawY / length) * normalizedLength;
    } else {
      state.x = 0;
      state.y = 0;
    }

    setJoystickThumb(thumb, state.x, state.y, LOOK_JOYSTICK_RADIUS);
    event.preventDefault();
  });

  root.addEventListener("pointerup", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    resetLookState(thumb, state);
    event.preventDefault();
  });

  root.addEventListener("pointercancel", (event) => {
    if (state.pointerId !== event.pointerId) {
      return;
    }

    resetLookState(thumb, state);
    event.preventDefault();
  });
}

function bindJumpButton(button: HTMLElement): void {
  button.addEventListener("pointerdown", (event) => {
    pressedKeys.add("Space");
    button.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  button.addEventListener("pointerup", (event) => {
    pressedKeys.delete("Space");
    event.preventDefault();
  });

  button.addEventListener("pointercancel", (event) => {
    pressedKeys.delete("Space");
    event.preventDefault();
  });
}

export default function initializeMobileControls(player: PlayerPhysics): void {
  if (!isMobileMode()) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "mobile-controls";

  const moveJoystick = createControlElement(
    "mobile-controls__joystick mobile-controls__joystick--move",
    "Avancer ou reculer",
  );
  const moveThumb = document.createElement("div");
  moveThumb.className = "mobile-controls__thumb";
  moveJoystick.append(moveThumb);

  const lookJoystick = createControlElement(
    "mobile-controls__joystick mobile-controls__joystick--look",
    "Regarder autour de soi",
  );
  const lookThumb = document.createElement("div");
  lookThumb.className = "mobile-controls__thumb";
  lookJoystick.append(lookThumb);

  const jumpButton = createControlElement(
    "mobile-controls__jump-button",
    "Sauter",
  );
  jumpButton.textContent = "↥";

  overlay.append(moveJoystick, lookJoystick, jumpButton);
  document.body.append(overlay);

  bindVerticalMoveJoystick(moveJoystick);
  bindCircularLookJoystick(lookJoystick, player);
  bindJumpButton(jumpButton);
}
