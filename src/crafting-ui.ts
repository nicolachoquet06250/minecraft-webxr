import type { Scene } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Grid, Image as GuiImage, Rectangle, TextBlock } from "@babylonjs/gui";
import { craftingRecipes, type CraftingPattern, type CraftingRecipe } from "./crafts";
import { addToInventory } from "./functions";
import { isMobileMode } from "./mobile-controls";
import { renderItemIconControl } from "./items/rendering";
import { getItemMaxStackSize } from "./items";
import { setCraftingOverlayOpen } from "./ui-state";
import { type InventoryItem, type PlayerPhysics } from "./types";
import { createSteveSvg } from "~/characters";

type CraftingSlot = InventoryItem | null;
type DragSource = { type: "inventory"; index: number } | { type: "craft"; index: number } | { type: "result" };
type DragState = { item: InventoryItem; source: DragSource };

type CraftingLayout = {
  panelWidth: number;
  panelHeight: number;
  panelThickness: number;
  titleFontSize: number;
  titleHeight: number;
  titleTop: number;
  zoneWidth: number;
  topZoneHeight: number;
  topZoneTop: number;
  bottomZoneHeight: number;
  bottomZoneTop: number;
  slotSize: number;
  resultSlotSize: number;
  iconSize: number;
  slotThickness: number;
  countFontSize: number;
  armorSlotsTop: number;
  armorSlotsStep: number;
  armorSlotLeft: number;
  armorSlotSize: number;
  steveContainerSize: number;
  steveImageSize: number;
  steveLeft: number;
  offhandLeft: number;
  craftGridLeft: number;
  craftGridTop: number;
  arrowLeft: number;
  arrowTop: number;
  arrowSize: number;
  arrowFontSize: number;
  resultLeft: number;
  resultTop: number;
  inventoryGridTop: number;
  hotbarGridTop: number;
};

const DESKTOP_CRAFTING_LAYOUT: CraftingLayout = {
  panelWidth: 640,
  panelHeight: 580,
  panelThickness: 4,
  titleFontSize: 22,
  titleHeight: 34,
  titleTop: 10,
  zoneWidth: 584,
  topZoneHeight: 218,
  topZoneTop: -118,
  bottomZoneHeight: 286,
  bottomZoneTop: 138,
  slotSize: 48,
  resultSlotSize: 58,
  iconSize: 34,
  slotThickness: 3,
  countFontSize: 14,
  armorSlotsTop: -74,
  armorSlotsStep: 52,
  armorSlotLeft: -246,
  armorSlotSize: 46,
  steveContainerSize: 120,
  steveImageSize: 150,
  steveLeft: -180,
  offhandLeft: -110,
  craftGridLeft: -6,
  craftGridTop: -22,
  arrowLeft: 88,
  arrowTop: -22,
  arrowSize: 42,
  arrowFontSize: 34,
  resultLeft: 160,
  resultTop: -22,
  inventoryGridTop: -34,
  hotbarGridTop: 90,
};

const MOBILE_PORTRAIT_CRAFTING_LAYOUT: CraftingLayout = {
  panelWidth: 356,
  panelHeight: 548,
  panelThickness: 3,
  titleFontSize: 16,
  titleHeight: 22,
  titleTop: 5,
  zoneWidth: 328,
  topZoneHeight: 176,
  topZoneTop: -92,
  bottomZoneHeight: 202,
  bottomZoneTop: 122,
  slotSize: 34,
  resultSlotSize: 38,
  iconSize: 24,
  slotThickness: 2,
  countFontSize: 10,
  armorSlotsTop: -57,
  armorSlotsStep: 36,
  armorSlotLeft: -135,
  armorSlotSize: 31,
  steveContainerSize: 72,
  steveImageSize: 92,
  steveLeft: -82,
  offhandLeft: -135,
  craftGridLeft: 44,
  craftGridTop: -17,
  arrowLeft: 94,
  arrowTop: -17,
  arrowSize: 24,
  arrowFontSize: 20,
  resultLeft: 131,
  resultTop: -17,
  inventoryGridTop: -34,
  hotbarGridTop: 74,
};

const MOBILE_LANDSCAPE_CRAFTING_LAYOUT: CraftingLayout = {
  panelWidth: 560,
  panelHeight: 420,
  panelThickness: 3,
  titleFontSize: 17,
  titleHeight: 24,
  titleTop: 5,
  zoneWidth: 520,
  topZoneHeight: 154,
  topZoneTop: -88,
  bottomZoneHeight: 174,
  bottomZoneTop: 92,
  slotSize: 38,
  resultSlotSize: 44,
  iconSize: 27,
  slotThickness: 2,
  countFontSize: 11,
  armorSlotsTop: -52,
  armorSlotsStep: 38,
  armorSlotLeft: -224,
  armorSlotSize: 34,
  steveContainerSize: 82,
  steveImageSize: 104,
  steveLeft: -168,
  offhandLeft: -112,
  craftGridLeft: -8,
  craftGridTop: -18,
  arrowLeft: 72,
  arrowTop: -18,
  arrowSize: 34,
  arrowFontSize: 27,
  resultLeft: 130,
  resultTop: -18,
  inventoryGridTop: -26,
  hotbarGridTop: 58,
};

const MOBILE_VIEWPORT_PADDING = 12;
const CRAFT_GRID_SIZE = 2;
const EXTENDED_INVENTORY_SLOT_COUNT = 27;
const HOTBAR_SLOT_COUNT = 9;
const TOTAL_INVENTORY_SLOT_COUNT = EXTENDED_INVENTORY_SLOT_COUNT + HOTBAR_SLOT_COUNT;
const RIGHT_MOUSE_BUTTON = 2;

export function initializeCraftingOverlay(scene: Scene, player: PlayerPhysics): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("crafting-overlay-ui", true, scene);
  const isMobile = isMobileMode();
  const layout = getCraftingLayout(isMobile);
  ui.rootContainer.isVisible = false;
  ui.rootContainer.zIndex = 10_000;
  setCraftingOverlayOpen(false);

  const craftSlots: CraftingSlot[] = Array.from({ length: CRAFT_GRID_SIZE * CRAFT_GRID_SIZE }, () => null);
  const craftSlotControls: Rectangle[] = [];
  const inventorySlotControls: Rectangle[] = [];
  const inventorySlotIndices: number[] = [];
  const resultSlot = createSlot("craft-result-slot", layout.resultSlotSize, layout.slotThickness);
  const resultIcon = createItemIcon("craft-result-icon", layout.iconSize);
  const resultCount = createCountText("craft-result-count", layout.countFontSize);
  const dragPreview = createDragPreview(layout);
  const dragPreviewIcon = createItemIcon("craft-drag-preview-icon", layout.iconSize);
  const dragPreviewCount = createCountText("craft-drag-preview-count", layout.countFontSize);
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
  panel.width = `${layout.panelWidth}px`;
  panel.height = `${layout.panelHeight}px`;
  panel.cornerRadius = 2;
  panel.thickness = layout.panelThickness;
  panel.color = "#373737";
  panel.background = "#c6c6c6";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.isPointerBlocker = true;
  panel.zIndex = 10_001;
  backdrop.addControl(panel);

  const title = new TextBlock("crafting-title", "Crafting");
  title.color = "#404040";
  title.fontSize = layout.titleFontSize;
  title.fontWeight = "bold";
  title.height = `${layout.titleHeight}px`;
  title.top = `${layout.titleTop}px`;
  title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.addControl(title);

  const topZone = new Rectangle("crafting-top-zone");
  topZone.width = `${layout.zoneWidth}px`;
  topZone.height = `${layout.topZoneHeight}px`;
  topZone.top = `${layout.topZoneTop}px`;
  topZone.thickness = 2;
  topZone.color = "#5a5a5a";
  topZone.background = "#bcbcbc";
  panel.addControl(topZone);

  const bottomZone = new Rectangle("crafting-bottom-zone");
  bottomZone.width = `${layout.zoneWidth}px`;
  bottomZone.height = `${layout.bottomZoneHeight}px`;
  bottomZone.top = `${layout.bottomZoneTop}px`;
  bottomZone.thickness = 2;
  bottomZone.color = "#5a5a5a";
  bottomZone.background = "#bcbcbc";
  panel.addControl(bottomZone);

  for (let index = 0; index < 4; index++) {
    const armorSlot = createSlot(`craft-armor-slot-${index}`, layout.armorSlotSize, layout.slotThickness);
    armorSlot.left = `${layout.armorSlotLeft}px`;
    armorSlot.top = `${layout.armorSlotsTop + layout.armorSlotsStep * index}px`;
    topZone.addControl(armorSlot);
  }

  const stevePreviewContainer = new Rectangle("steve-preview-container");
  stevePreviewContainer.width = `${layout.steveContainerSize}px`;
  stevePreviewContainer.height = `${layout.steveContainerSize}px`;
  stevePreviewContainer.left = `${layout.steveLeft}px`;
  stevePreviewContainer.top = "0px";
  stevePreviewContainer.thickness = 0;
  stevePreviewContainer.background = "transparent";
  topZone.addControl(stevePreviewContainer);

  let stevePreviewUrl: string | null = null;

  try {
    const steveSvg = createSteveSvg(
      scene,
      new Vector3(0, 0, 0),
      { physics: false },
      {
        width: layout.steveContainerSize,
        height: layout.steveContainerSize,
        background: null,
        stroke: "none",
      }
    );
    const svgBlob = new Blob([steveSvg], { type: "image/svg+xml" });
    stevePreviewUrl = URL.createObjectURL(svgBlob);
    const stevePreview = new GuiImage("steve-preview", stevePreviewUrl);
    stevePreview.width = `${layout.steveImageSize}px`;
    stevePreview.height = `${layout.steveImageSize}px`;
    stevePreviewContainer.addControl(stevePreview);
  } catch (error) {
    console.warn("Impossible de générer le SVG Steve pour l'aperçu:", error);
  }

  const offhandSlot = createSlot("craft-offhand-slot", layout.armorSlotSize, layout.slotThickness);
  offhandSlot.left = `${layout.offhandLeft}px`;
  offhandSlot.top = `${layout.armorSlotsTop + layout.armorSlotsStep}px`;
  topZone.addControl(offhandSlot);

  const craftGrid = createGrid("crafting-grid", CRAFT_GRID_SIZE, CRAFT_GRID_SIZE, layout.slotSize);
  craftGrid.left = `${layout.craftGridLeft}px`;
  craftGrid.top = `${layout.craftGridTop}px`;
  topZone.addControl(craftGrid);

  for (let index = 0; index < CRAFT_GRID_SIZE * CRAFT_GRID_SIZE; index++) {
    const slot = createSlot(`craft-slot-${index}`, layout.slotSize, layout.slotThickness);
    slot.onPointerDownObservable.add((eventData) => startDragFromCraftSlot(index, getPointerButton(eventData)));
    craftSlotControls.push(slot);
    craftGrid.addControl(slot, Math.floor(index / CRAFT_GRID_SIZE), index % CRAFT_GRID_SIZE);
  }

  const arrow = new TextBlock("crafting-arrow", "➜");
  arrow.color = "#505050";
  arrow.fontSize = layout.arrowFontSize;
  arrow.left = `${layout.arrowLeft}px`;
  arrow.top = `${layout.arrowTop}px`;
  arrow.width = `${layout.arrowSize}px`;
  arrow.height = `${layout.arrowSize}px`;
  topZone.addControl(arrow);

  resultSlot.left = `${layout.resultLeft}px`;
  resultSlot.top = `${layout.resultTop}px`;
  resultSlot.onPointerDownObservable.add(() => startDragFromResultSlot());
  resultSlot.addControl(resultIcon);
  resultSlot.addControl(resultCount);
  topZone.addControl(resultSlot);

  const inventoryGrid = createGrid("crafting-inventory-grid", 3, HOTBAR_SLOT_COUNT, layout.slotSize);
  inventoryGrid.top = `${layout.inventoryGridTop}px`;
  bottomZone.addControl(inventoryGrid);

  for (let index = 0; index < EXTENDED_INVENTORY_SLOT_COUNT; index++) {
    const inventoryIndex = HOTBAR_SLOT_COUNT + index;
    const slot = createSlot(`craft-inventory-slot-${index}`, layout.slotSize, layout.slotThickness);
    slot.onPointerDownObservable.add((eventData) => startDragFromInventorySlot(inventoryIndex, getPointerButton(eventData)));
    inventorySlotControls.push(slot);
    inventorySlotIndices.push(inventoryIndex);
    inventoryGrid.addControl(slot, Math.floor(index / HOTBAR_SLOT_COUNT), index % HOTBAR_SLOT_COUNT);
  }

  const hotbarGrid = createGrid("crafting-hotbar-grid", 1, HOTBAR_SLOT_COUNT, layout.slotSize);
  hotbarGrid.top = `${layout.hotbarGridTop}px`;
  bottomZone.addControl(hotbarGrid);

  for (let index = 0; index < HOTBAR_SLOT_COUNT; index++) {
    const slot = createSlot(`craft-hotbar-slot-${index}`, layout.slotSize, layout.slotThickness);
    const inventoryIndex = index;
    slot.onPointerDownObservable.add((eventData) => startDragFromInventorySlot(inventoryIndex, getPointerButton(eventData)));
    inventorySlotControls.push(slot);
    inventorySlotIndices.push(inventoryIndex);
    hotbarGrid.addControl(slot, 0, index);
  }

  backdrop.addControl(dragPreview);

  window.addEventListener("pointerdown", (event) => {
    if (!ui.rootContainer.isVisible || dragState) return;
    const resultIndex = containsPointer(resultSlot, event.clientX, event.clientY) ? 0 : -1;
    const craftIndex = findControlIndexAt(craftSlotControls, event.clientX, event.clientY);
    const inventoryControlIndex = findControlIndexAt(inventorySlotControls, event.clientX, event.clientY);
    const inventoryIndex = inventoryControlIndex === -1 ? -1 : inventorySlotIndices[inventoryControlIndex];
    if (resultIndex !== -1) startDragFromResultSlot();
    else if (craftIndex !== -1) startDragFromCraftSlot(craftIndex, event.button);
    else if (inventoryIndex !== -1) startDragFromInventorySlot(inventoryIndex, event.button);
    else return;
    moveDragPreview(event.clientX, event.clientY);
    event.preventDefault();
  }, { capture: true, passive: false });

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
    if (ui.rootContainer.isVisible) event.preventDefault();
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "KeyE") { toggle(); updateAll(); event.preventDefault(); return; }
    if (event.code === "Escape") { close(); event.preventDefault(); }
  });

  updateAll();
  return ui;

  function toggle(): void {
    const nextVisible = !ui.rootContainer.isVisible;
    ui.rootContainer.isVisible = nextVisible;
    setCraftingOverlayOpen(nextVisible);
    if (nextVisible && document.pointerLockElement) document.exitPointerLock();
    if (!nextVisible) { cancelDrag(); returnAllCraftSlotsToInventory(); }
  }

  function close(): void {
    if (!ui.rootContainer.isVisible) return;
    cancelDrag();
    returnAllCraftSlotsToInventory();
    ui.rootContainer.isVisible = false;
    setCraftingOverlayOpen(false);
    if (stevePreviewUrl) {
      URL.revokeObjectURL(stevePreviewUrl);
      stevePreviewUrl = null;
    }
    updateAll();
  }

  function startDragFromInventorySlot(index: number, pointerButton: number): void {
    if (dragState || !ui.rootContainer.isVisible) return;
    const item = player.inventory[index];
    if (!item) return;
    const draggedCount = getDraggedCount(item.count, pointerButton);
    dragState = { item: { blockId: item.blockId, count: draggedCount }, source: { type: "inventory", index } };
    item.count -= draggedCount;
    if (item.count <= 0) player.inventory.splice(index, 1);
    showDragPreview(dragState.item);
    updateAll();
  }

  function startDragFromCraftSlot(index: number, pointerButton: number): void {
    if (dragState || !ui.rootContainer.isVisible) return;
    const item = craftSlots[index];
    if (!item) return;
    const draggedCount = getDraggedCount(item.count, pointerButton);
    dragState = { item: { blockId: item.blockId, count: draggedCount }, source: { type: "craft", index } };
    item.count -= draggedCount;
    if (item.count <= 0) craftSlots[index] = null;
    showDragPreview(dragState.item);
    updateAll();
  }

  function startDragFromResultSlot(): void {
    if (dragState || !ui.rootContainer.isVisible || !currentResult) return;
    dragState = { item: { ...currentResult }, source: { type: "result" } };
    showDragPreview(dragState.item);
  }

  function finishDrag(pointerX: number, pointerY: number): void {
    if (!dragState) return;
    const inventoryControlIndex = findControlIndexAt(inventorySlotControls, pointerX, pointerY);
    const inventoryIndex = inventoryControlIndex === -1 ? -1 : inventorySlotIndices[inventoryControlIndex];
    const craftIndex = findControlIndexAt(craftSlotControls, pointerX, pointerY);
    const item = dragState.item;
    let dropped = false;

    if (dragState.source.type === "result") {
      if (inventoryIndex !== -1) {
        dropped = putItemInInventory(item);
        consumeCraftIngredients();
      }
    } else if (craftIndex !== -1) {
      dropped = putItemInCraftSlot(craftIndex, item, true);
    } else if (inventoryIndex !== -1) {
      dropped = putItemInInventory(item);
    }

    if (!dropped) restoreDraggedItem();
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
    if (source.type === "result") return;
    if (source.type === "craft" && putItemInCraftSlot(source.index, item, false)) return;
    putItemInInventory(item);
  }

  function consumeCraftIngredients(): void {
    for (const slot of craftSlots) if (slot) slot.count--;
    for (let index = 0; index < craftSlots.length; index++) {
      if (craftSlots[index] && craftSlots[index]!.count <= 0) craftSlots[index] = null;
    }
  }

  function putItemInCraftSlot(index: number, item: InventoryItem, replaceExisting: boolean): boolean {
    const slot = craftSlots[index];
    if (!slot) { craftSlots[index] = { ...item }; return true; }
    if (replaceExisting) { putItemInInventory(slot); craftSlots[index] = { ...item }; return true; }
    if (slot.blockId !== item.blockId) return false;
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
    for (let index = 0; index < craftSlots.length; index++) returnCraftSlotToInventory(index);
  }

  function updateAll(): void {
    currentResult = findRecipeResult(craftSlots);
    updateCraftSlots();
    updateInventorySlots();
    updateResultSlot();
    if ((player as any)._updateInventoryUI) (player as any)._updateInventoryUI();
  }

  function updateCraftSlots(): void {
    for (let index = 0; index < craftSlotControls.length; index++) renderSlotContent(craftSlotControls[index], craftSlots[index], layout);
  }

  function updateInventorySlots(): void {
    for (let index = 0; index < inventorySlotControls.length; index++) {
      const inventoryIndex = inventorySlotIndices[index];
      renderSlotContent(inventorySlotControls[index], player.inventory[inventoryIndex] ?? null, layout);
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

function getCraftingLayout(isMobile: boolean): CraftingLayout {
  if (!isMobile) return DESKTOP_CRAFTING_LAYOUT;

  const baseLayout = window.innerWidth > window.innerHeight
    ? MOBILE_LANDSCAPE_CRAFTING_LAYOUT
    : MOBILE_PORTRAIT_CRAFTING_LAYOUT;

  return fitMobileLayoutToViewport(baseLayout);
}

function fitMobileLayoutToViewport(layout: CraftingLayout): CraftingLayout {
  const maxWidth = Math.max(240, window.innerWidth - MOBILE_VIEWPORT_PADDING * 2);
  const maxHeight = Math.max(320, window.innerHeight - MOBILE_VIEWPORT_PADDING * 2);
  const scale = Math.min(1, maxWidth / layout.panelWidth, maxHeight / layout.panelHeight);

  if (scale >= 0.995) return layout;

  return scaleCraftingLayout(layout, scale);
}

function scaleCraftingLayout(layout: CraftingLayout, scale: number): CraftingLayout {
  return Object.fromEntries(
    Object.entries(layout).map(([key, value]) => [key, scaleCraftingLayoutValue(key as keyof CraftingLayout, value, scale)])
  ) as CraftingLayout;
}

function scaleCraftingLayoutValue(key: keyof CraftingLayout, value: number, scale: number): number {
  if (key === "panelThickness" || key === "slotThickness") {
    return Math.max(1, Math.round(value * scale));
  }

  return Math.round(value * scale);
}

function getPointerButton(eventData: unknown): number {
  const data = eventData as { buttonIndex?: number; button?: number; event?: { button?: number } };
  return data.buttonIndex ?? data.button ?? data.event?.button ?? 0;
}

function getDraggedCount(stackCount: number, pointerButton: number): number {
  return pointerButton === RIGHT_MOUSE_BUTTON ? stackCount : 1;
}

function addStackToInventory(player: PlayerPhysics, item: InventoryItem): void {
  let remaining = item.count;
  const maxStackSize = getItemMaxStackSize(item.blockId);

  for (const existing of player.inventory) {
    if (remaining <= 0) return;
    if (existing.blockId !== item.blockId || existing.count >= maxStackSize) continue;
    const added = Math.min(maxStackSize - existing.count, remaining);
    existing.count += added;
    remaining -= added;
  }

  while (remaining > 0 && player.inventory.length < TOTAL_INVENTORY_SLOT_COUNT) {
    const added = Math.min(maxStackSize, remaining);
    player.inventory.push({ blockId: item.blockId, count: added });
    remaining -= added;
  }

  if (remaining > 0) for (let count = 0; count < remaining; count++) addToInventory(player, item.blockId);
}

function findControlIndexAt(controls: Rectangle[], pointerX: number, pointerY: number): number {
  return controls.findIndex((control) => containsPointer(control, pointerX, pointerY));
}

function containsPointer(control: Rectangle, pointerX: number, pointerY: number): boolean {
  const measure = (control as any)._currentMeasure;
  if (!measure) return false;
  return pointerX >= measure.left && pointerX <= measure.left + measure.width && pointerY >= measure.top && pointerY <= measure.top + measure.height;
}

function findRecipeResult(slots: CraftingSlot[]): InventoryItem | null {
  const expandedSlots = expandCraftSlotsToThreeByThree(slots);
  for (const recipe of craftingRecipes) if (matchesRecipe(expandedSlots, recipe)) return { ...recipe.result };
  return null;
}

function expandCraftSlotsToThreeByThree(slots: CraftingSlot[]): CraftingSlot[] {
  return [
    slots[0] ?? null, slots[1] ?? null, null,
    slots[2] ?? null, slots[3] ?? null, null,
    null,             null,             null,
  ];
}

function matchesRecipe(slots: CraftingSlot[], recipe: CraftingRecipe): boolean {
  return recipe.patterns.some((pattern) => matchesPattern(slots, pattern));
}

function matchesPattern(slots: CraftingSlot[], pattern: CraftingPattern): boolean {
  for (let index = 0; index < pattern.length; index++) {
    const expected = pattern[index];
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

function createSlot(name: string, size: number, thickness = 3): Rectangle {
  const slot = new Rectangle(name);
  slot.width = `${size}px`;
  slot.height = `${size}px`;
  slot.thickness = thickness;
  slot.color = "#373737";
  slot.background = "#8f8f8f";
  slot.isPointerBlocker = true;
  return slot;
}

function createDragPreview(layout: CraftingLayout): Rectangle {
  const preview = createSlot("craft-drag-preview", layout.slotSize, layout.slotThickness);
  preview.isVisible = false;
  preview.isPointerBlocker = false;
  preview.zIndex = 10_010;
  preview.alpha = 0.92;
  return preview;
}

function renderSlotContent(slot: Rectangle, item: InventoryItem | null, layout: CraftingLayout): void {
  slot.children.slice().forEach((child) => slot.removeControl(child));
  const icon = createItemIcon(`${slot.name}-icon`, Math.floor(layout.slotSize * 0.62));
  const count = createCountText(`${slot.name}-count`, layout.countFontSize);
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

function createCountText(name: string, fontSize: number): TextBlock {
  const text = new TextBlock(name);
  text.color = "white";
  text.fontSize = fontSize;
  text.fontWeight = "bold";
  text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  text.paddingRight = "3px";
  text.paddingBottom = "1px";
  text.shadowBlur = 3;
  text.shadowColor = "black";
  text.isPointerBlocker = false;
  text.isVisible = false;
  return text;
}

function renderItemIcon(icon: Rectangle, countText: TextBlock, item: InventoryItem | null): void {
  renderItemIconControl(icon, item?.blockId ?? null);

  if (!item) {
    countText.isVisible = false;
    return;
  }

  countText.isVisible = item.count > 1;
  countText.text = `${item.count}`;
}
