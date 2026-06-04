import { Mesh, MeshBuilder, Quaternion, Scene, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { EYE_HEIGHT } from "./constants";
import { renderItemIconControl } from "./items/rendering";
import { isMobileMode } from "./mobile-controls";
import { type PlayerPhysics } from "./types";
import type { WebXRGameControls } from "./vr-mode";

const INVENTORY_SLOT_COUNT = 9;
const VR_HOTBAR_DISTANCE = 1.15;
const VR_HOTBAR_VERTICAL_OFFSET = -0.42;

type InventoryBarControls = {
  readonly updateUI: () => void;
  readonly updateSelectedSlot: (nextSelectedIndex: number) => void;
};

export function initializeInventoryBar(scene: Scene, player: PlayerPhysics): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("inventory-ui", true, scene);
  const isMobile = isMobileMode();

  if (isMobile) {
    ui.renderAtIdealSize = true;
    ui.idealWidth = 1280;
    ui.idealHeight = 720;
  }

  const screenWidth = window.innerWidth || 1024;
  const slotSize = Math.max(
    isMobile ? 34 : 42,
    Math.min(isMobile ? 44 : 52, Math.floor((screenWidth - 24) / INVENTORY_SLOT_COUNT)),
  );

  const controls = createInventoryBarControls({
    ui,
    player,
    slotSize,
    top: isMobile ? "-16px" : "-24px",
    showShortcuts: true,
  });

  registerInventoryUpdater(player, controls.updateUI);
  controls.updateUI();

  window.addEventListener("keydown", (event) => {
    const digitMatch = event.code.match(/^Digit([1-9])$/);
    const numpadMatch = event.code.match(/^Numpad([1-9])$/);
    const selectedNumber = digitMatch?.[1] ?? numpadMatch?.[1];

    if (!selectedNumber) return;

    controls.updateSelectedSlot(Number(selectedNumber) - 1);
    event.preventDefault();
  });

  return ui;
}

export function initializeVRInventoryBar(
  scene: Scene,
  player: PlayerPhysics,
  webXRControls: WebXRGameControls,
): Mesh {
  const panel = MeshBuilder.CreatePlane(
    "vr-inventory-hotbar-panel",
    { width: 1.45, height: 0.24 },
    scene,
  );
  panel.isPickable = false;
  panel.setEnabled(false);
  panel.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0);

  const ui = AdvancedDynamicTexture.CreateForMesh(panel, 1450, 240, false);
  const controls = createInventoryBarControls({
    ui,
    player,
    slotSize: 130,
    top: "0px",
    showShortcuts: false,
  });

  registerInventoryUpdater(player, controls.updateUI);
  controls.updateUI();

  scene.onBeforeRenderObservable.add(() => {
    if (!webXRControls.isActive()) {
      panel.setEnabled(false);
      return;
    }

    panel.setEnabled(true);

    if (panel.parent !== null) {
      panel.parent = null;
    }

    const forward = new Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const bodyOrigin = player.position.add(new Vector3(0, EYE_HEIGHT, 0));

    panel.position.copyFrom(
      bodyOrigin
        .add(forward.scale(VR_HOTBAR_DISTANCE))
        .add(new Vector3(0, VR_HOTBAR_VERTICAL_OFFSET, 0)),
    );
    panel.rotationQuaternion = Quaternion.FromEulerAngles(0, player.yaw + Math.PI, 0);
  });

  return panel;
}

function createInventoryBarControls(params: {
  ui: AdvancedDynamicTexture;
  player: PlayerPhysics;
  slotSize: number;
  top: string;
  showShortcuts: boolean;
}): InventoryBarControls {
  const { ui, player, slotSize, top, showShortcuts } = params;
  const slots: Rectangle[] = [];
  const itemIcons: Rectangle[] = [];
  const countTexts: TextBlock[] = [];
  const itemSize = Math.floor(slotSize * 0.58);

  const hotbar = new StackPanel("inventory-hotbar");
  hotbar.isVertical = false;
  hotbar.width = `${slotSize * INVENTORY_SLOT_COUNT}px`;
  hotbar.height = `${slotSize}px`;
  hotbar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  hotbar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  hotbar.top = top;
  hotbar.isPointerBlocker = true;
  ui.addControl(hotbar);

  const updateUI = (): void => {
    for (let index = 0; index < INVENTORY_SLOT_COUNT; index++) {
      const slot = slots[index];
      const isSelected = index === player.selectedSlot;

      slot.thickness = isSelected ? 8 : 4;
      slot.color = isSelected ? "white" : "rgba(160, 160, 160, 0.95)";
      slot.background = isSelected ? "rgba(90, 90, 90, 0.86)" : "rgba(30, 30, 30, 0.72)";

      const inventoryItem = player.inventory[index];
      const icon = itemIcons[index];
      const countText = countTexts[index];

      renderItemIconControl(icon, inventoryItem?.blockId ?? null);

      if (inventoryItem) {
        countText.isVisible = inventoryItem.count > 1;
        countText.text = `${inventoryItem.count}`;
      } else {
        countText.isVisible = false;
      }
    }
  };

  const updateSelectedSlot = (nextSelectedIndex: number): void => {
    if (nextSelectedIndex < 0 || nextSelectedIndex >= INVENTORY_SLOT_COUNT) return;

    player.selectedSlot = nextSelectedIndex;
    updateUI();
    const chainedUpdater = (player as any)._updateInventoryUI;

    if (typeof chainedUpdater === "function") {
      chainedUpdater();
    }
  };

  for (let index = 0; index < INVENTORY_SLOT_COUNT; index++) {
    const slot = new Rectangle(`inventory-slot-${index}`);
    slot.width = `${slotSize}px`;
    slot.height = `${slotSize}px`;
    slot.thickness = 2;
    slot.color = "rgba(160, 160, 160, 0.95)";
    slot.background = "rgba(30, 30, 30, 0.68)";
    slot.isPointerBlocker = true;
    slot.onPointerClickObservable.add(() => updateSelectedSlot(index));

    const item = new Rectangle(`inventory-item-${index}`);
    item.width = `${itemSize}px`;
    item.height = `${itemSize}px`;
    item.thickness = 1;
    item.color = "rgba(255, 255, 255, 0.35)";
    item.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    item.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    item.isPointerBlocker = false;
    item.isVisible = false;

    const countText = new TextBlock(`inventory-count-${index}`);
    countText.color = "white";
    countText.fontSize = Math.max(10, Math.floor(slotSize * 0.3));
    countText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    countText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    countText.paddingRight = "6px";
    countText.paddingTop = "4px";
    countText.isPointerBlocker = false;
    countText.isVisible = false;
    countText.shadowBlur = 3;
    countText.shadowColor = "black";

    slot.addControl(item);
    slot.addControl(countText);

    if (showShortcuts) {
      const shortcut = new TextBlock(`inventory-shortcut-${index}`);
      shortcut.text = `${index + 1}`;
      shortcut.color = "rgba(255, 255, 255, 0.9)";
      shortcut.fontSize = Math.max(10, Math.floor(slotSize * 0.22));
      shortcut.width = `${slotSize}px`;
      shortcut.height = `${slotSize}px`;
      shortcut.paddingLeft = "4px";
      shortcut.paddingBottom = "2px";
      shortcut.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      shortcut.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      shortcut.isPointerBlocker = false;
      slot.addControl(shortcut);
    }

    slots.push(slot);
    itemIcons.push(item);
    countTexts.push(countText);
    hotbar.addControl(slot);
  }

  return { updateUI, updateSelectedSlot };
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
