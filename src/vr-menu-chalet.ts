import {createChunkMesh} from "~/textured-world.ts";
import {findDrySpawnPosition, getChunkFromWorldPosition, getChunkKey, setBlock} from "~/functions.ts";
import {type Mesh, MeshBuilder, Quaternion, type Scene, type StandardMaterial, Vector3} from "@babylonjs/core";
import {BlockId, type PlayerPhysics, type WorldChunks} from "./types";
import {AdvancedDynamicTexture, Control, Rectangle, StackPanel, TextBlock} from "@babylonjs/gui";

const HORIZON_CENTER_X = 8;
const HORIZON_CENTER_Z = 8;
const HORIZON_MIN_X = -6;
const HORIZON_MAX_X = 22;
const HORIZON_MIN_Z = -4;
const HORIZON_MAX_Z = 20;
const HORIZON_SCREEN_Z = HORIZON_MIN_Z + 0.06;
const HORIZON_SCREEN_Y_OFFSET = 3.25;
const HORIZON_SPAWN_X = 8.5;
const HORIZON_SPAWN_Z = 13.5;
const HORIZON_YAW_TO_SCREEN = Math.PI;

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
        HORIZON_CENTER_X,
        HORIZON_CENTER_Z,
        64,
    );
    const floorY = Math.max(1, Math.floor(terrainSpawn.y));

    carveHorizonSpace(worldChunks, sizeX, sizeY, sizeZ, floorY);
    buildHorizonHubShell(worldChunks, sizeX, sizeY, sizeZ, floorY);
    buildHorizonLobbyDetails(worldChunks, sizeX, sizeY, sizeZ, floorY);
    rebuildTouchedChunkMeshes(scene, worldChunks, sizeX, sizeY, sizeZ, material);

    const menuPanel = createMenuPanel(scene, floorY);

    return {
        spawn: new Vector3(HORIZON_SPAWN_X, floorY + 1.02, HORIZON_SPAWN_Z),
        yaw: HORIZON_YAW_TO_SCREEN,
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

function carveHorizonSpace(
    worldChunks: WorldChunks,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    floorY: number,
): void {
    for (let x = HORIZON_MIN_X - 3; x <= HORIZON_MAX_X + 3; x++) {
        for (let z = HORIZON_MIN_Z - 3; z <= HORIZON_MAX_Z + 3; z++) {
            for (let y = floorY; y <= floorY + 14; y++) {
                setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, y, z, BlockId.Air);
            }
        }
    }
}

function buildHorizonHubShell(
    worldChunks: WorldChunks,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    floorY: number,
): void {
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, floorY, HORIZON_MIN_Z, HORIZON_MAX_X, floorY, HORIZON_MAX_Z, BlockId.WhiteWool);

    for (let x = HORIZON_MIN_X + 1; x < HORIZON_MAX_X; x++) {
        for (let z = HORIZON_MIN_Z + 1; z < HORIZON_MAX_Z; z++) {
            const isRunway = x >= 6 && x <= 10;
            const isAccentBand = z % 5 === 0 || x === HORIZON_CENTER_X;
            const block = isRunway
                ? BlockId.LightBlueWool
                : isAccentBand
                    ? BlockId.CyanWool
                    : BlockId.LightGrayWool;
            setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, floorY, z, block);
        }
    }

    // Mur avant : scène sombre et grand écran flottant façon hub Horizon.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 1, floorY + 1, HORIZON_MIN_Z, 15, floorY + 6, HORIZON_MIN_Z, BlockId.BlackWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 4, floorY + 2, HORIZON_MIN_Z, 12, floorY + 5, HORIZON_MIN_Z, BlockId.BlueWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 5, floorY + 3, HORIZON_MIN_Z, 11, floorY + 4, HORIZON_MIN_Z, BlockId.LightBlueWool);

    // Murs latéraux bas + grandes baies vitrées pour que le changement soit visible en VR.
    for (let y = floorY + 1; y <= floorY + 5; y++) {
        for (let z = HORIZON_MIN_Z; z <= HORIZON_MAX_Z; z++) {
            const block = y <= floorY + 2 || z % 6 === 0 ? BlockId.WhiteWool : BlockId.Glass;
            setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, y, z, block);
            setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MAX_X, y, z, block);
        }
    }

    // Arrière ouvert sur une arche bleue, au lieu de l'ancien petit chalet en bois.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, floorY + 1, HORIZON_MAX_Z, HORIZON_MAX_X, floorY + 2, HORIZON_MAX_Z, BlockId.WhiteWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, floorY + 3, HORIZON_MAX_Z, HORIZON_MAX_X, floorY + 5, HORIZON_MAX_Z, BlockId.Glass);

    // Plafond partiel en anneaux pour garder une sensation ouverte.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, floorY + 7, HORIZON_MIN_Z, HORIZON_MAX_X, floorY + 7, HORIZON_MIN_Z, BlockId.CyanWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, floorY + 7, HORIZON_MAX_Z, HORIZON_MAX_X, floorY + 7, HORIZON_MAX_Z, BlockId.CyanWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MIN_X, floorY + 7, HORIZON_MIN_Z, HORIZON_MIN_X, floorY + 7, HORIZON_MAX_Z, BlockId.CyanWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, HORIZON_MAX_X, floorY + 7, HORIZON_MIN_Z, HORIZON_MAX_X, floorY + 7, HORIZON_MAX_Z, BlockId.CyanWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 2, floorY + 7, 6, 14, floorY + 7, 8, BlockId.Glass);
}

function buildHorizonLobbyDetails(
    worldChunks: WorldChunks,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    floorY: number,
): void {
    buildPortalRing(worldChunks, sizeX, sizeY, sizeZ, 8, floorY + 1, 18);
    buildPortalRing(worldChunks, sizeX, sizeY, sizeZ, -2, floorY + 1, 8);
    buildPortalRing(worldChunks, sizeX, sizeY, sizeZ, 18, floorY + 1, 8);

    // Gradins/canapé incurvés face au panneau principal.
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 4, floorY + 1, 11, 12, floorY + 1, 11, BlockId.WhiteWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 5, floorY + 1, 12, 11, floorY + 1, 12, BlockId.LightBlueWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, 6, floorY + 2, 13, 10, floorY + 2, 13, BlockId.WhiteWool);

    // Socles lumineux et repères de profondeur autour du joueur.
    for (const [x, z] of [[2, 4], [14, 4], [2, 14], [14, 14]] as const) {
        fillBox(worldChunks, sizeX, sizeY, sizeZ, x, floorY + 1, z, x, floorY + 3, z, BlockId.Glowstone);
        setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, x, floorY + 4, z, BlockId.CyanWool);
    }

    // Petites îles décoratives visibles à travers les baies, pour rompre avec l'ancien rendu plat.
    for (const [x, z] of [[-4, 2], [20, 2], [-4, 16], [20, 16]] as const) {
        fillBox(worldChunks, sizeX, sizeY, sizeZ, x - 1, floorY, z - 1, x + 1, floorY, z + 1, BlockId.GrassBlock);
        fillBox(worldChunks, sizeX, sizeY, sizeZ, x, floorY + 1, z, x, floorY + 3, z, BlockId.BirchLog);
        fillBox(worldChunks, sizeX, sizeY, sizeZ, x - 1, floorY + 4, z - 1, x + 1, floorY + 5, z + 1, BlockId.CherryLeaves);
    }
}

function buildPortalRing(
    worldChunks: WorldChunks,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    centerX: number,
    baseY: number,
    z: number,
): void {
    fillBox(worldChunks, sizeX, sizeY, sizeZ, centerX - 3, baseY, z, centerX + 3, baseY, z, BlockId.BlueWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, centerX - 3, baseY + 5, z, centerX + 3, baseY + 5, z, BlockId.BlueWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, centerX - 4, baseY + 1, z, centerX - 4, baseY + 4, z, BlockId.CyanWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, centerX + 4, baseY + 1, z, centerX + 4, baseY + 4, z, BlockId.CyanWool);
    fillBox(worldChunks, sizeX, sizeY, sizeZ, centerX - 2, baseY + 1, z, centerX + 2, baseY + 4, z, BlockId.Glass);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, centerX, baseY + 2, z, BlockId.Glowstone);
    setWorldBlock(worldChunks, sizeX, sizeY, sizeZ, centerX, baseY + 3, z, BlockId.Glowstone);
}

function createMenuPanel(scene: Scene, floorY: number): Mesh {
    const panel = MeshBuilder.CreatePlane(
        "vr-horizon-screen-panel",
        { width: 6.3, height: 3.05 },
        scene,
    );
    panel.position.set(8, floorY + HORIZON_SCREEN_Y_OFFSET, HORIZON_SCREEN_Z);
    panel.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0);
    panel.isPickable = true;

    const ui = AdvancedDynamicTexture.CreateForMesh(panel, 1800, 900, false);
    const root = new Rectangle("vr-horizon-menu-root");
    root.thickness = 10;
    root.color = "#72e5ff";
    root.cornerRadius = 36;
    root.background = "rgba(4, 12, 34, 0.88)";
    root.paddingLeft = "70px";
    root.paddingRight = "70px";
    root.paddingTop = "58px";
    root.paddingBottom = "58px";
    ui.addControl(root);

    const stack = new StackPanel("vr-horizon-menu-stack");
    stack.spacing = 24;
    root.addControl(stack);

    const title = new TextBlock("vr-horizon-menu-title", "Minecraft WebXR");
    title.height = "112px";
    title.color = "white";
    title.fontFamily = "Georgia, serif";
    title.fontSize = 74;
    title.fontWeight = "700";
    title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(title);

    const subtitle = new TextBlock("vr-horizon-menu-subtitle", "Horizon Hub");
    subtitle.height = "48px";
    subtitle.color = "#9eeeff";
    subtitle.fontSize = 36;
    stack.addControl(subtitle);

    for (const [index, label] of ["Un joueur", "Options...", "Quitter le jeu"].entries()) {
        const button = new Rectangle(`vr-horizon-menu-button-${label}`);
        button.height = "92px";
        button.width = "820px";
        button.thickness = 4;
        button.color = index === 0 ? "#ffffff" : "#cdefff";
        button.background = index === 0 ? "rgba(34, 157, 255, 0.94)" : "rgba(32, 48, 80, 0.94)";
        button.cornerRadius = 12;
        button.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

        const text = new TextBlock(`vr-horizon-menu-button-label-${label}`, label);
        text.color = "white";
        text.fontSize = 36;
        text.fontWeight = "700";
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
    for (let chunkX = Math.floor((HORIZON_MIN_X - 3) / sizeX); chunkX <= Math.floor((HORIZON_MAX_X + 3) / sizeX); chunkX++) {
        for (let chunkZ = Math.floor((HORIZON_MIN_Z - 3) / sizeZ); chunkZ <= Math.floor((HORIZON_MAX_Z + 3) / sizeZ); chunkZ++) {
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
