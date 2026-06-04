import { Matrix, Quaternion, Scene, Vector3, WebXRState } from "@babylonjs/core";
import { JUMP_VELOCITY, pressedKeys } from "./constants";
import type { PlayerPhysics } from "./types";

const VR_HEADSET_USER_AGENT_PATTERN = /OculusBrowser|Oculus|Quest|Meta Quest|Pico|Vive|Hololens/i;
const CONTROLLER_DEAD_ZONE = 0.18;

type WebXRNavigator = Navigator & {
  xr?: {
    isSessionSupported?: (sessionMode: "immersive-vr") => Promise<boolean>;
  };
};

type MotionControllerLike = {
  getComponent?: (componentId: string) => {
    axes?: { x?: number; y?: number };
    value?: number;
    pressed?: boolean;
  } | undefined;
};

type XRControllerLike = {
  motionController?: MotionControllerLike;
};

export type WebXRGameControls = {
  isActive: () => boolean;
  getMoveDirection: () => Vector3;
  syncBeforePhysics: () => void;
  syncAfterPhysics: () => void;
};

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

  const controls: WebXRGameControls = {
    isActive: () => active,
    getMoveDirection: () => {
      if (!active) return Vector3.Zero();

      const axes = readMovementAxes(leftController) ?? readMovementAxes(rightController);

      if (!axes) return Vector3.Zero();

      return getMoveDirectionFromAxes(player.yaw, axes.x, axes.y);
    },
    syncBeforePhysics: () => {
      if (!active || !xrExperience) return;

      const xrCamera = xrExperience.baseExperience.camera;
      player.yaw = getYawFromCamera(xrCamera);
      updateMovementKeysFromControllers(leftController, rightController);

      if (isJumpPressed(rightController) || isJumpPressed(leftController)) {
        if (player.grounded) {
          player.velocity.y = JUMP_VELOCITY;
          player.grounded = false;
        }
      }
    },
    syncAfterPhysics: () => {
      if (!active || !xrExperience) return;

      syncXRCameraToPlayer(xrExperience.baseExperience.camera, player);
    },
  };

  try {
    xrExperience = await scene.createDefaultXRExperienceAsync({
      floorMeshes: [],
    });
  } catch (error) {
    console.warn("WebXR non disponible", error);
    return controls;
  }

  xrExperience.baseExperience.onStateChangedObservable.add((state) => {
    active = state === WebXRState.IN_XR;

    if (active && xrExperience) {
      clearVRMovementKeys();
      syncXRCameraToPlayer(xrExperience.baseExperience.camera, player);
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

  return controls;
}

function updateMovementKeysFromControllers(leftController: XRControllerLike | null, rightController: XRControllerLike | null): void {
  const axes = readMovementAxes(leftController) ?? readMovementAxes(rightController);

  clearVRMovementKeys();

  if (!axes) return;

  if (axes.y < -CONTROLLER_DEAD_ZONE) pressedKeys.add("KeyW");
  if (axes.y > CONTROLLER_DEAD_ZONE) pressedKeys.add("KeyS");
  if (axes.x < -CONTROLLER_DEAD_ZONE) pressedKeys.add("KeyA");
  if (axes.x > CONTROLLER_DEAD_ZONE) pressedKeys.add("KeyD");
}

function clearVRMovementKeys(): void {
  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyA");
  pressedKeys.delete("KeyS");
  pressedKeys.delete("KeyD");
}

function readMovementAxes(controller: XRControllerLike | null): { x: number; y: number } | null {
  const thumbstick = controller?.motionController?.getComponent?.("xr-standard-thumbstick")?.axes;
  const touchpad = controller?.motionController?.getComponent?.("xr-standard-touchpad")?.axes;
  const axes = thumbstick ?? touchpad;

  if (!axes) return null;

  const x = Math.abs(axes.x ?? 0) > CONTROLLER_DEAD_ZONE ? axes.x ?? 0 : 0;
  const y = Math.abs(axes.y ?? 0) > CONTROLLER_DEAD_ZONE ? axes.y ?? 0 : 0;

  if (x === 0 && y === 0) return null;

  return { x, y };
}

function isJumpPressed(controller: XRControllerLike | null): boolean {
  const button =
    controller?.motionController?.getComponent?.("a-button") ??
    controller?.motionController?.getComponent?.("b-button") ??
    controller?.motionController?.getComponent?.("x-button") ??
    controller?.motionController?.getComponent?.("y-button");

  return Boolean(button?.pressed || (button?.value ?? 0) > 0.65);
}

function getMoveDirectionFromAxes(yaw: number, axisX: number, axisY: number): Vector3 {
  const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const direction = Vector3.Zero();

  direction.addInPlace(forward.scale(-axisY));
  direction.addInPlace(right.scale(axisX));

  if (direction.lengthSquared() > 1) {
    direction.normalize();
  }

  return direction;
}

function getYawFromCamera(camera: { rotationQuaternion?: Quaternion | null; rotation?: Vector3 }): number {
  if (camera.rotationQuaternion) {
    const matrix = new Matrix();
    camera.rotationQuaternion.toRotationMatrix(matrix);
    const forward = Vector3.TransformNormal(new Vector3(0, 0, 1), matrix);
    return Math.atan2(forward.x, forward.z);
  }

  return camera.rotation?.y ?? 0;
}

function syncXRCameraToPlayer(camera: { position: Vector3 }, player: PlayerPhysics): void {
  camera.position.copyFrom(player.position);
}
