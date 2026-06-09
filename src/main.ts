import "./style.css";
import init, * as wasmModule from "~/assets/wasm/voxel_wasm";
import voxelWasmUrl from "~/assets/wasm/voxel_wasm_bg.wasm?url";

import type { PlayerPhysics, VoxelWasmModule, WorldChunks, DroppedItem } from "./types";

import {
  INITIAL_CHUNK_RADIUS,
  JUMP_VELOCITY,
  SEED,
  SPAWN_X,
  SPAWN_Z,
  pressedKeys,
} from "./constants";

import { Color4, Engine, Scene, Vector3 } from "@babylonjs/core";

import {
  updatePlayerPhysics,
  initializeCamera,
  inisializeLight,
  generatePlayer,
  getChunkKey,
  initializeCrosshair,
  findDrySpawnPosition,
  hasCollisionAt,
} from "./functions";
import {
  createChunkMesh,
  ensureChunksAroundPlayer,
  placeBlock,
  updateDroppedItems,
} from "./textured-world";

import initializeEvents from "./events";
import { cancelBlockBreaking, startBlockBreaking, updateBlockBreaking } from "./block-breaking";
import { applyProceduralBlockAtlasMaterial } from "./block-atlas";
import { initializeCraftingOverlay } from "./crafting-ui";
import { initializeInventoryBar, initializeVRInventoryBar } from "./inventory-ui";
import initializeMobileControls from "./mobile-controls";
import { initializePointedBlockLabel } from "./pointed-block-label";
import { initializePoppyModels } from "./poppy-models";
import { initializeWebXRGameControls } from "./vr-mode";
import { initializeVRCraftingOverlay } from "./vr-crafting-ui";
import { isCraftingOverlayOpen } from "./ui-state";
import { showMainMenu, type MainMenuLaunchOptions } from "./main-menu";
import { createWaterEffect } from "./water-effects";
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';

const registrations = await navigator.serviceWorker.getRegistrations();
if (registrations.length > 1) {
    (async (registrations) => {
        for (const registration of registrations) {
            await registration.unregister();
        }

        const keys = await caches.keys();
        for (const key of keys) {
            await caches.delete(key);
        }

        location.reload();
    })(registrations)
}

registerSW({
    immediate: true,

    onNeedRefresh() {
        window.location.reload();
    },

    onOfflineReady() {
        console.log('App ready to work offline');
    },
});

const AUTO_JUMP_PROBE_DISTANCE = 0.12;
const AUTO_JUMP_STEP_HEIGHT = 1.05;
const AUTO_JUMP_MIN_HORIZONTAL_PROGRESS = 0.01;

const wasmGlobalState = globalThis as typeof globalThis & {
  __minecraftVoxelWasmPromise?: Promise<VoxelWasmModule>;
};

async function loadVoxelWasm(): Promise<VoxelWasmModule> {
  wasmGlobalState.__minecraftVoxelWasmPromise ??= init(voxelWasmUrl)
    .then(() => wasmModule as unknown as VoxelWasmModule)
    .catch((error) => {
      wasmGlobalState.__minecraftVoxelWasmPromise = undefined;
      throw error;
    });

  return wasmGlobalState.__minecraftVoxelWasmPromise;
}

function debugBlockDistribution(blocks: Uint8Array): void {
  const counts = new Map<number, number>();

  for (const block of blocks) {
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }

  console.table(
    [...counts.entries()]
      .sort(([a], [b]) => a - b)
      .map(([blockId, count]) => ({ blockId, count })),
  );
}

function getInputMoveDirection(player: PlayerPhysics): Vector3 {
  const forward = new Vector3(
    Math.sin(player.yaw),
    0,
    Math.cos(player.yaw),
  );

  const right = new Vector3(
    Math.cos(player.yaw),
    0,
    -Math.sin(player.yaw),
  );

  const moveDirection = Vector3.Zero();

  if (
    pressedKeys.has("KeyW") ||
    pressedKeys.has("KeyZ") ||
    pressedKeys.has("ArrowUp")
  ) {
    moveDirection.addInPlace(forward);
  }

  if (
    pressedKeys.has("KeyS") ||
    pressedKeys.has("ArrowDown")
  ) {
    moveDirection.subtractInPlace(forward);
  }

  if (
    pressedKeys.has("KeyD") ||
    pressedKeys.has("ArrowRight")
  ) {
    moveDirection.addInPlace(right);
  }

  if (
    pressedKeys.has("KeyA") ||
    pressedKeys.has("KeyQ") ||
    pressedKeys.has("ArrowLeft")
  ) {
    moveDirection.subtractInPlace(right);
  }

  if (moveDirection.lengthSquared() > 0) {
    moveDirection.normalize();
  }

  return moveDirection;
}

type AutoJumpParams = {
  player: PlayerPhysics;
  moveDirection: Vector3;
  previousPosition: Vector3;
  wasGrounded: boolean;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
};

function tryAutoJump(params: AutoJumpParams): void {
  const {
    player,
    moveDirection,
    previousPosition,
    wasGrounded,
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
  } = params;

  if (!wasGrounded || !player.grounded || moveDirection.lengthSquared() === 0) {
    return;
  }

  const actualHorizontalMove = player.position.subtract(previousPosition);
  actualHorizontalMove.y = 0;

  const progressInInputDirection = Vector3.Dot(actualHorizontalMove, moveDirection);

  if (progressInInputDirection > AUTO_JUMP_MIN_HORIZONTAL_PROGRESS) {
    return;
  }

  const blockedProbePosition = player.position.add(
    moveDirection.scale(AUTO_JUMP_PROBE_DISTANCE),
  );

  if (!hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, blockedProbePosition)) {
    return;
  }

  const steppedProbePosition = blockedProbePosition.add(
    new Vector3(0, AUTO_JUMP_STEP_HEIGHT, 0),
  );

  if (hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, steppedProbePosition)) {
    return;
  }

  player.velocity.y = JUMP_VELOCITY;
  player.grounded = false;
}

const canvas = document.querySelector("#minecraft");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #minecraft introuvable");
}

const minecraftCanvas = canvas;
const engine = new Engine(minecraftCanvas, true);
let gameStarted = false;

async function startGame(options: MainMenuLaunchOptions = {}): Promise<void> {
    if (gameStarted) {
        return;
    }

    gameStarted = true;
    const scene = new Scene(engine);

    scene.clearColor = new Color4(0.55, 0.75, 1.0, 1.0);

    const lightMaterial = inisializeLight(scene);
    applyProceduralBlockAtlasMaterial(scene, lightMaterial);

    const wasm = await loadVoxelWasm();
    const {
        generate_chunk, chunk_size_x,
        chunk_size_y, chunk_size_z
    } = wasm;

    const sizeX = chunk_size_x();
    const sizeY = chunk_size_y();
    const sizeZ = chunk_size_z();

    const spawnChunkX = Math.floor(SPAWN_X / sizeX);
    const spawnChunkZ = Math.floor(SPAWN_Z / sizeZ);

    const worldChunks: WorldChunks = new Map();
    const droppedItems: DroppedItem[] = [];

    for (let offsetZ = -INITIAL_CHUNK_RADIUS; offsetZ <= INITIAL_CHUNK_RADIUS; offsetZ++) {
        for (let offsetX = -INITIAL_CHUNK_RADIUS; offsetX <= INITIAL_CHUNK_RADIUS; offsetX++) {
            const chunkX = spawnChunkX + offsetX;
            const chunkZ = spawnChunkZ + offsetZ;

            const blocks = generate_chunk(chunkX, chunkZ, SEED);

            debugBlockDistribution(blocks);

            const mesh = createChunkMesh({
                scene,
                name: `chunk-${chunkX}-${chunkZ}`,
                blocks,
                sizeX,
                sizeY,
                sizeZ,
                chunkX,
                chunkZ,
                material: lightMaterial,
            });

            worldChunks.set(getChunkKey(chunkX, chunkZ), {
                chunkX,
                chunkZ,
                blocks,
                mesh,
            });
        }
    }

    initializePoppyModels({ scene, worldChunks, sizeX, sizeY, sizeZ });

    const spawnChunk = worldChunks.get(getChunkKey(spawnChunkX, spawnChunkZ));

    if (!spawnChunk) {
        throw new Error("Chunk de spawn introuvable");
    }

    const spawn = findDrySpawnPosition(
        worldChunks,
        sizeX,
        sizeY,
        sizeZ,
        SPAWN_X,
        SPAWN_Z,
        64,
    );

    const player = generatePlayer(spawn);

    // Expose properties for mobile controls
    (player as any)._worldChunks = worldChunks;
    (player as any)._sizeX = sizeX;
    (player as any)._sizeY = sizeY;
    (player as any)._sizeZ = sizeZ;
    (player as any)._material = lightMaterial;
    (player as any)._droppedItems = droppedItems;

    const camera = initializeCamera(scene, player);
    const waterEffect = createWaterEffect(scene);

    const crosshairUi = initializeCrosshair(scene);
    initializeInventoryBar(scene, player);
    const pointedBlockLabel = initializePointedBlockLabel(scene);
    initializeEvents(
        engine,
        player,
        minecraftCanvas,
        scene,
        worldChunks,
        sizeX,
        sizeY,
        sizeZ,
        lightMaterial,
        droppedItems,
    );
    initializeMobileControls(scene, player);
    initializeCraftingOverlay(scene, player);

    const webXRControls = await initializeWebXRGameControls(scene, player);
    const vrInventoryBar = initializeVRInventoryBar(scene, player, webXRControls);
    const vrCraftingOverlay = initializeVRCraftingOverlay(scene, player);
    let leftTriggerWasPressed = false;
    let rightTriggerWasPressed = false;
    let rightBButtonWasPressed = false;

    if (options.enterVR) {
        void webXRControls.enterVR();
    }

    engine.runRenderLoop(() => {
        const deltaTime = Math.min(engine.getDeltaTime() / 1000, 0.05);
        const isWebXRActive = webXRControls.isActive();
        vrCraftingOverlay.syncXRState(isWebXRActive);

        const rightBButtonPressed = isWebXRActive && webXRControls.isBButtonPressed("right");

        if (rightBButtonPressed && !rightBButtonWasPressed) {
          vrCraftingOverlay.toggle();
        }

        rightBButtonWasPressed = rightBButtonPressed;

        const rawLeftControllerRay = isWebXRActive ? webXRControls.getControllerRay("left") : null;
        const rawRightControllerRay = isWebXRActive ? webXRControls.getControllerRay("right") : null;
        const leftRayTargetsInventory = isWebXRActive && vrInventoryBar.isRayPointingAtInventory(rawLeftControllerRay);
        const rightRayTargetsInventory = isWebXRActive && vrInventoryBar.isRayPointingAtInventory(rawRightControllerRay);
        const leftRayTargetsCrafting = isWebXRActive && vrCraftingOverlay.isRayPointingAtCrafting(rawLeftControllerRay);
        const rightRayTargetsCrafting = isWebXRActive && vrCraftingOverlay.isRayPointingAtCrafting(rawRightControllerRay);
        const leftControllerRay = leftRayTargetsInventory || leftRayTargetsCrafting ? null : rawLeftControllerRay;
        const rightControllerRay = rightRayTargetsInventory || rightRayTargetsCrafting ? null : rawRightControllerRay;

        crosshairUi.rootContainer.isVisible = !isWebXRActive;
        pointedBlockLabel.update({
            scene,
            player,
            worldChunks,
            sizeX,
            sizeY,
            sizeZ,
            isVisible: true,
            isVR: isWebXRActive,
            controllerRays: isWebXRActive
                ? [
                    leftControllerRay,
                    rightControllerRay,
                ]
                : undefined,
        });
        webXRControls.syncBeforePhysics(deltaTime);

        if (isWebXRActive) {
            const leftTriggerPressed = webXRControls.isTriggerPressed("left");
          const rightTriggerPressed = webXRControls.isTriggerPressed("right");
          const craftingOpen = isCraftingOverlayOpen();

          if (craftingOpen && rightTriggerPressed && !rightTriggerWasPressed && rawRightControllerRay) {
            vrCraftingOverlay.tryHandlePrimaryAction(rawRightControllerRay);
          }

          rightTriggerWasPressed = rightTriggerPressed;

          if (!craftingOpen && leftTriggerPressed && !leftTriggerWasPressed && leftControllerRay) {
                placeBlock({
                    scene,
                    player,
                    worldChunks,
                    sizeX,
                    sizeY,
                    sizeZ,
                    material: lightMaterial,
                    droppedItems,
                    targetRay: leftControllerRay,
                });
            }

            leftTriggerWasPressed = leftTriggerPressed;

      if (!craftingOpen && rightTriggerPressed && rightControllerRay) {
                startBlockBreaking({
                    scene,
                    player,
                    worldChunks,
                    sizeX,
                    sizeY,
                    sizeZ,
                    material: lightMaterial,
                    droppedItems,
                    targetRay: rightControllerRay,
                });
            } else {
                cancelBlockBreaking();
            }
        } else {
            leftTriggerWasPressed = false;
            rightTriggerWasPressed = false;
            rightBButtonWasPressed = false;
        }

        const vrCraftingOpen = isWebXRActive && isCraftingOverlayOpen();
        const moveDirectionBeforePhysics = vrCraftingOpen ? Vector3.Zero() : getInputMoveDirection(player);
        const previousPlayerPosition = player.position.clone();
        const wasGroundedBeforePhysics = player.grounded;

        if (vrCraftingOpen) {
            player.velocity.copyFromFloats(0, 0, 0);
            cancelBlockBreaking();
        } else {
            updatePlayerPhysics({
                player,
                camera,
                worldChunks,
                sizeX,
                sizeY,
                sizeZ,
                deltaTime,
            });

            tryAutoJump({
                player,
                moveDirection: moveDirectionBeforePhysics,
                previousPosition: previousPlayerPosition,
                wasGrounded: wasGroundedBeforePhysics,
                worldChunks,
                sizeX,
                sizeY,
                sizeZ,
            });
        }

        waterEffect.update(deltaTime);
        waterEffect.tryTriggerSplash({
            player,
            previousPosition: previousPlayerPosition,
            worldChunks,
            sizeX,
            sizeY,
            sizeZ,
        });

        webXRControls.syncAfterPhysics();

        ensureChunksAroundPlayer({
            scene,
            worldChunks,
            wasm,
            material: lightMaterial,
            player,
            sizeX,
            sizeY,
            sizeZ,
        });

        updateBlockBreaking(deltaTime);
        updateDroppedItems(droppedItems, player, worldChunks, sizeX, sizeY, sizeZ, deltaTime);

        scene.render();
    });
}

await showMainMenu({
    engine,
    canvas: minecraftCanvas,
    onPlay: (options) => {
        void startGame(options);
    },
});