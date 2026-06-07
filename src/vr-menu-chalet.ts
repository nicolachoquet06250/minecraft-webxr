import { Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock } from "@babylonjs/gui";
import { createChunkMesh, findDrySpawnPosition, getChunkKey, getChunkFromWorldPosition, setBlock } from "./functions";
import { BlockId, type PlayerPhysics, type WorldChunks } from "./types";

const CHALET_CENTER_X = 8;
const CHALET_CENTER_Z = 8;
const CHALET_MIN_X = 1;
const CHALET_MAX_X = 14;
const CHALET_MIN_Z = 2;
const CHALET_MAX_Z = 15;
const CHALET_SCREEN_Z = CHALET_MIN_Z + 0.04;
const CHALET_SCREEN_Y_OFFSET = 3.1;
const CHALET_SPAWN_X = 8.5;
const CHALET_SPAWN_Z = 11.5;
const CHALET_YAW_TO_SCREEN = Math.PI;

export type VRMenuChalet = {
  readonly spawn: Vector3;
  readonly yaw: number;
  readonly menuPanel: Mesh;
};

type CreateVRMenuChaletParams = {
  scene: Scene;
  worldChunks: WorldChunks;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  material: StandardMaterial;
};

export function createVRMenuChalet(params: CreateVRMenuChaletParams): VRMenuChalet {
  const { scene, worldChunks, sizeX, sizeY, sizeZ, material } = params;
  const terrainSpawn = findDrySpawnPosition(
    worldChunks,
    sizeX,
    sizeY,
    sizeZ,
    CHALET_CENTER_X,
    CHALET_CENTER_Z,
    64,
  );
  const floorY = Math.max(1, Math.floor(terrainSpawn.y));

  carveInterior(worldChunks, sizeX, sizeY, sizeZ, floorY);
  buildChaletShell(worldChunks, sizeX, sizeY, sizeZ, floorY);
  buildLivingRoomDetails(worldChunks, sizeX, sizeY, sizeZ, floorY);
  rebuildTouchedChunkMeshes(scene, worldChunks, sizeX, sizeY, sizeZ, material);

  const menuPanel = createMenuPanel(scene, floorY);

  return {
    spawn: new Vector3(CHALET_SPAWN_X, floorY + 1.02, CHALET_SPAWN_Z),
    yaw: CHALET_YAW_TO_SCREEN,
    menuPanel,
  };
}

export function movePlayerToVRMenuChalet(player: PlayerPhysics, chalet: VRMenuChalet): void {
  player.position.copyFrom(chalet.spawn);
  player.velocity.set(0, 0, 0);
  player.yaw = chalet.yaw;
  player.pitch = 0;
  player.grounded = true;
}

function carveInterior(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  floorY: number,
): void {
  for (let x = CHALET_MIN_X - 2; x <= CHALET_MAX_X + 2; x++) {
    for (let z = CHALET_MIN_Z - 2; z <= CHALET_MAX_Z + 2; z++) {
      for (let y = floorY; y <= floorY + 9; y++) {
        setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z, BlockId.Air);
      }
    }
  }
}

function buildChaletShell(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  floorY: number,
): void {
  fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY, CHALET_MIN_Z, CHALET_MAX_X, floorY, CHALET_MAX_Z, BlockId.BirchPlanks);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 5, CHALET_MIN_Z, CHALET_MAX_X, floorY + 5, CHALET_MAX_Z, BlockId.SprucePlanks);

  for (let y = floorY + 1; y <= floorY + 4; y++) {
    for (let x = CHALET_MIN_X; x <= CHALET_MAX_X; x++) {
      setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, CHALET_MIN_Z, BlockId.OakPlanks);
      setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, CHALET_MAX_Z, BlockId.OakPlanks);
    }

    for (let z = CHALET_MIN_Z; z <= CHALET_MAX_Z; z++) {
      setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, y, z, BlockId.OakPlanks);
      setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, y, z, BlockId.OakPlanks);
    }
  }

  for (const [x, z] of [[CHALET_MIN_X, CHALET_MIN_Z], [CHALET_MAX_X, CHALET_MIN_Z], [CHALET_MIN_X, CHALET_MAX_Z], [CHALET_MAX_X, CHALET_MAX_Z]] as const) {
    fillBox(worldChunks, sizeX, sizeY, sizeZ, x, floorY + 1, z, x, floorY + 5, z, BlockId.SpruceLog);
  }

  // Fenêtres latérales et arrière pour rappeler l'intérieur du chalet de référence.
  fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 2, 6, CHALET_MIN_X, floorY + 3, 9, BlockId.Glass);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 2, 6, CHALET_MAX_X, floorY + 3, 9, BlockId.Glass);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 6, floorY + 2, CHALET_MAX_Z, 9, floorY + 3, CHALET_MAX_Z, BlockId.Glass);

  // Toit simple en pente au-dessus du plafond.
  for (let z = CHALET_MIN_Z - 1; z <= CHALET_MAX_Z + 1; z++) {
    for (let inset = 0; inset <= 3; inset++) {
      const y = floorY + 6 + inset;
      setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X - 1 + inset, y, z, BlockId.SprucePlanks);
      setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X + 1 - inset, y, z, BlockId.SprucePlanks);
    }
  }
}

function buildLivingRoomDetails(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  floorY: number,
): void {
  // Mur-écran en face du canapé : l'UI VR sera accrochée sur ce rectangle noir.
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 5, floorY + 2, CHALET_MIN_Z, 10, floorY + 4, CHALET_MIN_Z, BlockId.BlackWool);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 4, floorY + 1, CHALET_MIN_Z, 11, floorY + 1, CHALET_MIN_Z, BlockId.SprucePlanks);

  // Canapé blanc face à l'écran.
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 6, floorY + 1, 9, 10, floorY + 1, 9, BlockId.WhiteWool);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 6, floorY + 2, 10, 10, floorY + 2, 10, BlockId.WhiteWool);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 5, floorY + 1, 9, 5, floorY + 2, 10, BlockId.WhiteWool);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 11, floorY + 1, 9, 11, floorY + 2, 10, BlockId.WhiteWool);

  // Table basse et quelques éléments décoratifs pour rendre la scène identifiable en VR.
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 7, floorY + 1, 6, 9, floorY + 1, 7, BlockId.DarkOakPlanks);
  setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 3, floorY + 1, 4, BlockId.Torch);
  setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, 4, BlockId.Torch);
  fillBox(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, 11, 12, floorY + 3, 13, BlockId.Bookshelf);
  setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 3, floorY + 1, 12, BlockId.Chest);
}

function createMenuPanel(scene: Scene, floorY: number): Mesh {
  const panel = MeshBuilder.CreatePlane(
    "vr-menu-screen-panel",
    { width: 4.8, height: 2.45 },
    scene,
  );
  panel.position.set(8, floorY + CHALET_SCREEN_Y_OFFSET, CHALET_SCREEN_Z);
  panel.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0);
  panel.isPickable = true;

  const ui = AdvancedDynamicTexture.CreateForMesh(panel, 1600, 820, false);
  const root = new Rectangle("vr-menu-root");
  root.thickness = 8;
  root.color = "#5b3f24";
  root.cornerRadius = 28;
  root.background = "rgba(18, 14, 10, 0.86)";
  root.paddingLeft = "64px";
  root.paddingRight = "64px";
  root.paddingTop = "56px";
  root.paddingBottom = "56px";
  ui.addControl(root);

  const stack = new StackPanel("vr-menu-stack");
  stack.spacing = 22;
  root.addControl(stack);

  const title = new TextBlock("vr-menu-title", "Minecraft");
  title.height = "116px";
  title.color = "white";
  title.fontFamily = "Georgia, serif";
  title.fontSize = 76;
  title.fontWeight = "700";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  stack.addControl(title);

  const subtitle = new TextBlock("vr-menu-subtitle", "XR Edition");
  subtitle.height = "42px";
  subtitle.color = "#d9e8ff";
  subtitle.fontSize = 34;
  stack.addControl(subtitle);

  for (const label of ["Un joueur", "Options...", "Quitter le jeu"]) {
    const button = new Rectangle(`vr-menu-button-${label}`);
    button.height = "86px";
    button.width = "720px";
    button.thickness = 4;
    button.color = "white";
    button.background = "rgba(112, 112, 112, 0.92)";
    button.cornerRadius = 4;
    button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

    const text = new TextBlock(`vr-menu-button-label-${label}`, label);
    text.color = "white";
    text.fontSize = 34;
    text.fontWeight = "600";
    button.addControl(text);
    stack.addControl(button);
  }

  return panel;
}

function fillBox(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  block: BlockId,
): void {
  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z, block);
      }
    }
  }
}

function setWorldBlock(
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  worldX: number,
  worldY: number,
  worldZ: number,
  block: BlockId,
): void {
  const chunk = getChunkFromWorldPosition(worldChunks, sizeX, sizeZ, worldX, worldZ);

  if (!chunk) return;

  const localX = ((Math.floor(worldX) % sizeX) + sizeX) % sizeX;
  const localZ = ((Math.floor(worldZ) % sizeZ) + sizeZ) % sizeZ;

  setBlock(chunk.blocks, sizeX, sizeY, sizeZ, localX, Math.floor(worldY), localZ, block);
}

function rebuildTouchedChunkMeshes(
  scene: Scene,
  worldChunks: WorldChunks,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: StandardMaterial,
): void {
  for (let chunkX = Math.floor((CHALET_MIN_X - 2) / sizeX); chunkX <= Math.floor((CHALET_MAX_X + 2) / sizeX); chunkX++) {
    for (let chunkZ = Math.floor((CHALET_MIN_Z - 2) / sizeZ); chunkZ <= Math.floor((CHALET_MAX_Z + 2) / sizeZ); chunkZ++) {
      const chunk = worldChunks.get(getChunkKey(chunkX, chunkZ));

      if (!chunk) continue;

      chunk.mesh.dispose(false, true);
      chunk.mesh = createChunkMesh({
        scene,
        name: `chunk-${chunkX}-${chunkZ}`,
        blocks: chunk.blocks,
        sizeX,
        sizeY,
        sizeZ,
        chunkX,
        chunkZ,
        material,
      });
    }
  }
}
