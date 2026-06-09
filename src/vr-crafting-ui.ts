import { Axis, Color3, Matrix, Mesh, MeshBuilder, Ray, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Grid, Rectangle, TextBlock } from "@babylonjs/gui";
import { craftingRecipes, type CraftingPattern, type CraftingRecipe } from "./crafts";
import { addToInventory } from "./functions";
import { renderItemIconControl } from "./items/rendering";
import { getItemMaxStackSize } from "./items";
import { setCraftingOverlayOpen } from "./ui-state";
import { type InventoryItem, type PlayerPhysics } from "./types";

type CraftingSlot = InventoryItem | null;
type DragSource = { type: "inventory"; index: number } | { type: "craft"; index: number } | { type: "result" };
type DragState = { item: InventoryItem; source: DragSource };

type VRCraftingOverlayControls = {
  readonly panel: Mesh;
  readonly pickPlane: Mesh;
  readonly toggle: () => void;
  readonly close: () => void;
  readonly isOpen: () => boolean;
  readonly isRayPointingAtCrafting: (ray: Ray | null) => boolean;
  readonly tryHandlePrimaryAction: (ray: Ray | null) => boolean;
  readonly syncXRState: (isXRActive: boolean) => void;
};

const SLOT_SIZE = 48;
const CRAFT_GRID_SIZE = 2;
const EXTENDED_INVENTORY_SLOT_COUNT = 27;
const HOTBAR_SLOT_COUNT = 9;
const TOTAL_INVENTORY_SLOT_COUNT = EXTENDED_INVENTORY_SLOT_COUNT + HOTBAR_SLOT_COUNT;
const VR_CRAFT_PANEL_WIDTH = 1.25;
const VR_CRAFT_PANEL_HEIGHT = 1.13;
const VR_CRAFT_PANEL_DISTANCE = 1.2;
const VR_CRAFT_PANEL_VERTICAL_OFFSET = -0.08;
const VR_CRAFT_PANEL_TEXTURE_WIDTH = 1024;
const VR_CRAFT_PANEL_TEXTURE_HEIGHT = 928;
const VR_TRIGGER_SELECTION_COOLDOWN_MS = 160;

export function initializeVRCraftingOverlay(scene: Scene, player: PlayerPhysics): VRCraftingOverlayControls {
  const panel = MeshBuilder.CreatePlane(
    "vr-crafting-panel",
    { width: VR_CRAFT_PANEL_WIDTH, height: VR_CRAFT_PANEL_HEIGHT },
    scene,
  );
  panel.isPickable = false;
  panel.alwaysSelectAsActiveMesh = true;
  panel.setEnabled(false);

  const pickPlane = MeshBuilder.CreatePlane(
    "vr-crafting-pick-plane",
    { width: VR_CRAFT_PANEL_WIDTH, height: VR_CRAFT_PANEL_HEIGHT },
    scene,
  );
  pickPlane.isPickable = true;
  pickPlane.alwaysSelectAsActiveMesh = true;
  pickPlane.setEnabled(false);

  const pickMaterial = new StandardMaterial("vr-crafting-pick-material", scene);
  pickMaterial.diffuseColor = Color3.White();
  pickMaterial.alpha = 0.01;
  pickMaterial.specularColor = Color3.Black();
  pickPlane.material = pickMaterial;

  const ui = AdvancedDynamicTexture.CreateForMesh(
    panel,
    VR_CRAFT_PANEL_TEXTURE_WIDTH,
    VR_CRAFT_PANEL_TEXTURE_HEIGHT,
    false,
  );
  ui.rootContainer.isVisible = false;
  ui.rootContainer.zIndex = 10_000;

  setCraftingOverlayOpen(false);

  const craftSlots: CraftingSlot[] = Array.from({ length: CRAFT_GRID_SIZE * CRAFT_GRID_SIZE }, () => null);
  const craftSlotControls: Rectangle[] = [];
  const inventorySlotControls: Rectangle[] = [];
  const inventorySlotIndices: number[] = [];
  const resultSlot = createSlot("vr-craft-result-slot", 58);
  const resultIcon = createItemIcon("vr-craft-result-icon", 34);
  const resultCount = createCountText("vr-craft-result-count");
  const dragPreview = createDragPreview();
  const dragPreviewIcon = createItemIcon("vr-craft-drag-preview-icon", 34);
  const dragPreviewCount = createCountText("vr-craft-drag-preview-count");
  let currentResult: InventoryItem | null = null;
  let dragState: DragState | null = null;
  let lastSelectionTime = 0;

  dragPreview.addControl(dragPreviewIcon);
  dragPreview.addControl(dragPreviewCount);

  const backdrop = new Rectangle("vr-crafting-backdrop");
  backdrop.width = "100%";
  backdrop.height = "100%";
  backdrop.thickness = 0;
  backdrop.background = "rgba(0, 0, 0, 0.48)";
  backdrop.isPointerBlocker = true;
  backdrop.zIndex = 10_000;
  ui.addControl(backdrop);

  const panelRect = new Rectangle("vr-crafting-panel-rect");
  panelRect.width = "640px";
  panelRect.height = "580px";
  panelRect.cornerRadius = 2;
  panelRect.thickness = 4;
  panelRect.color = "#373737";
  panelRect.background = "#c6c6c6";
  panelRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panelRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panelRect.isPointerBlocker = true;
  panelRect.zIndex = 10_001;
  backdrop.addControl(panelRect);

  const title = new TextBlock("vr-crafting-title", "Crafting");
  title.color = "#404040";
  title.fontSize = 22;
  title.fontWeight = "bold";
  title.height = "34px";
  title.top = "10px";
  title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panelRect.addControl(title);

  const topZone = new Rectangle("vr-crafting-top-zone");
  topZone.width = "584px";
  topZone.height = "218px";
  topZone.top = "-118px";
  topZone.thickness = 2;
  topZone.color = "#5a5a5a";
  topZone.background = "#bcbcbc";
  panelRect.addControl(topZone);

  const bottomZone = new Rectangle("vr-crafting-bottom-zone");
  bottomZone.width = "584px";
  bottomZone.height = "286px";
  bottomZone.top = "138px";
  bottomZone.thickness = 2;
  bottomZone.color = "#5a5a5a";
  bottomZone.background = "#bcbcbc";
  panelRect.addControl(bottomZone);

  const armorSlotsTop = -74;
  const armorSlotsStep = 52;
  const armorSlotLeft = "-246px";
  const armorSlotSize = 46;

  for (let index = 0; index < 4; index++) {
    const armorSlot = createSlot(`vr-craft-armor-slot-${index}`, armorSlotSize);
    armorSlot.left = armorSlotLeft;
    armorSlot.top = `${armorSlotsTop + armorSlotsStep * index}px`;
    topZone.addControl(armorSlot);
  }

  const offhandSlot = createSlot("vr-craft-offhand-slot", armorSlotSize);
  offhandSlot.left = "-192px";
  offhandSlot.top = `${armorSlotsTop + armorSlotsStep}px`;
  topZone.addControl(offhandSlot);

  const craftGrid = createGrid("vr-crafting-grid", CRAFT_GRID_SIZE, CRAFT_GRID_SIZE, SLOT_SIZE);
  craftGrid.left = "-36px";
  craftGrid.top = "-22px";
  topZone.addControl(craftGrid);

  for (let index = 0; index < CRAFT_GRID_SIZE * CRAFT_GRID_SIZE; index++) {
    const slot = createSlot(`vr-craft-slot-${index}`, SLOT_SIZE);
    craftSlotControls.push(slot);
    craftGrid.addControl(slot, Math.floor(index / CRAFT_GRID_SIZE), index % CRAFT_GRID_SIZE);
  }

  const arrow = new TextBlock("vr-crafting-arrow", "➜");
  arrow.color = "#505050";
  arrow.fontSize = 34;
  arrow.left = "88px";
  arrow.top = "-22px";
  arrow.width = "42px";
  arrow.height = "42px";
  topZone.addControl(arrow);

  resultSlot.left = "160px";
  resultSlot.top = "-22px";
  resultSlot.addControl(resultIcon);
  resultSlot.addControl(resultCount);
  topZone.addControl(resultSlot);

  const inventoryGrid = createGrid("vr-crafting-inventory-grid", 3, HOTBAR_SLOT_COUNT, SLOT_SIZE);
  inventoryGrid.top = "-34px";
  bottomZone.addControl(inventoryGrid);

  for (let index = 0; index < EXTENDED_INVENTORY_SLOT_COUNT; index++) {
    const inventoryIndex = HOTBAR_SLOT_COUNT + index;
    const slot = createSlot(`vr-craft-inventory-slot-${index}`, SLOT_SIZE);
    inventorySlotControls.push(slot);
    inventorySlotIndices.push(inventoryIndex);
    inventoryGrid.addControl(slot, Math.floor(index / HOTBAR_SLOT_COUNT), index % HOTBAR_SLOT_COUNT);
  }

  const hotbarGrid = createGrid("vr-crafting-hotbar-grid", 1, HOTBAR_SLOT_COUNT, SLOT_SIZE);
  hotbarGrid.top = "90px";
  bottomZone.addControl(hotbarGrid);

  for (let index = 0; index < HOTBAR_SLOT_COUNT; index++) {
    const slot = createSlot(`vr-craft-hotbar-slot-${index}`, SLOT_SIZE);
    inventorySlotControls.push(slot);
    inventorySlotIndices.push(index);
    hotbarGrid.addControl(slot, 0, index);
  }

  backdrop.addControl(dragPreview);
  updateAll();

  const toggle = (): void => {
    if (ui.rootContainer.isVisible) {
      close();
      return;
    }

    open();
  };

  const open = (): void => {
    const activeCamera = scene.activeCamera;

    if (!activeCamera) {
      return;
    }

    ui.rootContainer.isVisible = true;
    panel.setEnabled(true);
    pickPlane.setEnabled(true);
    setCraftingOverlayOpen(true);

    const cameraForward = activeCamera.getDirection(Axis.Z).normalize();
    const flatForward = new Vector3(cameraForward.x, 0, cameraForward.z);

    if (flatForward.lengthSquared() < 0.0001) {
      flatForward.copyFromFloats(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    }

    flatForward.normalize();

    const origin = activeCamera.position.clone();
    const targetPosition = origin
      .add(flatForward.scale(VR_CRAFT_PANEL_DISTANCE))
      .add(new Vector3(0, VR_CRAFT_PANEL_VERTICAL_OFFSET, 0));
    const panelYaw = Math.atan2(flatForward.x, flatForward.z);

    panel.parent = null;
    pickPlane.parent = null;
    panel.position.copyFrom(targetPosition);
    panel.rotation.set(0, panelYaw, 0);

    const pickPosition = panel.position.add(flatForward.scale(0.004));
    pickPlane.position.copyFrom(pickPosition);
    pickPlane.rotation.copyFrom(panel.rotation);

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  const close = (): void => {
    if (!ui.rootContainer.isVisible) return;

    cancelDrag();
    returnAllCraftSlotsToInventory();
    ui.rootContainer.isVisible = false;
    setCraftingOverlayOpen(false);
    panel.setEnabled(false);
    pickPlane.setEnabled(false);
    updateAll();
  };

  const syncXRState = (isXRActive: boolean): void => {
    if (!isXRActive) {
      close();
      return;
    }

    const enabled = ui.rootContainer.isVisible;
    panel.setEnabled(enabled);
    pickPlane.setEnabled(enabled);
  };

  const isOpen = (): boolean => ui.rootContainer.isVisible;

  const isRayPointingAtCrafting = (ray: Ray | null): boolean => {
    if (!ray || !pickPlane.isEnabled()) {
      return false;
    }

    const hit = ray.intersectsMesh(pickPlane, false);
    return Boolean(hit.hit && hit.pickedPoint);
  };

  const tryHandlePrimaryAction = (ray: Ray | null): boolean => {
    if (!ui.rootContainer.isVisible || !ray) {
      return false;
    }

    const now = performance.now();

    if (now - lastSelectionTime < VR_TRIGGER_SELECTION_COOLDOWN_MS) {
      return false;
    }

    const pointer = getTexturePointerFromRay(ray, pickPlane);

    if (!pointer) {
      return false;
    }

    const { x, y } = pointer;

    if (!dragState) {
      const resultIndex = containsPointer(resultSlot, x, y) ? 0 : -1;
      const craftIndex = findControlIndexAt(craftSlotControls, x, y);
      const inventoryControlIndex = findControlIndexAt(inventorySlotControls, x, y);
      const inventoryIndex = inventoryControlIndex === -1 ? -1 : inventorySlotIndices[inventoryControlIndex];

      if (resultIndex !== -1) {
        startDragFromResultSlot();
      } else if (craftIndex !== -1) {
        startDragFromCraftSlot(craftIndex);
      } else if (inventoryIndex !== -1) {
        startDragFromInventorySlot(inventoryIndex);
      } else {
        return false;
      }

      moveDragPreview(x, y);
      lastSelectionTime = now;
      return true;
    }

    finishDrag(x, y);
    lastSelectionTime = now;
    return true;
  };

  return {
    panel,
    pickPlane,
    toggle,
    close,
    isOpen,
    isRayPointingAtCrafting,
    tryHandlePrimaryAction,
    syncXRState,
  };

  function startDragFromInventorySlot(index: number): void {
    if (dragState || !ui.rootContainer.isVisible) return;
    const item = player.inventory[index];
    if (!item) return;
    dragState = { item: { blockId: item.blockId, count: item.count }, source: { type: "inventory", index } };
    player.inventory.splice(index, 1);
    showDragPreview(dragState.item);
    updateAll();
  }

  function startDragFromCraftSlot(index: number): void {
    if (dragState || !ui.rootContainer.isVisible) return;
    const item = craftSlots[index];
    if (!item) return;
    dragState = { item: { blockId: item.blockId, count: item.count }, source: { type: "craft", index } };
    craftSlots[index] = null;
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
    for (const slot of craftSlots) {
      if (slot) slot.count--;
    }

    for (let index = 0; index < craftSlots.length; index++) {
      if (craftSlots[index] && craftSlots[index]!.count <= 0) {
        craftSlots[index] = null;
      }
    }
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
    for (let index = 0; index < craftSlots.length; index++) {
      returnCraftSlotToInventory(index);
    }
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
      const inventoryIndex = inventorySlotIndices[index];
      renderSlotContent(inventorySlotControls[index], player.inventory[inventoryIndex] ?? null);
    }
  }

  function updateResultSlot(): void {
    renderItemIcon(resultIcon, resultCount, currentResult);
    resultSlot.background = currentResult ? "#e8e8e8" : "#8f8f8f";
  }

  function showDragPreview(item: InventoryItem): void {
    dragPreview.isVisible = true;
    renderItemIcon(dragPreviewIcon, dragPreviewCount, item);
  }

  function hideDragPreview(): void {
    dragPreview.isVisible = false;
    renderItemIcon(dragPreviewIcon, dragPreviewCount, null);
  }

  function moveDragPreview(pointerX: number, pointerY: number): void {
    dragPreview.left = `${pointerX - VR_CRAFT_PANEL_TEXTURE_WIDTH / 2}px`;
    dragPreview.top = `${pointerY - VR_CRAFT_PANEL_TEXTURE_HEIGHT / 2}px`;
  }
}

function getTexturePointerFromRay(ray: Ray, pickPlane: Mesh): { x: number; y: number } | null {
  if (!pickPlane.isEnabled()) {
    return null;
  }

  const hit = ray.intersectsMesh(pickPlane, false);

  if (!hit.hit || !hit.pickedPoint) {
    return null;
  }

  const localPoint = Vector3.TransformCoordinates(
    hit.pickedPoint,
    Matrix.Invert(pickPlane.getWorldMatrix()),
  );

  const halfWidth = VR_CRAFT_PANEL_WIDTH / 2;
  const halfHeight = VR_CRAFT_PANEL_HEIGHT / 2;

  if (
    localPoint.x < -halfWidth ||
    localPoint.x > halfWidth ||
    localPoint.y < -halfHeight ||
    localPoint.y > halfHeight
  ) {
    return null;
  }

  const normalizedX = (localPoint.x + halfWidth) / VR_CRAFT_PANEL_WIDTH;
  const normalizedY = 1 - (localPoint.y + halfHeight) / VR_CRAFT_PANEL_HEIGHT;

  return {
    x: normalizedX * VR_CRAFT_PANEL_TEXTURE_WIDTH,
    y: normalizedY * VR_CRAFT_PANEL_TEXTURE_HEIGHT,
  };
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

  if (remaining > 0) {
    for (let count = 0; count < remaining; count++) {
      addToInventory(player, item.blockId);
    }
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
  const expandedSlots = expandCraftSlotsToThreeByThree(slots);

  for (const recipe of craftingRecipes) {
    if (matchesRecipe(expandedSlots, recipe)) {
      return { ...recipe.result };
    }
  }

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

  for (let row = 0; row < rows; row++) {
    grid.addRowDefinition(1 / rows);
  }

  for (let column = 0; column < columns; column++) {
    grid.addColumnDefinition(1 / columns);
  }

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
  const preview = createSlot("vr-craft-drag-preview", SLOT_SIZE);
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
  renderItemIconControl(icon, item?.blockId ?? null);

  if (!item) {
    countText.isVisible = false;
    return;
  }

  countText.isVisible = item.count > 1;
  countText.text = `${item.count}`;
}
