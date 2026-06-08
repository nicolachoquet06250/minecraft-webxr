import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { renderItemIconControl } from "./items/rendering";
import type { PlayerPhysics } from "./types";
import type { WebXRGameControls } from "./vr-mode";

const VR_HAND_HOTBAR_SLOT_COUNT = 9;
const VR_HAND_HOTBAR_WIDTH = 1.18;
const VR_HAND_HOTBAR_HEIGHT = 0.22;
const VR_ARM_WIDTH = 0.16;
const VR_ARM_HEIGHT = 0.16;
const VR_ARM_LENGTH = 0.48;
const VR_ARM_VERTICAL_OFFSET = -0.05;
const VR_ARM_CAMERA_DISTANCE = 0.72;
const VR_ARM_SIDE_OFFSET = 0.32;
const VR_ARM_DOWN_OFFSET = -0.42;
const VR_HOTBAR_LOCAL_Y = 0.28;
const VR_HOTBAR_LOCAL_Z = -0.1;

type VRHandInventoryControls = {
  readonly updateUI: () => void;
};

export function initializeVRHandInventoryBar(
  scene: Scene,
  player: PlayerPhysics,
  webXRControls: WebXRGameControls,
): VRHandInventoryControls {
  const armMaterial = new StandardMaterial("vr-player-arm-material", scene);
  armMaterial.diffuseColor = new Color3(0.46, 0.28, 0.16);
  armMaterial.specularColor = Color3.Black();

  const leftArm = createArmMesh(scene, "vr-player-left-arm", armMaterial);
  const rightArm = createArmMesh(scene, "vr-player-right-arm", armMaterial);

  const panel = MeshBuilder.CreatePlane(
    "vr-left-arm-inventory-panel",
    {
      width: VR_HAND_HOTBAR_WIDTH,
      height: VR_HAND_HOTBAR_HEIGHT,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene,
  );
  panel.isPickable = false;
  panel.alwaysSelectAsActiveMesh = true;
  panel.billboardMode = Mesh.BILLBOARDMODE_ALL;
  panel.parent = leftArm;
  panel.position.set(0, VR_HOTBAR_LOCAL_Y, VR_HOTBAR_LOCAL_Z);

  const ui = AdvancedDynamicTexture.CreateForMesh(panel, 1200, 220, false);
  const slots: Rectangle[] = [];
  const itemIcons: Rectangle[] = [];
  const countTexts: TextBlock[] = [];

  const hotbar = new StackPanel("vr-left-arm-inventory-hotbar");
  hotbar.isVertical = false;
  hotbar.width = 1180;
  hotbar.height = 210;
  hotbar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  hotbar.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  hotbar.isPointerBlocker = false;
  ui.addControl(hotbar);

  for (let index = 0; index < VR_HAND_HOTBAR_SLOT_COUNT; index++) {
    const slot = new Rectangle(`vr-left-arm-inventory-slot-${index}`);
    slot.width = "122px";
    slot.height = "122px";
    slot.thickness = 4;
    slot.cornerRadius = 4;
    slot.color = "rgba(160, 160, 160, 0.95)";
    slot.background = "rgba(30, 30, 30, 0.82)";
    slot.isPointerBlocker = false;

    const item = new Rectangle(`vr-left-arm-inventory-item-${index}`);
    item.width = "78px";
    item.height = "78px";
    item.thickness = 1;
    item.color = "rgba(255, 255, 255, 0.35)";
    item.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    item.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    item.isPointerBlocker = false;
    item.isVisible = false;

    const countText = new TextBlock(`vr-left-arm-inventory-count-${index}`);
    countText.color = "white";
    countText.fontSize = 32;
    countText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    countText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    countText.paddingRight = "8px";
    countText.paddingTop = "6px";
    countText.isPointerBlocker = false;
    countText.isVisible = false;
    countText.shadowBlur = 3;
    countText.shadowColor = "black";

    slot.addControl(item);
    slot.addControl(countText);
    hotbar.addControl(slot);
    slots.push(slot);
    itemIcons.push(item);
    countTexts.push(countText);
  }

  const updateUI = (): void => {
    for (let index = 0; index < VR_HAND_HOTBAR_SLOT_COUNT; index++) {
      const slot = slots[index];
      const inventoryItem = player.inventory[index];
      const isSelected = index === player.selectedSlot;

      slot.thickness = isSelected ? 8 : 4;
      slot.color = isSelected ? "white" : "rgba(160, 160, 160, 0.95)";
      slot.background = isSelected ? "rgba(90, 90, 90, 0.92)" : "rgba(30, 30, 30, 0.82)";
      renderItemIconControl(itemIcons[index], inventoryItem?.blockId ?? null);

      if (inventoryItem) {
        countTexts[index].isVisible = inventoryItem.count > 1;
        countTexts[index].text = `${inventoryItem.count}`;
      } else {
        countTexts[index].isVisible = false;
      }
    }
  };

  registerInventoryUpdater(player, updateUI);
  updateUI();

  scene.onBeforeRenderObservable.add(() => {
    const activeCamera = scene.activeCamera;
    const cameraPosition = activeCamera?.globalPosition ?? activeCamera?.position;

    if (!webXRControls.isActive() || !activeCamera || !cameraPosition) {
      leftArm.setEnabled(false);
      rightArm.setEnabled(false);
      panel.setEnabled(false);
      return;
    }

    updateArmTransform({
      scene,
      arm: leftArm,
      cameraPosition,
      controllerPosition: webXRControls.getControllerPosition("left"),
      controllerDirection: webXRControls.getControllerRay("left")?.direction ?? null,
      side: -1,
    });
    updateArmTransform({
      scene,
      arm: rightArm,
      cameraPosition,
      controllerPosition: webXRControls.getControllerPosition("right"),
      controllerDirection: webXRControls.getControllerRay("right")?.direction ?? null,
      side: 1,
    });

    leftArm.setEnabled(true);
    rightArm.setEnabled(true);
    panel.setEnabled(true);
  });

  return { updateUI };
}

function createArmMesh(scene: Scene, name: string, material: StandardMaterial): Mesh {
  const arm = MeshBuilder.CreateBox(
    name,
    {
      width: VR_ARM_WIDTH,
      height: VR_ARM_HEIGHT,
      depth: VR_ARM_LENGTH,
    },
    scene,
  );

  arm.material = material;
  arm.isPickable = false;
  arm.alwaysSelectAsActiveMesh = true;
  arm.setEnabled(false);

  return arm;
}

type UpdateArmTransformParams = {
  scene: Scene;
  arm: Mesh;
  cameraPosition: Vector3;
  controllerPosition: Vector3 | null;
  controllerDirection: Vector3 | null;
  side: -1 | 1;
};

function updateArmTransform(params: UpdateArmTransformParams): void {
  const { scene, arm, cameraPosition, controllerPosition, controllerDirection, side } = params;
  const activeCamera = scene.activeCamera;

  if (!activeCamera) {
    return;
  }

  const fallbackPosition = getFallbackArmPosition(activeCamera, cameraPosition, side);
  const handPosition = controllerPosition ?? fallbackPosition;
  const direction = controllerDirection?.clone() ?? cameraPosition.subtract(handPosition);

  if (direction.lengthSquared() === 0) {
    direction.copyFrom(activeCamera.getDirection(Vector3.Forward()));
  }

  direction.normalize();
  arm.position.copyFrom(handPosition.add(direction.scale(VR_ARM_LENGTH / 2)));
  arm.position.y += VR_ARM_VERTICAL_OFFSET;
  arm.lookAt(arm.position.add(direction));
}

function getFallbackArmPosition(activeCamera: NonNullable<Scene["activeCamera"]>, cameraPosition: Vector3, side: -1 | 1): Vector3 {
  const forward = activeCamera.getDirection(Vector3.Forward()).normalize();
  const right = activeCamera.getDirection(Vector3.Right()).normalize();

  return cameraPosition
    .add(forward.scale(VR_ARM_CAMERA_DISTANCE))
    .add(right.scale(side * VR_ARM_SIDE_OFFSET))
    .add(new Vector3(0, VR_ARM_DOWN_OFFSET, 0));
}

function registerInventoryUpdater(player: PlayerPhysics, updateUI: () => void): void {
  const previousUpdater = (player as any)._updateInventoryUI;

  if (typeof previousUpdater === "function") {
    (player as any)._updateInventoryUI = () => {
      previousUpdater();
      updateUI();
    };
    return;
  }

  (player as any)._updateInventoryUI = updateUI;
}
