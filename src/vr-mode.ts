import { Axis, Ray, Scene, Vector3, WebXRState } from "@babylonjs/core";
import { EYE_HEIGHT, JUMP_VELOCITY, pressedKeys } from "./constants";
import type { PlayerPhysics } from "./types";
import { isVRMode } from "./mobile-controls";

const VR_HEADSET_USER_AGENT_PATTERN = /OculusBrowser|Oculus|Quest|Meta Quest|Pico|Vive|Hololens/i;
const MOVE_DEAD_ZONE = 0.18;
const TURN_DEAD_ZONE = 0.35;
const VR_SMOOTH_TURN_SPEED = 1.6;
const CONTROLLER_RAY_LENGTH = 8;
const VR_BODY_YAW_EVENT = "vr-body-yaw-change";

type WebXRNavigator = Navigator & {
  xr?: {
    isSessionSupported?: (sessionMode: "immersive-vr") => Promise<boolean>;
  };
};

type MotionControllerComponentLike = {
  axes?: { x?: number; y?: number };
  value?: number;
  pressed?: boolean;
};

type MotionControllerLike = {
  getComponent?: (componentId: string) => MotionControllerComponentLike | undefined;
};

type XRControllerLike = {
  pointer?: {
    getAbsolutePosition?: () => Vector3;
    getDirection?: (localAxis: Vector3) => Vector3;
  };
  motionController?: MotionControllerLike;
};

type NonXRCameraLike = {
  getDirection?: (localAxis: Vector3) => Vector3;
  rotation?: Vector3;
};

type WebXRCameraLike = {
  position: Vector3;
  setTransformationFromNonVRCamera?: (camera: NonXRCameraLike, resetToBaseReferenceSpace?: boolean) => void;
};

export type XRHandedness = "left" | "right";

export type WebXRGameControls = {
  isActive: () => boolean;
  getMoveDirection: () => Vector3;
  getControllerRay: (handedness: XRHandedness) => Ray | null;
  isTriggerPressed: (handedness: XRHandedness) => boolean;
  syncBeforePhysics: (deltaTimeSeconds: number) => void;
  syncAfterPhysics: () => void;
};

export function isForcedVRDebug(): boolean {
    const params = new URLSearchParams(window.location.search);

    return (
        params.has("force_vr") ||
        localStorage.getItem("force_vr") === "1"
    );
}

export async function isImmersiveVrSupported(): Promise<boolean> {
  const xr = (navigator as WebXRNavigator).xr;

  if (typeof xr?.isSessionSupported === "function") {
    try {
      if (await xr.isSessionSupported("immersive-vr")) {
        return true;
      }
    } catch {
      // Certains navigateurs peuvent refuser le check WebXR selon le contexte.
      // Dans ce cas, on garde un fallback User-Agent pour les casques connus.
    }
  }

  return VR_HEADSET_USER_AGENT_PATTERN.test(navigator.userAgent);
}

export async function initializeWebXRGameControls(
  scene: Scene,
  player: PlayerPhysics,
): Promise<WebXRGameControls> {
  let xrExperience: Awaited<ReturnType<Scene["createDefaultXRExperienceAsync"]>> | null = null;
  let leftController: XRControllerLike | null = null;
  let rightController: XRControllerLike | null = null;
  let active = false;
  let headOffset = Vector3.Zero();
  let bodyYaw = normalizeAngle(player.yaw);
  const nonXRCamera = scene.activeCamera as NonXRCameraLike | null;

  const controls: WebXRGameControls = {
    isActive: () => active,
    getMoveDirection: () => Vector3.Zero(),
    getControllerRay: (handedness) => {
      if (!active) return null;

      return getControllerRay(handedness === "left" ? leftController : rightController);
    },
    isTriggerPressed: (handedness) => {
      if (!active) return false;

      return isTriggerPressed(handedness === "left" ? leftController : rightController);
    },
    syncBeforePhysics: (deltaTimeSeconds: number) => {
      if (!active || !xrExperience) return;

      const xrCamera = xrExperience.baseExperience.camera;
      const previousBodyYaw = bodyYaw;
      const headOffsetWorld = xrCamera.position.subtract(getPlayerEyesPosition(player));
      const headOffsetLocal = rotateHorizontalVector(headOffsetWorld, -previousBodyYaw);

      bodyYaw = applySmoothTurnFromRightJoystick(bodyYaw, rightController, deltaTimeSeconds);
      player.yaw = bodyYaw;
      headOffset = rotateHorizontalVector(headOffsetLocal, bodyYaw);
      emitVRBodyYaw(bodyYaw);
      updateMovementKeysFromLeftController(leftController);

      if (isJumpPressed(rightController) || isJumpPressed(leftController)) {
        if (player.grounded) {
          player.velocity.y = JUMP_VELOCITY;
          player.grounded = false;
        }
      }
    },
    syncAfterPhysics: () => {
      if (!active || !xrExperience) return;

      syncXRCameraPositionToPlayer(xrExperience.baseExperience.camera, player, headOffset);
    },
  };

  if (isVRMode()) {
    try {
      xrExperience = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [],
      });

      xrExperience.baseExperience.onStateChangedObservable.add((state) => {
        active = state === WebXRState.IN_XR;

        if (active && xrExperience) {
          clearVRMovementKeys();
          alignXRCameraFromNonVR(xrExperience.baseExperience.camera, nonXRCamera);
          bodyYaw = getYawFromNonVRCamera(nonXRCamera) ?? normalizeAngle(player.yaw);
          player.yaw = bodyYaw;
          emitVRBodyYaw(bodyYaw);
          headOffset = Vector3.Zero();
          syncXRCameraPositionToPlayer(xrExperience.baseExperience.camera, player, headOffset);
          return;
        }

        clearVRMovementKeys();
      });

      xrExperience.input.onControllerAddedObservable.add((controller) => {
        const handedness = controller.inputSource?.handedness;

        if (handedness === "left") {
          leftController = controller as XRControllerLike;
          return;
        }

        if (handedness === "right") {
          rightController = controller as XRControllerLike;
        }
      });

      xrExperience.input.onControllerRemovedObservable.add((controller) => {
        if (leftController === controller) {
          leftController = null;
        }

        if (rightController === controller) {
          rightController = null;
        }
      });
    } catch (error) {
      console.warn("WebXR non disponible", error);
      return controls;
    }
  }

  return controls;
}

function getControllerRay(controller: XRControllerLike | null): Ray | null {
  const pointer = controller?.pointer;

  if (!pointer?.getAbsolutePosition || !pointer.getDirection) return null;

  const origin = pointer.getAbsolutePosition();
  const direction = pointer.getDirection(Axis.Z).normalize();

  return new Ray(origin, direction, CONTROLLER_RAY_LENGTH);
}

function applySmoothTurnFromRightJoystick(
  bodyYaw: number,
  rightController: XRControllerLike | null,
  deltaTimeSeconds: number,
): number {
  const axes = readControllerAxes(rightController);

  if (!axes || Math.abs(axes.x) <= TURN_DEAD_ZONE) return bodyYaw;

  return normalizeAngle(bodyYaw + axes.x * VR_SMOOTH_TURN_SPEED * deltaTimeSeconds);
}

function updateMovementKeysFromLeftController(leftController: XRControllerLike | null): void {
  const axes = readControllerAxes(leftController);

  clearVRMovementKeys();

  if (!axes) return;

  if (axes.y < -MOVE_DEAD_ZONE) pressedKeys.add("KeyW");
  if (axes.y > MOVE_DEAD_ZONE) pressedKeys.add("KeyS");
  if (axes.x < -MOVE_DEAD_ZONE) pressedKeys.add("KeyA");
  if (axes.x > MOVE_DEAD_ZONE) pressedKeys.add("KeyD");
}

function clearVRMovementKeys(): void {
  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyA");
  pressedKeys.delete("KeyS");
  pressedKeys.delete("KeyD");
}

function readControllerAxes(controller: XRControllerLike | null): { x: number; y: number } | null {
  const thumbstick = controller?.motionController?.getComponent?.("xr-standard-thumbstick")?.axes;
  const touchpad = controller?.motionController?.getComponent?.("xr-standard-touchpad")?.axes;
  const axes = thumbstick ?? touchpad;

  if (!axes) return null;

  const x = axes.x ?? 0;
  const y = axes.y ?? 0;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(x) > 1.2 || Math.abs(y) > 1.2) return null;

  return { x, y };
}

function isTriggerPressed(controller: XRControllerLike | null): boolean {
  const trigger =
    controller?.motionController?.getComponent?.("xr-standard-trigger") ??
    controller?.motionController?.getComponent?.("trigger");

  return Boolean(trigger?.pressed || (trigger?.value ?? 0) > 0.65);
}

function isJumpPressed(controller: XRControllerLike | null): boolean {
  const button =
    controller?.motionController?.getComponent?.("a-button") ??
    controller?.motionController?.getComponent?.("b-button") ??
    controller?.motionController?.getComponent?.("x-button") ??
    controller?.motionController?.getComponent?.("y-button");

  return Boolean(button?.pressed || (button?.value ?? 0) > 0.65);
}

function alignXRCameraFromNonVR(xrCamera: WebXRCameraLike, nonXRCamera: NonXRCameraLike | null): void {
  if (!nonXRCamera || typeof xrCamera.setTransformationFromNonVRCamera !== "function") {
    return;
  }

  xrCamera.setTransformationFromNonVRCamera(nonXRCamera, true);
}

function getYawFromNonVRCamera(camera: NonXRCameraLike | null): number | null {
  if (!camera) return null;

  if (typeof camera.getDirection === "function") {
    const forward = camera.getDirection(Axis.Z);
    return normalizeAngle(Math.atan2(forward.x, forward.z));
  }

  if (typeof camera.rotation?.y === "number") {
    return normalizeAngle(camera.rotation.y);
  }

  return null;
}

function getPlayerEyesPosition(player: PlayerPhysics): Vector3 {
  return player.position.add(new Vector3(0, EYE_HEIGHT, 0));
}

function emitVRBodyYaw(yaw: number): void {
  window.dispatchEvent(new CustomEvent(VR_BODY_YAW_EVENT, {
    detail: { yaw },
  }));
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotateHorizontalVector(vector: Vector3, yaw: number): Vector3 {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);

  return new Vector3(
    vector.x * cos + vector.z * sin,
    vector.y,
    -vector.x * sin + vector.z * cos,
  );
}

function syncXRCameraPositionToPlayer(
  camera: { position: Vector3 },
  player: PlayerPhysics,
  headOffset: Vector3,
): void {
  camera.position.copyFrom(getPlayerEyesPosition(player).add(headOffset));
}
