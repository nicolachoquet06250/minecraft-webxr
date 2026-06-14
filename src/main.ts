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
  getChunkFromWorldPosition,
  getChunkKey,
  getCurrentChunkCoordinate,
  initializeCrosshair,
  findDrySpawnPosition,
  hasCollisionAt,
  setBlock,
  worldToLocalCoordinate,
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
import { getAuthSession } from "./auth-client";
import { createWaterEffect } from "./water-effects";
// @ts-ignore
import { registerSW } from 'virtual:pwa-register';
import {
  createSteve,
} from "~/characters";
import {
  MultiplayerClient,
  resolveDefaultWsUrl,
  type PlayerPublicState,
  type PlayerTransformPayload,
} from "./multiplayer-client";

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
const SERVER_CHUNK_LOAD_TIMEOUT_MS = 5000;

const wasmGlobalState = globalThis as typeof globalThis & {
  __voxicraftVoxelWasmPromise?: Promise<VoxelWasmModule>;
};

async function loadVoxelWasm(): Promise<VoxelWasmModule> {
  wasmGlobalState.__voxicraftVoxelWasmPromise ??= init(voxelWasmUrl)
    .then(() => wasmModule as unknown as VoxelWasmModule)
    .catch((error) => {
      wasmGlobalState.__voxicraftVoxelWasmPromise = undefined;
      throw error;
    });

  return wasmGlobalState.__voxicraftVoxelWasmPromise;
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

type RemotePlayerVisual = {
  mesh: import("@babylonjs/core").Mesh;
  animator: {
    play: (animationName: string, loop?: boolean, speed?: number) => void;
    getCurrentAnimation: () => string | null;
    dispose: () => void;
  };
};

function getOrCreateMultiplayerIdentity(): { lobbyId: string; nickname: string } {
  const lobbyStorageKey = "voxicraft:multiplayer:lobby";
  const nicknameStorageKey = "voxicraft:multiplayer:nickname";

  const lobbyIdFromStorage = window.localStorage.getItem(lobbyStorageKey)?.trim();
  const nicknameFromStorage = window.localStorage.getItem(nicknameStorageKey)?.trim();
  const loggedInUsername = getAuthSession()?.user.username.trim();

  const lobbyId = lobbyIdFromStorage && lobbyIdFromStorage.length > 0
    ? lobbyIdFromStorage
    : "public";

  let nickname = loggedInUsername && loggedInUsername.length > 0
    ? loggedInUsername
    : nicknameFromStorage && nicknameFromStorage.length > 0
    ? nicknameFromStorage
    : "";

  if (!nickname) {
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    nickname = `joueur-${suffix}`;
  }

  window.localStorage.setItem(lobbyStorageKey, lobbyId);
  window.localStorage.setItem(nicknameStorageKey, nickname);

  return { lobbyId, nickname };
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

const canvas = document.querySelector("#voxicraft");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #voxicraft introuvable");
}

const voxicraftCanvas = canvas;
const engine = new Engine(voxicraftCanvas, true);
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

    let sizeX = chunk_size_x();
    let sizeY = chunk_size_y();
    let sizeZ = chunk_size_z();
    let worldSeed = SEED;

    const spawnChunkX = Math.floor(SPAWN_X / sizeX);
    const spawnChunkZ = Math.floor(SPAWN_Z / sizeZ);

    const worldChunks: WorldChunks = new Map();
    const droppedItems: DroppedItem[] = [];
    const remotePlayers = new Map<string, RemotePlayerVisual>();
    const requestedServerChunks = new Set<string>();
    const pendingServerChunkResolvers = new Map<string, Array<() => void>>();
    let localPlayerId: string | null = null;
    let localPlayer: PlayerPhysics | null = null;

    const upsertRemotePlayer = (playerState: PlayerPublicState): void => {
      if (playerState.player_id === localPlayerId) {
        return;
      }

      let remote = remotePlayers.get(playerState.player_id);

      if (!remote) {
        const spawnPosition = new Vector3(
          playerState.transform.position[0],
          playerState.transform.position[1],
          playerState.transform.position[2],
        );
        const { mesh, animator } = createSteve(scene, spawnPosition, {
          physics: {
            externalControl: true,
            gravityEnabled: false,
            collisionsEnabled: false,
          },
        });

        remote = { mesh, animator };
        remotePlayers.set(playerState.player_id, remote);
      }

      remote.mesh.position.copyFromFloats(
        playerState.transform.position[0],
        playerState.transform.position[1],
        playerState.transform.position[2],
      );
      remote.mesh.rotation.y = playerState.transform.rotation[0];

      const velocity = playerState.transform.velocity;
      const speed = Math.hypot(velocity[0], velocity[2]);
      const targetAnimation = speed > 0.15 ? "walk" : "idle";

      if (remote.animator.getCurrentAnimation() !== targetAnimation) {
        remote.animator.play(targetAnimation);
      }
    };

    const removeRemotePlayer = (playerId: string): void => {
      const remote = remotePlayers.get(playerId);

      if (!remote) {
        return;
      }

      remote.animator.dispose();
      remote.mesh.dispose();
      remotePlayers.delete(playerId);
    };

    const resolveServerChunkWaiters = (key: string): void => {
      const resolvers = pendingServerChunkResolvers.get(key);

      if (!resolvers) {
        return;
      }

      pendingServerChunkResolvers.delete(key);

      for (const resolve of resolvers) {
        resolve();
      }
    };

    const movePlayerToSafeLoadedSpawn = (player: PlayerPhysics): void => {
      if (player.position.y >= 0 && !hasCollisionAt(worldChunks, sizeX, sizeY, sizeZ, player.position)) {
        return;
      }

      try {
        const safeSpawn = findDrySpawnPosition(
          worldChunks,
          sizeX,
          sizeY,
          sizeZ,
          player.position.x,
          player.position.z,
          64,
        );

        player.position.copyFromFloats(safeSpawn.x, safeSpawn.y, safeSpawn.z);
        player.velocity.copyFromFloats(0, 0, 0);
        player.grounded = false;
      } catch {
        // Les chunks autour du joueur ne sont pas encore assez chargés pour corriger sa position.
      }
    };

    const applyServerChunkData = (
      chunkX: number,
      chunkZ: number,
      blocks: Uint8Array,
    ): void => {
      const key = getChunkKey(chunkX, chunkZ);
      const existing = worldChunks.get(key);

      if (existing) {
        existing.blocks = blocks;
        existing.mesh.dispose();
        existing.mesh = createChunkMesh({
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
        resolveServerChunkWaiters(key);

        if (localPlayer) {
          movePlayerToSafeLoadedSpawn(localPlayer);
        }

        return;
      }

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

      worldChunks.set(key, {
        chunkX,
        chunkZ,
        blocks,
        mesh,
      });

      resolveServerChunkWaiters(key);

      if (localPlayer) {
        movePlayerToSafeLoadedSpawn(localPlayer);
      }
    };

    const applyServerBlockUpdate = (
      worldX: number,
      worldY: number,
      worldZ: number,
      blockId: number,
    ): void => {
      const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, worldX, worldZ);

      if (!chunk) {
        return;
      }

      const localX = worldToLocalCoordinate(worldX, sizeX);
      const localZ = worldToLocalCoordinate(worldZ, sizeZ);

      setBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, worldY, localZ, blockId as any);
      chunk.mesh.dispose();
      chunk.mesh = createChunkMesh({
        scene,
        name: `chunk-${chunk.chunkX}-${chunk.chunkZ}`,
        blocks: chunk.blocks,
        sizeX,
        sizeY,
        sizeZ,
        chunkX: chunk.chunkX,
        chunkZ: chunk.chunkZ,
        material: lightMaterial,
      });
    };

    const multiplayerIdentity = getOrCreateMultiplayerIdentity();
    const multiplayerClient = new MultiplayerClient({
      wsUrl: resolveDefaultWsUrl(),
      lobbyId: multiplayerIdentity.lobbyId,
      nickname: multiplayerIdentity.nickname,
      handlers: {
        onWelcome: (welcome) => {
          localPlayerId = welcome.playerId;
          worldSeed = welcome.seed;
          sizeX = welcome.chunkSize[0];
          sizeY = welcome.chunkSize[1];
          sizeZ = welcome.chunkSize[2];
        },
        onLobbyState: (players) => {
          const alivePlayerIds = new Set<string>();

          for (const playerState of players) {
            alivePlayerIds.add(playerState.player_id);
            upsertRemotePlayer(playerState);
          }

          for (const playerId of [...remotePlayers.keys()]) {
            if (!alivePlayerIds.has(playerId)) {
              removeRemotePlayer(playerId);
            }
          }
        },
        onPlayerJoined: (playerState) => {
          upsertRemotePlayer(playerState);
        },
        onPlayerLeft: (playerId) => {
          removeRemotePlayer(playerId);
        },
        onPlayerTransform: (playerId, transform) => {
          upsertRemotePlayer({
            player_id: playerId,
            nickname: "",
            transform,
          });
        },
        onChunkData: (chunkX, chunkZ, blocks) => {
          applyServerChunkData(chunkX, chunkZ, blocks);
        },
        onBlockUpdated: (worldX, worldY, worldZ, blockId) => {
          applyServerBlockUpdate(worldX, worldY, worldZ, blockId);
        },
        onError: (code, message) => {
          console.warn("Erreur serveur multijoueur", code, message);
        },
      },
    });

    const requestServerChunkAndWait = (chunkX: number, chunkZ: number): Promise<void> => {
      const key = getChunkKey(chunkX, chunkZ);

      if (worldChunks.has(key)) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        let resolveChunk: () => void;
        const timeoutId = window.setTimeout(() => {
          const resolvers = pendingServerChunkResolvers.get(key);
          pendingServerChunkResolvers.set(
            key,
            resolvers?.filter((candidate) => candidate !== resolveChunk) ?? [],
          );
          requestedServerChunks.delete(key);
          console.warn(`Chunk serveur ${key} non reçu après ${SERVER_CHUNK_LOAD_TIMEOUT_MS}ms`);
          resolve();
        }, SERVER_CHUNK_LOAD_TIMEOUT_MS);

        resolveChunk = (): void => {
          window.clearTimeout(timeoutId);
          resolve();
        };

        const resolvers = pendingServerChunkResolvers.get(key) ?? [];
        resolvers.push(resolveChunk);
        pendingServerChunkResolvers.set(key, resolvers);

        if (!requestedServerChunks.has(key)) {
          requestedServerChunks.add(key);
          multiplayerClient.requestChunk(chunkX, chunkZ);
        }
      });
    };

    const requestInitialServerChunksAround = async (centerChunkX: number, centerChunkZ: number): Promise<void> => {
      const requests: Promise<void>[] = [];

      for (let offsetZ = -INITIAL_CHUNK_RADIUS; offsetZ <= INITIAL_CHUNK_RADIUS; offsetZ++) {
        for (let offsetX = -INITIAL_CHUNK_RADIUS; offsetX <= INITIAL_CHUNK_RADIUS; offsetX++) {
          requests.push(requestServerChunkAndWait(centerChunkX + offsetX, centerChunkZ + offsetZ));
        }
      }

      await Promise.all(requests);
    };

    const generateLocalChunksAround = (centerChunkX: number, centerChunkZ: number): void => {
      for (let offsetZ = -INITIAL_CHUNK_RADIUS; offsetZ <= INITIAL_CHUNK_RADIUS; offsetZ++) {
        for (let offsetX = -INITIAL_CHUNK_RADIUS; offsetX <= INITIAL_CHUNK_RADIUS; offsetX++) {
          const chunkX = centerChunkX + offsetX;
          const chunkZ = centerChunkZ + offsetZ;

          const blocks = generate_chunk(chunkX, chunkZ, worldSeed);

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
    };

    if (options.gameMode === "multiplayer") {
      try {
        await multiplayerClient.connect();
        console.info("Multijoueur connecté");
      } catch (error) {
        console.warn("Connexion multijoueur indisponible, fallback solo local", error);
      }
    }

    if (multiplayerClient.isConnected()) {
      await requestInitialServerChunksAround(spawnChunkX, spawnChunkZ);
    }

    if (!worldChunks.has(getChunkKey(spawnChunkX, spawnChunkZ))) {
      generateLocalChunksAround(spawnChunkX, spawnChunkZ);
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
    localPlayer = player;

    const requestServerChunksAroundPlayer = (): void => {
      if (!multiplayerClient.isConnected()) {
        return;
      }

      const centerChunkX = getCurrentChunkCoordinate(player.position.x, sizeX);
      const centerChunkZ = getCurrentChunkCoordinate(player.position.z, sizeZ);

      for (let dz = -INITIAL_CHUNK_RADIUS; dz <= INITIAL_CHUNK_RADIUS; dz++) {
        for (let dx = -INITIAL_CHUNK_RADIUS; dx <= INITIAL_CHUNK_RADIUS; dx++) {
          const chunkX = centerChunkX + dx;
          const chunkZ = centerChunkZ + dz;
          const key = getChunkKey(chunkX, chunkZ);

          if (requestedServerChunks.has(key)) {
            continue;
          }

          requestedServerChunks.add(key);
          multiplayerClient.requestChunk(chunkX, chunkZ);
        }
      }
    };

    requestServerChunksAroundPlayer();

    (player as PlayerPhysics & {
      _onLocalBlockMutated?: (worldX: number, worldY: number, worldZ: number, blockId: number) => void;
    })._onLocalBlockMutated = (worldX, worldY, worldZ, blockId) => {
      multiplayerClient.setBlock(worldX, worldY, worldZ, blockId);
    };

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
        voxicraftCanvas,
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
    let transformSyncElapsed = 0;

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
                    onBlockMutated: (worldX, worldY, worldZ, blockId) => {
                      multiplayerClient.setBlock(worldX, worldY, worldZ, blockId);
                    },
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
                  onBlockMutated: (worldX, worldY, worldZ, blockId) => {
                    multiplayerClient.setBlock(worldX, worldY, worldZ, blockId);
                  },
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

        if (!multiplayerClient.isConnected()) {
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
        }

        requestServerChunksAroundPlayer();

        if (multiplayerClient.isConnected() && player.position.y < -4) {
          movePlayerToSafeLoadedSpawn(player);
        }

        if (multiplayerClient.isConnected()) {
          transformSyncElapsed += deltaTime;

          if (transformSyncElapsed >= 0.05) {
            transformSyncElapsed = 0;

            const transformPayload: PlayerTransformPayload = {
              position: [player.position.x, player.position.y, player.position.z],
              rotation: [player.yaw, player.pitch],
              velocity: [player.velocity.x, player.velocity.y, player.velocity.z],
            };

            multiplayerClient.sendTransform(transformPayload);
          }
        }

        updateBlockBreaking(deltaTime);
        updateDroppedItems(droppedItems, player, worldChunks, sizeX, sizeY, sizeZ, deltaTime);

        scene.render();
    });
}

await showMainMenu({
    engine,
    canvas: voxicraftCanvas,
    onPlay: (options) => {
        void startGame(options);
    },
});
