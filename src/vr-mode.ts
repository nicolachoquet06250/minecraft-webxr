import { Axis, Ray, Scene, Vector3, WebXRState } from "@babylonjs/core";
import type { Camera } from "@babylonjs/core";
import { EYE_HEIGHT, JUMP_VELOCITY, MOVE_SPEED, pressedKeys } from "./constants";
import { hasCollisionAt } from "./functions";
import type { PlayerPhysics, WorldChunks } from "./types";
import { isVRMode } from "./mobile-controls";

const VR_HEADSET_USER_AGENT_PATTERN = /OculusBrowser|Oculus|Quest|Meta Quest|Pico|Vive|Hololens/i;
const MOVE_DEAD_ZONE = 0.18;
const CONTROLLER_RAY_LENGTH = 3;
const VR_BODY_YAW_EVENT = "vr-body-yaw-change";
const VR_EYE_HEIGHT = EYE_HEIGHT - 0.42;
const VR_AUTO_JUMP_MIN_HORIZONTAL_PROGRESS = 0.01;
const POINTER_RAY_MESH_NAME_PATTERN = /laser|ray|pointer|selection/i;

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

type XRPointerChildLike = {
  name?: string;
  isVisible?: boolean;
  isEnabled?: () => boolean;
  visibility?: number;
};

type XRPointerLike = XRPointerChildLike & {
  absolutePosition?: Vector3;
  getAbsolutePosition?: () => Vector3;
  getDirection?: (localAxis: Vector3) => Vector3;
  getChildMeshes?: () => XRPointerChildLike[];
  getChildren?: () => XRPointerChildLike[];
};

type XRControllerLike = {
  pointer?: XRPointerLike;
  motionController?: MotionControllerLike;
};

type WebXRCameraLike = {
  position: Vector3;
  getDirection?: (localAxis: Vector3) => Vector3;
  setTransformationFromNonVRCamera?: (camera?: Camera, resetToBaseReferenceSpace?: boolean) => void;
};

type PlayerWithWorldContext = PlayerPhysics & {
  _worldChunks?: WorldChunks;
  _sizeX?: number;
  _sizeY?: number;
  _sizeZ?: number;
};

export type XRHandedness = "left" | "right";

export type WebXRGameControls = {
  isActive: () => boolean;
  getMoveDirection: () => Vector3;
  getControllerRay: (handedness: XRHandedness) => Ray | null;
  getControllerPosition: (handedness: XRHandedness) => Vector3 | null;
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
  let moveDirection = Vector3.Zero();
  const nonXRCamera = scene.activeCamera;

  const controls: WebXRGameControls = {
    isActive: () => active,
    getMoveDirection: () => moveDirection.clone(),
    getControllerRay: (handedness) => {
      if (!active) return null;

      return getControllerRay(handedness === "left" ? leftController : rightController);
    },
    getControllerPosition: (handedness) => {
      if (!active) return null;

      return getControllerPosition(handedness === "left" ? leftController : rightController);
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
      moveDirection = getMoveDirectionFromLeftController(leftController, getYawFromCamera(xrCamera));
      applyManualJumpFromRightController(player, rightController);
      applyVRMoveDirection(player, moveDirection, deltaTimeSeconds);
      clearVRMovementKeys();
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
          moveDirection = Vector3.Zero();
          alignXRCameraFromNonVR(xrExperience.baseExperience.camera, nonXRCamera);
          bodyYaw = getYawFromNonVRCamera(nonXRCamera) ?? normalizeAngle(player.yaw);
          player.yaw = bodyYaw;
          emitVRBodyYaw(bodyYaw);
          headOffset = Vector3.Zero();
          syncXRCameraPositionToPlayer(xrExperience.baseExperience.camera, player, headOffset);
          return;
        }

        clearVRMovementKeys();
        moveDirection = Vector3.Zero();
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

  if (!isControllerPointerVisible(pointer)) return null;
  if (!pointer.getAbsolutePosition || !pointer.getDirection) return null;

  const origin = pointer.getAbsolutePosition();
  const direction = pointer.getDirection(Axis.Z).normalize();

  return new Ray(origin, direction, CONTROLLER_RAY_LENGTH);
}

function getControllerPosition(controller: XRControllerLike | null): Vector3 | null {
  const pointer = controller?.pointer;

  if (!pointer) return null;

  if (typeof pointer.getAbsolutePosition === "function") {
    return pointer.getAbsolutePosition();
  }

  return pointer.absolutePosition?.clone() ?? null;
}

function isControllerPointerVisible(pointer: XRPointerLike | undefined): pointer is XRPointerLike {
  if (!isVisibleNode(pointer)) return false;

  const childMeshes = pointer.getChildMeshes?.() ?? [];
  const children = pointer.getChildren?.() ?? [];
  const visibleRayNodes = [...childMeshes, ...children].filter((child) => {
    const name = child.name ?? "";

    return POINTER_RAY_MESH_NAME_PATTERN.test(name) && isVisibleNode(child);
  });

  if (visibleRayNodes.length > 0) {
    return true;
  }

  if (childMeshes.length > 0 || children.length > 0) {
    return false;
  }

  return true;
}

function isVisibleNode(node: XRPointerChildLike | undefined): node is XRPointerChildLike {
  if (!node) return false;
  if (node.isVisible === false) return false;
  if (typeof node.visibility === "number" && node.visibility <= 0) return false;
  if (typeof node.isEnabled === "function" && !node.isEnabled()) return false;

  return true;
}

function handleRightJoystick(
  bodyYaw: number,
  _rightController: XRControllerLike | null,
  _deltaTimeSeconds: number,
): number {
  return bodyYaw;
}

function getMoveDirectionFromLeftController(
  leftController: XRControllerLike | null,
  yaw: number,
): Vector3 {
  const axes = readControllerAxes(leftController);

  if (!axes) return Vector3.Zero();

  const forward = new Vector3(
    Math.sin(yaw),
    0,
    Math.cos(yaw),
  );

  const right = new Vector3(
    Math.cos(yaw),
    0,
    -Math.sin(yaw),
  );

  const direction = Vector3.Zero();

  if (axes.y < -MOVE_DEAD_ZONE) direction.addInPlace(forward);
  if (axes.y > MOVE_DEAD_ZONE) direction.subtractInPlace(forward);
  if (axes.x < -MOVE_DEAD_ZONE) direction.subtractInPlace(right);
  if (axes.x > MOVE_DEAD_ZONE) direction.addInPlace(right);

  if (direction.lengthSquared() > 0) {
    direction.normalize();
  }

  return direction;
}

function applyVRMoveDirection(
  player: PlayerPhysics,
  moveDirection: Vector3,
  deltaTimeSeconds: number,
): void {
  if (moveDirection.lengthSquared() === 0) {
    return;
  }

  const playerWithWorldContext = player as PlayerWithWorldContext;
  const { _worldChunks, _sizeX, _sizeY, _sizeZ } = playerWithWorldContext;

  if (!_worldChunks || _sizeX === undefined || _sizeY === undefined || _sizeZ === undefined) {
    return;
  }

  const previousPosition = player.position.clone();
  const deltaMove = moveDirection.scale(MOVE_SPEED * deltaTimeSeconds);

  moveVRHorizontallyWithCollision(
    player,
    deltaMove,
    _worldChunks,
    _sizeX,
    _sizeY,
    _sizeZ,
  );

  tryVRAutoJump({
    player,
    moveDirection,
    previousPosition,
  });
}

type VRAutoJumpParams = {
  player: PlayerPhysics;
  moveDirection: Vector3;
  previousPosition: Vector3;
};

function tryVRAutoJump(params: VRAutoJumpParams): void {
  const { player, moveDirection, previousPosition } = params;

  if (!player.grounded) {
    return;
  }

  const actualHorizontalMove = player.position.subtract(previousPosition);
  actualHorizontalMove.y = 0;

  const progressInInputDirection = Vector3.Dot(actualHorizontalMove, moveDirection);

  if (progressInInputDirection > VR_AUTO_JUMP_MIN_HORIZONTAL_PROGRESS) {
    return;
  }

  player.velocity.y = JUMP_VELOCITY;
  player.grounded = false;
}

function applyManualJumpFromRightController(
  player: PlayerPhysics,
  rightController: XRControllerLike | null,
): void {
  if (!player.grounded || !isAButtonPressed(rightController)) {
    return;
  }

  player.velocity.y = JUMP_VELOCITY;
  player.grounded = false;
}

function isAButtonPressed(controller: XRControllerLike | null): boolean {
  const aButton =
    controller?.motionController?.getComponent?.("a-button") ??
    controller?.motionController?.getComponent?.("xr-standard-button-a") ??
    controller?.motionController?.getComponent?.("button-a") ??
    controller?.motionController?.getComponent?.("a");

  return Boolean(aButton?.pressed || (aButton?.value ?? 0) > 0.65);
}

function moveVRHorizontallyWithCollision(
  player: PlayerPhysics,
  deltaMove: Vector3,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
): void {
  const nextX = player.position.add(new Vector3(deltaMove.x, 0, 0));

  if (!hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, nextX)) {
    player.position.x = nextX.x;
  } else {
    player.velocity.x = 0;
  }

  const nextZ = player.position.add(new Vector3(0, 0, deltaMove.z));

  if (!hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, nextZ)) {
    player.position.z = nextZ.z;
  } else {
    player.velocity.z = 0;
  }
}

function clearVRMovementKeys(): void {
  pressedKeys.delete("KeyW");
  pressedKeys.delete("KeyA");
  pressedKeys.delete("KeyS");
  pressedKeys.delete("KeyD");
  pressedKeys.delete("KeyQ");
  pressedKeys.delete("KeyZ");
  pressedKeys.delete("ArrowUp");
  pressedKeys.delete("ArrowDown");
  pressedKeys.delete("ArrowLeft");
  pressedKeys.delete("ArrowRight");
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

function getYawFromCamera(camera: WebXRCameraLike): number {
  const forward = camera.getDirection?.(Axis.Z);

  if (!forward) {
    return 0;
  }

  return normalizeAngle(Math.atan2(forward.x, forward.z));
}

function getPlayerEyesPosition(player: PlayerPhysics): Vector3 {
  return player.position.add(new Vector3(0, VR_EYE_HEIGHT, 0));
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
