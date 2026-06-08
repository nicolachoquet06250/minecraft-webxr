import { Axis, Ray, Scene, Vector3, WebXRState } from "@babylonjs/core";
import type { Camera } from "@babylonjs/core";
import { EYE_HEIGHT, pressedKeys } from "./constants";
import type { PlayerPhysics } from "./types";
import { isVRMode } from "./mobile-controls";

const VR_HEADSET_USER_AGENT_PATTERN = /OculusBrowser|Oculus|Quest|Meta Quest|Pico|Vive|Hololens/i;
const MOVE_DEAD_ZONE = 0.18;
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

type WebXRCameraLike = {
  position: Vector3;
  setTransformationFromNonVRCamera?: (camera?: Camera, resetToBaseReferenceSpace?: boolean) => void;
};

export type XRHandedness = "left" | "right";

export type WebXRGameControls = {
  isActive: () => boolean;
  getMoveDirection: () => Vector3;
  getControllerRay: (handedness: XRHandedness) => Ray | null;
  isTriggerPressed: (handedness: XRHandedness) => boolean;
  enterVR: () => Promise<void>;
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
  const nonXRCamera = scene.activeCamera;

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
    enterVR: async () => {
      await xrExperience?.baseExperience.enterXRAsync("immersive-vr", "local-floor");
    },
    syncBeforePhysics: (deltaTimeSeconds: number) => {
      if (!active || !xrExperience) return;

      const xrCamera = xrExperience.baseExperience.camera;
      const previousBodyYaw = bodyYaw;
      const headOffsetWorld = xrCamera.position.subtract(getPlayerEyesPosition(player));
      const headOffsetLocal = rotateHorizontalVector(headOffsetWorld, -previousBodyYaw);

      bodyYaw = handleRightJoystick(bodyYaw, rightController, deltaTimeSeconds);
      player.yaw = bodyYaw;
      headOffset = rotateHorizontalVector(headOffsetLocal, bodyYaw);
      emitVRBodyYaw(bodyYaw);
      handleLeftJoystick(leftController);
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

function handleRightJoystick(
  bodyYaw: number,
  _rightController: XRControllerLike | null,
  _deltaTimeSeconds: number,
): number {
  return bodyYaw;
}

function handleLeftJoystick(leftController: XRControllerLike | null): void {
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

function alignXRCameraFromNonVR(xrCamera: WebXRCameraLike, nonXRCamera: Camera | null): void {
  if (!nonXRCamera || typeof xrCamera.setTransformationFromNonVRCamera !== "function") {
    return;
  }

  xrCamera.setTransformationFromNonVRCamera(nonXRCamera, true);
}

function getYawFromNonVRCamera(camera: Camera | null): number | null {
  if (!camera) return null;

  const forward = camera.getDirection(Axis.Z);
  return normalizeAngle(Math.atan2(forward.x, forward.z));
}

function getPlayerEyesPosition(player: PlayerPhysics): Vector3 {
  return player.position.add(new Vector3(0, EYE_HEIGHT, 0));
}

function emitVRBodyYaw(yaw: number): void {
  window.dispatchEvent(new CustomEvent(VR_BODY_YAW_EVENT, {
    detail: { yaw },
  }));
}

function normalizeAngle(angle: number): void | number {
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
