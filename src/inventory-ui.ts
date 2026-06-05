import { Mesh, MeshBuilder, Quaternion, Scene, TransformNode } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { EYE_HEIGHT } from "./constants";
import { renderItemIconControl } from "./items/rendering";
import { isMobileMode } from "./mobile-controls";
import { type PlayerPhysics } from "./types";
import type { WebXRGameControls, XRHandedness } from "./vr-mode";

const INVENTORY_SLOT_COUNT = 9;
const VR_HOTBAR_DISTANCE = 1.15;
const VR_HOTBAR_VERTICAL_OFFSET = -0.42;
const VR_HOTBAR_WIDTH = 1.45;
const VR_HOTBAR_HEIGHT = 0.24;
const VR_TRIGGER_SELECTION_COOLDOWN_MS = 180;

type InventoryBarControls = {
  readonly updateUI: () => void;
  readonly updateSelectedSlot: (nextSelectedIndex: number) => void;
};

type VRSlotHitbox = {
  readonly index: number;
  readonly mesh: Mesh;
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
  const bodyAnchor = new TransformNode("vr-body-ui-anchor", scene);
  bodyAnchor.setEnabled(false);

  const panel = MeshBuilder.CreatePlane(
    "vr-inventory-hotbar-panel",
    { width: VR_HOTBAR_WIDTH, height: VR_HOTBAR_HEIGHT },
    scene,
  );
  panel.isPickable = false;
  panel.parent = bodyAnchor;
  panel.position.set(0, VR_HOTBAR_VERTICAL_OFFSET, VR_HOTBAR_DISTANCE);
  panel.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0);
  panel.setEnabled(false);

  const hitboxes = createVRSlotHitboxes(scene, bodyAnchor);
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

  let lastSelectedSlot = -1;
  let lastSelectionTime = 0;

  scene.onBeforeRenderObservable.add(() => {
    if (!webXRControls.isActive()) {
      bodyAnchor.setEnabled(false);
      panel.setEnabled(false);
      hitboxes.forEach((hitbox) => hitbox.mesh.setEnabled(false));
      return;
    }

    bodyAnchor.setEnabled(true);
    panel.setEnabled(true);
    hitboxes.forEach((hitbox) => hitbox.mesh.setEnabled(true));
    bodyAnchor.position.copyFromFloats(player.position.x, player.position.y + EYE_HEIGHT, player.position.z);
    bodyAnchor.rotationQuaternion = Quaternion.FromEulerAngles(0, player.yaw, 0);

    const pointedSlot = findPointedVRSlot(webXRControls, hitboxes);
    const canSelect = performance.now() - lastSelectionTime >= VR_TRIGGER_SELECTION_COOLDOWN_MS;

    if (pointedSlot !== null && canSelect && isAnyVRTriggerPressed(webXRControls)) {
      controls.updateSelectedSlot(pointedSlot);
      lastSelectedSlot = pointedSlot;
      lastSelectionTime = performance.now();
      return;
    }

    lastSelectedSlot = pointedSlot ?? lastSelectedSlot;
  });

  return panel;
}

function createVRSlotHitboxes(scene: Scene, bodyAnchor: TransformNode): VRSlotHitbox[] {
  const slotWidth = VR_HOTBAR_WIDTH / INVENTORY_SLOT_COUNT;
  const hitboxes: VRSlotHitbox[] = [];

  for (let index = 0; index < INVENTORY_SLOT_COUNT; index++) {
    const hitbox = MeshBuilder.CreatePlane(
      `vr-inventory-slot-hitbox-${index}`,
      { width: slotWidth, height: VR_HOTBAR_HEIGHT },
      scene,
    );
    hitbox.parent = bodyAnchor;
    hitbox.position.set(
      -VR_HOTBAR_WIDTH / 2 + slotWidth * index + slotWidth / 2,
      VR_HOTBAR_VERTICAL_OFFSET,
      VR_HOTBAR_DISTANCE - 0.005,
    );
    hitbox.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0);
    hitbox.isVisible = false;
    hitbox.isPickable = true;
    hitbox.setEnabled(false);
    hitboxes.push({ index, mesh: hitbox });
  }

  return hitboxes;
}

function findPointedVRSlot(webXRControls: WebXRGameControls, hitboxes: VRSlotHitbox[]): number | null {
  for (const handedness of ["right", "left"] as const satisfies XRHandedness[]) {
    const ray = webXRControls.getControllerRay(handedness);

    if (!ray) continue;

    for (const hitbox of hitboxes) {
      const hit = ray.intersectsMesh(hitbox.mesh, false);

      if (hit.hit) {
        return hitbox.index;
      }
    }
  }

  return null;
}

function isAnyVRTriggerPressed(webXRControls: WebXRGameControls): boolean {
  return webXRControls.isTriggerPressed("right") || webXRControls.isTriggerPressed("left");
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
