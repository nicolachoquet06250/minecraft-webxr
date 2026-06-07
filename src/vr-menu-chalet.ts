import {createChunkMesh} from "~/textured-world.ts";
import {findDrySpawnPosition, getChunkFromWorldPosition, getChunkKey, setBlock} from "~/functions.ts";
import {type Mesh, MeshBuilder, Quaternion, type Scene, type StandardMaterial, Vector3} from "@babylonjs/core";
import {BlockId, type PlayerPhysics, type WorldChunks} from "./types";
import {AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock} from "@babylonjs/gui";

const CHALET_CENTER_X = 10;
const CHALET_CENTER_Z = 10;
const CHALET_MIN_X = 0;
const CHALET_MAX_X = 20;
const CHALET_MIN_Z = 0;
const CHALET_MAX_Z = 18;
const CHALET_SCREEN_Z = CHALET_MIN_Z + 0.07;
const CHALET_SCREEN_Y_OFFSET = 3.05;
const CHALET_SPAWN_X = 8.5;
const CHALET_SPAWN_Z = 12.5;
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
    player.pitch = -0.08;
    player.grounded = true;
}

function carveInterior(
    worldChunks: WorldChunks,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    floorY: number,
): void {
    for (let x = CHALET_MIN_X - 3; x <= CHALET_MAX_X + 3; x++) {
        for (let z = CHALET_MIN_Z - 3; z <= CHALET_MAX_Z + 3; z++) {
            for (let y = floorY - 1; y <= floorY + 9; y++) {
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
    // Volume fermé : on reproduit un intérieur de maison Minecraft, pas une façade extérieure.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY, CHALET_MIN_Z, CHALET_MAX_X, floorY, CHALET_MAX_Z, BlockId.BirchPlanks);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 5, CHALET_MIN_Z, CHALET_MAX_X, floorY + 5, CHALET_MAX_Z, BlockId.BirchPlanks);

    // Murs en planches sombres, visibles tout autour du joueur.
    for (let y = floorY + 1; y <= floorY + 4; y++) {
        fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, y, CHALET_MIN_Z, CHALET_MAX_X, y, CHALET_MIN_Z, BlockId.SprucePlanks);
        fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, y, CHALET_MAX_Z, CHALET_MAX_X, y, CHALET_MAX_Z, BlockId.SprucePlanks);
        fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, y, CHALET_MIN_Z, CHALET_MIN_X, y, CHALET_MAX_Z, BlockId.SprucePlanks);
        fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, y, CHALET_MIN_Z, CHALET_MAX_X, y, CHALET_MAX_Z, BlockId.SprucePlanks);
    }

    // Piliers et poutres, comme les angles boisés visibles sur la référence.
    for (const [x, z] of [
        [CHALET_MIN_X, CHALET_MIN_Z],
        [CHALET_MAX_X, CHALET_MIN_Z],
        [CHALET_MIN_X, CHALET_MAX_Z],
        [CHALET_MAX_X, CHALET_MAX_Z],
        [12, CHALET_MIN_Z],
        [12, 9],
    ] as const) {
        fillBox(worldChunks, sizeX, sizeY, sizeZ, x, floorY + 1, z, x, floorY + 5, z, BlockId.DarkOakLog);
    }

    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 4, CHALET_MIN_Z, CHALET_MAX_X, floorY + 4, CHALET_MIN_Z, BlockId.DarkOakLog);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 4, CHALET_MAX_Z, CHALET_MAX_X, floorY + 4, CHALET_MAX_Z, BlockId.DarkOakLog);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 4, CHALET_MIN_Z, CHALET_MIN_X, floorY + 4, CHALET_MAX_Z, BlockId.DarkOakLog);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 4, CHALET_MIN_Z, CHALET_MAX_X, floorY + 4, CHALET_MAX_Z, BlockId.DarkOakLog);

    for (const z of [3, 7, 11, 15]) {
        fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 5, z, CHALET_MAX_X, floorY + 5, z, BlockId.DarkOakLog);
    }

    // Fenêtre haute à gauche de la scène.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MIN_X, floorY + 2, 3, CHALET_MIN_X, floorY + 3, 7, BlockId.Glass);

    // Fenêtre du mur droit/fond comme sur la référence.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 15, floorY + 2, CHALET_MAX_Z, 17, floorY + 3, CHALET_MAX_Z, BlockId.Glass);

    // Paroi centrale à droite qui crée le décroché visible dans l'image modèle.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, CHALET_MIN_Z, 12, floorY + 4, 9, BlockId.SprucePlanks);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, 9, 14, floorY + 4, 9, BlockId.SprucePlanks);

    // Porte double approximée sous les cadres, sur la paroi de droite.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, 6, 12, floorY + 2, 7, BlockId.Air);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, 6, BlockId.OakPlanks);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 12, floorY + 1, 7, BlockId.OakPlanks);
}

function buildLivingRoomDetails(
    worldChunks: WorldChunks,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    floorY: number,
): void {
    // Grand tableau/écran sur le mur gauche de face, dans l'esprit du grand cadre de la capture.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 2, floorY + 2, CHALET_MIN_Z, 10, floorY + 4, CHALET_MIN_Z, BlockId.BlackWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 1, floorY + 1, CHALET_MIN_Z, 11, floorY + 1, CHALET_MIN_Z, BlockId.DarkOakPlanks);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 1, floorY + 2, CHALET_MIN_Z, 1, floorY + 4, CHALET_MIN_Z, BlockId.DarkOakPlanks);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 11, floorY + 2, CHALET_MIN_Z, 11, floorY + 4, CHALET_MIN_Z, BlockId.DarkOakPlanks);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 1, floorY + 5, CHALET_MIN_Z, 11, floorY + 5, CHALET_MIN_Z, BlockId.DarkOakPlanks);

    // Bandeau/signe sous l'écran.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 3, floorY + 1, CHALET_MIN_Z + 1, 9, floorY + 1, CHALET_MIN_Z + 1, BlockId.SprucePlanks);

    // Canapé blanc au centre, dos au joueur et face au grand écran.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 4, floorY + 1, 9, 9, floorY + 1, 10, BlockId.WhiteWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 4, floorY + 2, 10, 9, floorY + 2, 10, BlockId.WhiteWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 3, floorY + 1, 9, 3, floorY + 2, 10, BlockId.WhiteWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 10, floorY + 1, 9, 10, floorY + 2, 10, BlockId.WhiteWool);

    // Table basse sombre et tapis sombre devant le canapé.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 5, floorY + 1, 6, 8, floorY + 1, 7, BlockId.DarkOakPlanks);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 5, floorY + 1, 12, 9, floorY + 1, 14, BlockId.GrayWool);

    // Torches au sol, placées comme les points lumineux visibles dans le salon modèle.
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 2, floorY + 1, 5, BlockId.Torch);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 10, floorY + 1, 5, BlockId.Torch);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 4, floorY + 1, 13, BlockId.Torch);

    // Cadres au mur central droit.
    for (const [x, y, block] of [
        [13, floorY + 3, BlockId.GreenWool],
        [14, floorY + 3, BlockId.LightGrayWool],
        [13, floorY + 2, BlockId.BlackWool],
        [14, floorY + 2, BlockId.GrayWool],
    ] as const) {
        setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, 9, BlockId.BirchPlanks);
        setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, 8, block);
    }

    // Table sombre sous les cadres.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 13, floorY + 1, 7, 14, floorY + 1, 8, BlockId.DarkOakPlanks);

    // Grande carte verte/bleue sur le mur droit, approximée en blocs plats.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 1, 7, CHALET_MAX_X, floorY + 4, 12, BlockId.GreenWool);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 2, 8, BlockId.BlueWool);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 3, 10, BlockId.BlueWool);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 1, 11, BlockId.BlueWool);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, CHALET_MAX_X, floorY + 4, 9, BlockId.WhiteWool);

    // Bibliothèque et zone enchantement à droite/fond.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 17, floorY + 1, 13, 19, floorY + 4, 17, BlockId.Bookshelf);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 16, floorY + 1, 15, BlockId.CraftingTable);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 16, floorY + 1, 16, BlockId.Furnace);

    // Ender chest approximé à droite devant le joueur.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 15, floorY + 1, 10, 17, floorY + 1, 12, BlockId.BlackWool);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 15, floorY + 2, 10, BlockId.CyanWool);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 17, floorY + 2, 12, BlockId.CyanWool);

    // Coffre simple sur le côté gauche/fond.
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, 2, floorY + 1, 15, BlockId.Chest);
}

function createMenuPanel(scene: Scene, floorY: number): Mesh {
    const panel = MeshBuilder.CreatePlane(
        "vr-menu-screen-panel",
        { width: 4.6, height: 2.25 },
        scene,
    );
    panel.position.set(6.5, floorY + CHALET_SCREEN_Y_OFFSET, CHALET_SCREEN_Z);
    panel.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0);
    panel.isPickable = true;

    const ui = AdvancedDynamicTexture.CreateForMesh(panel, 1600, 820, false);
    const root = new Rectangle("vr-menu-root");
    root.thickness = 8;
    root.color = "#5b3f24";
    root.cornerRadius = 28;
    root.background = "rgba(18, 14, 10, 0.72)";
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
    for (let chunkX = Math.floor((CHALET_MIN_X - 3) / sizeX); chunkX <= Math.floor((CHALET_MAX_X + 3) / sizeX); chunkX++) {
        for (let chunkZ = Math.floor((CHALET_MIN_Z - 3) / sizeZ); chunkZ <= Math.floor((CHALET_MAX_Z + 3) / sizeZ); chunkZ++) {
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
