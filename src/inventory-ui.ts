import type { Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { renderItemIconControl } from "./items/rendering";
import { isMobileMode } from "./mobile-controls";
import { type PlayerPhysics } from "./types";

const INVENTORY_SLOT_COUNT = 9;

export function initializeInventoryBar(scene: Scene, player: PlayerPhysics): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("inventory-ui", true, scene);
  const isMobile = isMobileMode();

  if (isMobile) {
    ui.renderAtIdealSize = true;
    ui.idealWidth = 1280;
    ui.idealHeight = 720;
  }

  const slots: Rectangle[] = [];
  const itemIcons: Rectangle[] = [];
  const countTexts: TextBlock[] = [];
  const shortcutTexts: TextBlock[] = [];

  const screenWidth = window.innerWidth || 1024;
  const slotSize = Math.max(
    isMobile ? 34 : 42,
    Math.min(isMobile ? 44 : 52, Math.floor((screenWidth - 24) / INVENTORY_SLOT_COUNT)),
  );
  const itemSize = Math.floor(slotSize * 0.58);

  const hotbar = new StackPanel("inventory-hotbar");
  hotbar.isVertical = false;
  hotbar.width = `${slotSize * INVENTORY_SLOT_COUNT}px`;
  hotbar.height = `${slotSize}px`;
  hotbar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  hotbar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  hotbar.top = isMobile ? "-16px" : "-24px";
  hotbar.isPointerBlocker = true;
  ui.addControl(hotbar);

  const updateUI = (): void => {
    for (let index = 0; index < INVENTORY_SLOT_COUNT; index++) {
      const slot = slots[index];
      const isSelected = index === player.selectedSlot;

      slot.thickness = isSelected ? 4 : 2;
      slot.color = isSelected ? "white" : "rgba(160, 160, 160, 0.95)";
      slot.background = isSelected ? "rgba(90, 90, 90, 0.82)" : "rgba(30, 30, 30, 0.68)";

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
    countText.paddingRight = "2px";
    countText.paddingTop = "2px";
    countText.isPointerBlocker = false;
    countText.isVisible = false;
    countText.shadowBlur = 3;
    countText.shadowColor = "black";

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

    slot.addControl(item);
    slot.addControl(countText);
    slot.addControl(shortcut);

    slots.push(slot);
    itemIcons.push(item);
    countTexts.push(countText);
    shortcutTexts.push(shortcut);
    hotbar.addControl(slot);
  }

  (player as any)._updateInventoryUI = updateUI;
  updateUI();

  window.addEventListener("keydown", (event) => {
    const digitMatch = event.code.match(/^Digit([1-9])$/);
    const numpadMatch = event.code.match(/^Numpad([1-9])$/);
    const selectedNumber = digitMatch?.[1] ?? numpadMatch?.[1];

    if (!selectedNumber) return;

    updateSelectedSlot(Number(selectedNumber) - 1);
    event.preventDefault();
  });

  return ui;
}
