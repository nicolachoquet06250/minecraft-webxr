import type { Scene } from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Grid,
  Rectangle,
  TextBlock,
} from "@babylonjs/gui";
import { addToInventory, getBlockColor } from "./functions";
import { BlockId, type InventoryItem, type PlayerPhysics } from "./types";

type CraftingSlot = InventoryItem | null;

type CraftingRecipe = {
  pattern: (BlockId | null)[];
  result: InventoryItem;
};

const SLOT_SIZE = 48;
const CRAFT_GRID_SIZE = 3;
const INVENTORY_SLOT_COUNT = 9;

const recipes: CraftingRecipe[] = [
  {
    pattern: [BlockId.OakLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.OakPlanks, count: 4 },
  },
  {
    pattern: [BlockId.SpruceLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.SprucePlanks, count: 4 },
  },
  {
    pattern: [BlockId.BirchLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.BirchPlanks, count: 4 },
  },
  {
    pattern: [BlockId.JungleLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.JunglePlanks, count: 4 },
  },
  {
    pattern: [BlockId.AcaciaLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.AcaciaPlanks, count: 4 },
  },
  {
    pattern: [BlockId.DarkOakLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.DarkOakPlanks, count: 4 },
  },
  {
    pattern: [BlockId.MangroveLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.MangrovePlanks, count: 4 },
  },
  {
    pattern: [BlockId.CherryLog, null, null, null, null, null, null, null, null],
    result: { blockId: BlockId.CherryPlanks, count: 4 },
  },
  {
    pattern: [BlockId.OakPlanks, BlockId.OakPlanks, null, BlockId.OakPlanks, BlockId.OakPlanks, null, null, null, null],
    result: { blockId: BlockId.CraftingTable, count: 1 },
  },
];

export function initializeCraftingOverlay(scene: Scene, player: PlayerPhysics): AdvancedDynamicTexture {
  const ui = AdvancedDynamicTexture.CreateFullscreenUI("crafting-overlay-ui", true, scene);
  ui.rootContainer.isVisible = false;
  ui.rootContainer.zIndex = 10_000;

  const craftSlots: CraftingSlot[] = Array.from({ length: CRAFT_GRID_SIZE * CRAFT_GRID_SIZE }, () => null);
  const craftSlotControls: Rectangle[] = [];
  const inventorySlotControls: Rectangle[] = [];
  const resultSlot = createSlot("craft-result-slot", 58);
  const resultIcon = createItemIcon("craft-result-icon", 34);
  const resultCount = createCountText("craft-result-count");
  let currentResult: InventoryItem | null = null;

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
    slot.onPointerClickObservable.add(() => {
      returnCraftSlotToInventory(index);
      updateAll();
    });
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
    slot.onPointerClickObservable.add(() => {
      moveOneInventoryItemToCraftingGrid(index);
      updateAll();
    });
    inventorySlotControls.push(slot);
    inventoryGrid.addControl(slot, 0, index);
  }

  function toggle(): void {
    const nextVisible = !ui.rootContainer.isVisible;
    ui.rootContainer.isVisible = nextVisible;

    if (nextVisible && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  function close(): void {
    if (!ui.rootContainer.isVisible) {
      return;
    }

    returnAllCraftSlotsToInventory();
    ui.rootContainer.isVisible = false;
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

  function moveOneInventoryItemToCraftingGrid(inventoryIndex: number): void {
    const item = player.inventory[inventoryIndex];

    if (!item || item.count <= 0) {
      return;
    }

    const targetIndex = craftSlots.findIndex((slot) => !slot || slot.blockId === item.blockId);

    if (targetIndex === -1) {
      return;
    }

    const targetSlot = craftSlots[targetIndex];

    if (targetSlot) {
      targetSlot.count++;
    } else {
      craftSlots[targetIndex] = { blockId: item.blockId, count: 1 };
    }

    item.count--;

    if (item.count <= 0) {
      player.inventory.splice(inventoryIndex, 1);
    }
  }

  function returnCraftSlotToInventory(index: number): void {
    const item = craftSlots[index];

    if (!item) {
      return;
    }

    for (let count = 0; count < item.count; count++) {
      addToInventory(player, item.blockId);
    }

    craftSlots[index] = null;
  }

  function returnAllCraftSlotsToInventory(): void {
    for (let index = 0; index < craftSlots.length; index++) {
      returnCraftSlotToInventory(index);
    }
  }

  function craftCurrentRecipe(): void {
    if (!currentResult) {
      return;
    }

    for (const slot of craftSlots) {
      if (slot) {
        slot.count--;
      }
    }

    for (let index = 0; index < craftSlots.length; index++) {
      if (craftSlots[index] && craftSlots[index]!.count <= 0) {
        craftSlots[index] = null;
      }
    }

    for (let count = 0; count < currentResult.count; count++) {
      addToInventory(player, currentResult.blockId);
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
      renderSlotContent(inventorySlotControls[index], player.inventory[index] ?? null);
    }
  }

  function updateResultSlot(): void {
    renderItemIcon(resultIcon, resultCount, currentResult);
    resultSlot.background = currentResult ? "#e8e8e8" : "#8f8f8f";
  }
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

    if (expected === null && actual !== null) {
      return false;
    }

    if (expected !== null && (!actual || actual.blockId !== expected || actual.count <= 0)) {
      return false;
    }
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
