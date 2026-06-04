import type { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Grid,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { addToInventory, getBlockColor } from "./functions";
import { setCraftingOverlayOpen } from "./ui-state";
import { BlockId, type InventoryItem, type PlayerPhysics } from "./types";

type CraftingSlot = InventoryItem | null;

type CraftingRecipe = {
  pattern: (BlockId | null)[];
  result: InventoryItem;
};

type DragSource =
  | { type: "inventory"; index: number }
  | { type: "craft"; index: number };

type DragState = {
  item: InventoryItem;
  source: DragSource;
};

const SLOT_SIZE = 48;
const CRAFT_GRID_SIZE = 3;
const INVENTORY_SLOT_COUNT = 9;
const MAX_STACK_SIZE = 64;
const RIGHT_MOUSE_BUTTON = 2;

const recipes: CraftingRecipe[] = [
  { pattern: [BlockId.OakLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.OakPlanks, count: 4 } },
  { pattern: [BlockId.SpruceLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.SprucePlanks, count: 4 } },
  { pattern: [BlockId.BirchLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.BirchPlanks, count: 4 } },
  { pattern: [BlockId.JungleLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.JunglePlanks, count: 4 } },
  { pattern: [BlockId.AcaciaLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.AcaciaPlanks, count: 4 } },
  { pattern: [BlockId.DarkOakLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.DarkOakPlanks, count: 4 } },
  { pattern: [BlockId.MangroveLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.MangrovePlanks, count: 4 } },
  { pattern: [BlockId.CherryLog, null, null, null, null, null, null, null, null], result: { blockId: BlockId.CherryPlanks, count: 4 } },
  {
    pattern: [BlockId.OakPlanks, BlockId.OakPlanks, null, BlockId.OakPlanks, BlockId.OakPlanks, null, null, null, null],
    result: { blockId: BlockId.CraftingTable, count: 1 },
  },
];

export function initializeCraftingOverlay(scene: Scene, player: PlayerPhysics): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("crafting-overlay-ui", true, scene);
  ui.rootContainer.isVisible = false;
  ui.rootContainer.zIndex = 10_000;
  setCraftingOverlayOpen(false);

  const craftSlots: CraftingSlot[] = Array.from({ length: CRAFT_GRID_SIZE * CRAFT_GRID_SIZE }, () => null);
  const craftSlotControls: Rectangle[] = [];
  const inventorySlotControls: Rectangle[] = [];
  const resultSlot = createSlot("craft-result-slot", 58);
  const resultIcon = createItemIcon("craft-result-icon", 34);
  const resultCount = createCountText("craft-result-count");
  const dragPreview = createDragPreview();
  const dragPreviewIcon = createItemIcon("craft-drag-preview-icon", 34);
  const dragPreviewCount = createCountText("craft-drag-preview-count");
  let currentResult: InventoryItem | null = null;
  let dragState: DragState | null = null;

  dragPreview.addControl(dragPreviewIcon);
  dragPreview.addControl(dragPreviewCount);

  const backdrop = new Rectangle("crafting-backdrop");
  backdrop.width = "100%";
  backdrop.height = "100%";
  backdrop.thickness = 0;
  backdrop.background = "rgba(0, 0, 0, 0.48)";
  backdrop.isPointerBlocker = true;
  backdrop.zIndex = 10_000;
  ui.addControl(backdrop);

  const panel = new Rectangle("crafting-panel");
  panel.width = "520px";
  panel.height = "360px";
  panel.cornerRadius = 2;
  panel.thickness = 4;
  panel.color = "#373737";
  panel.background = "#c6c6c6";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.isPointerBlocker = true;
  panel.zIndex = 10_001;
  backdrop.addControl(panel);

  const title = new TextBlock("crafting-title", "Crafting");
  title.color = "#404040";
  title.fontSize = 22;
  title.fontWeight = "bold";
  title.height = "34px";
  title.top = "14px";
  title.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.addControl(title);

  const craftGrid = createGrid("crafting-grid", CRAFT_GRID_SIZE, CRAFT_GRID_SIZE, SLOT_SIZE);
  craftGrid.left = "-112px";
  craftGrid.top = "-44px";
  panel.addControl(craftGrid);

  for (let index = 0; index < craftSlots.length; index++) {
    const slot = createSlot(`craft-slot-${index}`, SLOT_SIZE);
    slot.onPointerDownObservable.add((eventData) => startDragFromCraftSlot(index, getPointerButton(eventData)));
    craftSlotControls.push(slot);
    craftGrid.addControl(slot, Math.floor(index / CRAFT_GRID_SIZE), index % CRAFT_GRID_SIZE);
  }

  const arrow = new TextBlock("crafting-arrow", "➜");
  arrow.color = "#505050";
  arrow.fontSize = 34;
  arrow.left = "34px";
  arrow.top = "-44px";
  arrow.width = "42px";
  arrow.height = "42px";
  panel.addControl(arrow);

  resultSlot.left = "106px";
  resultSlot.top = "-44px";
  resultSlot.onPointerClickObservable.add(() => {
    craftCurrentRecipe();
    updateAll();
  });
  resultSlot.addControl(resultIcon);
  resultSlot.addControl(resultCount);
  panel.addControl(resultSlot);

  const inventoryLabel = new TextBlock("crafting-inventory-label", "Inventory");
  inventoryLabel.color = "#404040";
  inventoryLabel.fontSize = 18;
  inventoryLabel.height = "28px";
  inventoryLabel.left = "-132px";
  inventoryLabel.top = "72px";
  inventoryLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  inventoryLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.addControl(inventoryLabel);

  const inventoryGrid = createGrid("crafting-inventory-grid", 1, INVENTORY_SLOT_COUNT, SLOT_SIZE);
  inventoryGrid.top = "124px";
  panel.addControl(inventoryGrid);

  for (let index = 0; index < INVENTORY_SLOT_COUNT; index++) {
    const slot = createSlot(`craft-inventory-slot-${index}`, SLOT_SIZE);
    slot.onPointerDownObservable.add((eventData) => startDragFromInventorySlot(index, getPointerButton(eventData)));
    inventorySlotControls.push(slot);
    inventoryGrid.addControl(slot, 0, index);
  }

  backdrop.addControl(dragPreview);

  window.addEventListener("pointermove", (event) => {
    if (!dragState || !ui.rootContainer.isVisible) return;

    moveDragPreview(event.clientX, event.clientY);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener("pointerup", (event) => {
    if (!dragState || !ui.rootContainer.isVisible) return;

    finishDrag(event.clientX, event.clientY);
    event.preventDefault();
  }, { passive: false });

  window.addEventListener("touchmove", (event) => {
    if (ui.rootContainer.isVisible) event.preventDefault();
  }, { passive: false });

  window.addEventListener("contextmenu", (event) => {
    if (!ui.rootContainer.isVisible) return;

    event.preventDefault();
  });

  function toggle(): void {
    const nextVisible = !ui.rootContainer.isVisible;
    ui.rootContainer.isVisible = nextVisible;
    setCraftingOverlayOpen(nextVisible);

    if (nextVisible && document.pointerLockElement) {
      document.exitPointerLock();
    }

    if (!nextVisible) {
      cancelDrag();
      returnAllCraftSlotsToInventory();
    }
  }

  function close(): void {
    if (!ui.rootContainer.isVisible) return;

    cancelDrag();
    returnAllCraftSlotsToInventory();
    ui.rootContainer.isVisible = false;
    setCraftingOverlayOpen(false);
    updateAll();
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyE") {
      toggle();
      updateAll();
      event.preventDefault();
      return;
    }

    if (event.code === "Escape") {
      close();
      event.preventDefault();
    }
  });

  updateAll();
  return ui;

  function startDragFromInventorySlot(index: number, pointerButton: number): void {
    if (dragState || !ui.rootContainer.isVisible) return;

    const item = player.inventory[index];
    if (!item) return;

    const draggedCount = getDraggedCount(item.count, pointerButton);

    dragState = {
      item: { blockId: item.blockId, count: draggedCount },
      source: { type: "inventory", index },
    };

    item.count -= draggedCount;

    if (item.count <= 0) {
      player.inventory.splice(index, 1);
    }

    showDragPreview(dragState.item);
    updateAll();
  }

  function startDragFromCraftSlot(index: number, pointerButton: number): void {
    if (dragState || !ui.rootContainer.isVisible) return;

    const item = craftSlots[index];
    if (!item) return;

    const draggedCount = getDraggedCount(item.count, pointerButton);

    dragState = {
      item: { blockId: item.blockId, count: draggedCount },
      source: { type: "craft", index },
    };

    item.count -= draggedCount;

    if (item.count <= 0) {
      craftSlots[index] = null;
    }

    showDragPreview(dragState.item);
    updateAll();
  }

  function finishDrag(pointerX: number, pointerY: number): void {
    if (!dragState) return;

    const craftIndex = findControlIndexAt(craftSlotControls, pointerX, pointerY);
    const inventoryIndex = findControlIndexAt(inventorySlotControls, pointerX, pointerY);
    const item = dragState.item;
    let dropped = false;

    if (craftIndex !== -1) {
      dropped = putItemInCraftSlot(craftIndex, item, true);
    } else if (inventoryIndex !== -1) {
      dropped = putItemInInventory(item);
    }

    if (!dropped) {
      restoreDraggedItem();
    }

    dragState = null;
    hideDragPreview();
    updateAll();
  }

  function cancelDrag(): void {
    if (!dragState) return;

    restoreDraggedItem();
    dragState = null;
    hideDragPreview();
    updateAll();
  }

  function restoreDraggedItem(): void {
    if (!dragState) return;

    const { item, source } = dragState;

    if (source.type === "craft") {
      if (putItemInCraftSlot(source.index, item, false)) return;
    }

    putItemInInventory(item);
  }

  function putItemInCraftSlot(index: number, item: InventoryItem, replaceExisting: boolean): boolean {
    const slot = craftSlots[index];

    if (!slot) {
      craftSlots[index] = { ...item };
      return true;
    }

    if (replaceExisting) {
      putItemInInventory(slot);
      craftSlots[index] = { ...item };
      return true;
    }

    if (slot.blockId !== item.blockId) {
      return false;
    }

    slot.count += item.count;
    return true;
  }

  function putItemInInventory(item: InventoryItem): boolean {
    addStackToInventory(player, item);
    return true;
  }

  function returnCraftSlotToInventory(index: number): void {
    const item = craftSlots[index];
    if (!item) return;

    putItemInInventory(item);
    craftSlots[index] = null;
  }

  function returnAllCraftSlotsToInventory(): void {
    for (let index = 0; index < craftSlots.length; index++) {
      returnCraftSlotToInventory(index);
    }
  }

  function craftCurrentRecipe(): void {
    if (!currentResult || dragState) return;

    for (const slot of craftSlots) {
      if (slot) slot.count--;
    }

    for (let index = 0; index < craftSlots.length; index++) {
      if (craftSlots[index] && craftSlots[index]!.count <= 0) {
        craftSlots[index] = null;
      }
    }

    putItemInInventory(currentResult);
  }

  function updateAll(): void {
    currentResult = findRecipeResult(craftSlots);
    updateCraftSlots();
    updateInventorySlots();
    updateResultSlot();

    if ((player as any)._updateInventoryUI) {
      (player as any)._updateInventoryUI();
    }
  }

  function updateCraftSlots(): void {
    for (let index = 0; index < craftSlotControls.length; index++) {
      renderSlotContent(craftSlotControls[index], craftSlots[index]);
    }
  }

  function updateInventorySlots(): void {
    for (let index = 0; index < inventorySlotControls.length; index++) {
      renderSlotContent(inventorySlotControls[index], player.inventory[index] ?? null);
    }
  }

  function updateResultSlot(): void {
    renderItemIcon(resultIcon, resultCount, currentResult);
    resultSlot.background = currentResult ? "#e8e8e8" : "#8f8f8f";
  }

  function showDragPreview(item: InventoryItem): void {
    dragPreview.isVisible = true;
    renderItemIcon(dragPreviewIcon, dragPreviewCount, item);
    moveDragPreview(scene.pointerX, scene.pointerY);
  }

  function hideDragPreview(): void {
    dragPreview.isVisible = false;
    renderItemIcon(dragPreviewIcon, dragPreviewCount, null);
  }

  function moveDragPreview(pointerX: number, pointerY: number): void {
    dragPreview.left = `${pointerX - window.innerWidth / 2}px`;
    dragPreview.top = `${pointerY - window.innerHeight / 2}px`;
  }
}

function getPointerButton(eventData: unknown): number {
  const data = eventData as {
    buttonIndex?: number;
    button?: number;
    event?: { button?: number };
  };

  return data.buttonIndex ?? data.button ?? data.event?.button ?? 0;
}

function getDraggedCount(stackCount: number, pointerButton: number): number {
  if (pointerButton === RIGHT_MOUSE_BUTTON) {
    return stackCount;
  }

  return 1;
}

function addStackToInventory(player: PlayerPhysics, item: InventoryItem): void {
  let remaining = item.count;

  for (const existing of player.inventory) {
    if (remaining <= 0) return;
    if (existing.blockId !== item.blockId || existing.count >= MAX_STACK_SIZE) continue;

    const added = Math.min(MAX_STACK_SIZE - existing.count, remaining);
    existing.count += added;
    remaining -= added;
  }

  while (remaining > 0 && player.inventory.length < INVENTORY_SLOT_COUNT) {
    const added = Math.min(MAX_STACK_SIZE, remaining);
    player.inventory.push({ blockId: item.blockId, count: added });
    remaining -= added;
  }

  if (remaining > 0) {
    for (let count = 0; count < remaining; count++) addToInventory(player, item.blockId);
  }
}

function findControlIndexAt(controls: Rectangle[], pointerX: number, pointerY: number): number {
  return controls.findIndex((control) => containsPointer(control, pointerX, pointerY));
}

function containsPointer(control: Rectangle, pointerX: number, pointerY: number): boolean {
  const measure = (control as any)._currentMeasure;

  if (!measure) return false;

  return (
    pointerX >= measure.left &&
    pointerX <= measure.left + measure.width &&
    pointerY >= measure.top &&
    pointerY <= measure.top + measure.height
  );
}

function findRecipeResult(slots: CraftingSlot[]): InventoryItem | null {
  for (const recipe of recipes) {
    if (matchesRecipe(slots, recipe)) {
      return { ...recipe.result };
    }
  }

  return null;
}

function matchesRecipe(slots: CraftingSlot[], recipe: CraftingRecipe): boolean {
  for (let index = 0; index < recipe.pattern.length; index++) {
    const expected = recipe.pattern[index];
    const actual = slots[index];

    if (expected === null && actual !== null) return false;
    if (expected !== null && (!actual || actual.blockId !== expected || actual.count <= 0)) return false;
  }

  return true;
}

function createGrid(name: string, rows: number, columns: number, slotSize: number): Grid {
  const grid = new Grid(name);
  grid.width = `${columns * slotSize}px`;
  grid.height = `${rows * slotSize}px`;
  grid.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  grid.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

  for (let row = 0; row < rows; row++) grid.addRowDefinition(1 / rows);
  for (let column = 0; column < columns; column++) grid.addColumnDefinition(1 / columns);

  return grid;
}

function createSlot(name: string, size: number): Rectangle {
  const slot = new Rectangle(name);
  slot.width = `${size}px`;
  slot.height = `${size}px`;
  slot.thickness = 3;
  slot.color = "#373737";
  slot.background = "#8f8f8f";
  slot.isPointerBlocker = true;

  return slot;
}

function createDragPreview(): Rectangle {
  const preview = createSlot("craft-drag-preview", SLOT_SIZE);
  preview.isVisible = false;
  preview.isPointerBlocker = false;
  preview.zIndex = 10_010;
  preview.alpha = 0.92;

  return preview;
}

function renderSlotContent(slot: Rectangle, item: InventoryItem | null): void {
  slot.children.slice().forEach((child) => slot.removeControl(child));

  const icon = createItemIcon(`${slot.name}-icon`, Math.floor(SLOT_SIZE * 0.62));
  const count = createCountText(`${slot.name}-count`);
  slot.addControl(icon);
  slot.addControl(count);

  renderItemIcon(icon, count, item);
}

function createItemIcon(name: string, size: number): Rectangle {
  const icon = new Rectangle(name);
  icon.width = `${size}px`;
  icon.height = `${size}px`;
  icon.thickness = 1;
  icon.color = "rgba(255, 255, 255, 0.35)";
  icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  icon.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  icon.isPointerBlocker = false;
  icon.isVisible = false;

  return icon;
}

function createCountText(name: string): TextBlock {
  const text = new TextBlock(name);
  text.color = "white";
  text.fontSize = 14;
  text.fontWeight = "bold";
  text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  text.paddingRight = "4px";
  text.paddingBottom = "2px";
  text.shadowBlur = 3;
  text.shadowColor = "black";
  text.isPointerBlocker = false;
  text.isVisible = false;

  return text;
}

function renderItemIcon(icon: Rectangle, countText: TextBlock, item: InventoryItem | null): void {
  if (!item) {
    icon.isVisible = false;
    countText.isVisible = false;
    return;
  }

  const color = getBlockColor(item.blockId);
  icon.isVisible = true;
  icon.background = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`;
  countText.isVisible = item.count > 1;
  countText.text = `${item.count}`;
}
