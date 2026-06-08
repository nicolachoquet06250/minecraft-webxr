import { Mesh, MeshBuilder, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { renderItemIconControl } from "./items/rendering";
import type { PlayerPhysics } from "./types";
import type { WebXRGameControls } from "./vr-mode";

const VR_HAND_HOTBAR_SLOT_COUNT = 9;
const VR_HAND_HOTBAR_WIDTH = 1.2;
const VR_HAND_HOTBAR_HEIGHT = 0.22;
const VR_HAND_HOTBAR_VERTICAL_OFFSET = 0.34;
const VR_HAND_HOTBAR_FORWARD_OFFSET = 0.12;

type VRHandInventoryControls = {
  readonly updateUI: () => void;
};

export function initializeVRHandInventoryBar(
  scene: Scene,
  player: PlayerPhysics,
  webXRControls: WebXRGameControls,
): VRHandInventoryControls {
  const panel = MeshBuilder.CreatePlane(
    "vr-left-hand-inventory-panel",
    {
      width: VR_HAND_HOTBAR_WIDTH,
      height: VR_HAND_HOTBAR_HEIGHT,
    },
    scene,
  );
  panel.isPickable = false;
  panel.alwaysSelectAsActiveMesh = true;
  panel.billboardMode = Mesh.BILLBOARDMODE_ALL;
  panel.setEnabled(false);

  const ui = AdvancedDynamicTexture.CreateForMesh(panel, 1200, 220, false);
  const slots: Rectangle[] = [];
  const itemIcons: Rectangle[] = [];
  const countTexts: TextBlock[] = [];

  const hotbar = new StackPanel("vr-left-hand-inventory-hotbar");
  hotbar.isVertical = false;
  hotbar.width = 1180;
  hotbar.height = 210;
  hotbar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  hotbar.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  hotbar.isPointerBlocker = false;
  ui.addControl(hotbar);

  for (let index = 0; index < VR_HAND_HOTBAR_SLOT_COUNT; index++) {
    const slot = new Rectangle(`vr-left-hand-inventory-slot-${index}`);
    slot.width = "122px";
    slot.height = "122px";
    slot.thickness = 4;
    slot.cornerRadius = 4;
    slot.color = "rgba(160, 160, 160, 0.95)";
    slot.background = "rgba(30, 30, 30, 0.82)";
    slot.isPointerBlocker = false;

    const item = new Rectangle(`vr-left-hand-inventory-item-${index}`);
    item.width = "78px";
    item.height = "78px";
    item.thickness = 1;
    item.color = "rgba(255, 255, 255, 0.35)";
    item.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    item.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    item.isPointerBlocker = false;
    item.isVisible = false;

    const countText = new TextBlock(`vr-left-hand-inventory-count-${index}`);
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
    if (!webXRControls.isActive()) {
      panel.setEnabled(false);
      return;
    }

    const leftControllerPosition = webXRControls.getControllerPosition("left");

    if (!leftControllerPosition) {
      panel.setEnabled(false);
      return;
    }

    const activeCamera = scene.activeCamera;
    const cameraPosition = activeCamera?.globalPosition ?? activeCamera?.position;

    if (!cameraPosition) {
      panel.setEnabled(false);
      return;
    }

    const toCamera = cameraPosition.subtract(leftControllerPosition);
    toCamera.y = 0;

    if (toCamera.lengthSquared() === 0) {
      toCamera.copyFromFloats(0, 0, -1);
    }

    toCamera.normalize();
    panel.position.copyFrom(
      leftControllerPosition
        .add(new Vector3(0, VR_HAND_HOTBAR_VERTICAL_OFFSET, 0))
        .add(toCamera.scale(VR_HAND_HOTBAR_FORWARD_OFFSET)),
    );
    panel.setEnabled(true);
  });

  return { updateUI };
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
